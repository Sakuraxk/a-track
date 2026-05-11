"""
对话服务模块
管理AI对话会话和消息历史
"""
import json
from typing import List, Optional, Dict, Any, AsyncGenerator
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.llm_config import UserLLMConfig, ConversationSession, ConversationMessage
from app.schemas.conversation import (
    ChatRequest, ChatResponse, ChatMessage,
    SessionCreate, SessionResponse, SessionHistoryResponse, ConversationContext
)
from app.services.llm_service import LLMService, LLMServiceFactory, LLMServiceError
from app.services.encryption import encryption_service
from app.core.config import settings
from app.models.base import utcnow_naive


class ConversationServiceError(Exception):
    """对话服务错误"""
    pass


class ConversationService:
    """对话管理服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _to_uuid(value: str | UUID) -> UUID:
        if isinstance(value, UUID):
            return value
        return UUID(value)

    async def chat(
        self,
        user_id: str,
        request: ChatRequest
    ) -> ChatResponse:
        """
        处理聊天请求

        Args:
            user_id: 用户ID
            request: 聊天请求

        Returns:
            聊天响应
        """
        normalized_user_id = self._to_uuid(user_id)

        # 1. 获取或创建会话
        session = await self._get_or_create_session(
            normalized_user_id,
            request.session_id,
            request.tutor_role,
            request.context,
            request.scope_type,
            request.scope_id,
        )

        # 2. 获取用户的LLM配置
        llm_config = await self._get_llm_config(normalized_user_id, request.tutor_role)
        if not llm_config:
            raise ConversationServiceError(
                f"未找到角色 '{request.tutor_role}' 的LLM配置，请先在设置中配置API"
            )

        # 3. 创建LLM服务
        # 检查是否是系统默认配置（系统密钥不需要解密）
        if llm_config.id == "system_default":
            decrypted_key = llm_config.api_key_encrypted  # 系统密钥是明文
        else:
            decrypted_key = encryption_service.decrypt(llm_config.api_key_encrypted)
        llm_service = LLMServiceFactory.create_from_db_config(llm_config, decrypted_key)

        # 4. 获取历史消息
        history = await self._get_session_messages(
            session.id,
            limit=settings.max_conversation_history
        )

        # 5. 构建上下文
        context = self._build_llm_context(request.context)

        # 6. 构建消息列表
        messages = [{"role": m.role, "content": m.content} for m in history]
        messages.append({"role": "user", "content": request.message})

        # 7. 调用LLM
        try:
            response = await llm_service.chat(
                messages=messages,
                role=request.tutor_role,
                context=context,
                request_direct_answer=request.request_direct_answer
            )
        except LLMServiceError as e:
            raise ConversationServiceError(str(e))

        # 8. 保存用户消息
        await self._add_message(session.id, "user", request.message)

        # 9. 保存助手响应
        await self._add_message(
            session.id,
            "assistant",
            response["content"],
            model_used=response["model"],
            tokens_used=response.get("tokens_used")
        )

        # 10. 更新会话时间
        session.updated_at = utcnow_naive()
        await self.db.commit()



        return ChatResponse(
            session_id=str(session.id),  # UUID → str
            message=response["content"],
            guidance_only=not request.request_direct_answer,
            hints=[],  # 可以通过解析响应提取
            follow_up_questions=[],
            recommended_nodes=[],
            model_used=response["model"],
            tokens_used=response.get("tokens_used")
        )

    async def chat_stream(
        self,
        user_id: str,
        request: ChatRequest
    ) -> AsyncGenerator[str, None]:
        """
        流式处理聊天请求 (SSE 格式)

        Args:
            user_id: 用户ID
            request: 聊天请求

        Yields:
            SSE 格式的字符串数据
        """
        normalized_user_id = self._to_uuid(user_id)

        # 1. 获取或创建会话
        session = await self._get_or_create_session(
            normalized_user_id,
            request.session_id,
            request.tutor_role,
            request.context,
            request.scope_type,
            request.scope_id,
        )

        # 先返回 session_id
        yield f"data: {json.dumps({'type': 'session', 'session_id': str(session.id)}, ensure_ascii=False)}\n\n"

        # 2. 获取用户的LLM配置
        llm_config = await self._get_llm_config(normalized_user_id, request.tutor_role)
        if not llm_config:
            yield f"data: {json.dumps({'type': 'error', 'content': '未找到LLM配置，请先在设置中配置API'}, ensure_ascii=False)}\n\n"
            return

        # 3. 创建LLM服务
        if llm_config.id == "system_default":
            decrypted_key = llm_config.api_key_encrypted
        else:
            decrypted_key = encryption_service.decrypt(llm_config.api_key_encrypted)
        llm_service = LLMServiceFactory.create_from_db_config(llm_config, decrypted_key)

        # 4. 获取历史消息
        history = await self._get_session_messages(
            session.id,
            limit=settings.max_conversation_history
        )

        # 5. 构建上下文
        context = self._build_llm_context(request.context)

        # 6. 构建消息列表
        messages = [{"role": m.role, "content": m.content} for m in history]
        messages.append({"role": "user", "content": request.message})

        # 7. 保存用户消息
        await self._add_message(session.id, "user", request.message)

        full_content = ""
        full_reasoning = ""

        # 8. 流式调用 LLM
        try:
            async for chunk in llm_service.chat_stream(
                messages=messages,
                role=request.tutor_role,
                context=context,
                request_direct_answer=request.request_direct_answer
            ):
                chunk_type = chunk.get("type", "")

                if chunk_type == "thinking":
                    full_reasoning += chunk.get("content", "")
                elif chunk_type == "content":
                    full_content += chunk.get("content", "")
                elif chunk_type == "done":
                    # 保存助手响应
                    await self._add_message(
                        session.id,
                        "assistant",
                        full_content,
                        model_used=chunk.get("model"),
                        tokens_used=None
                    )
                    session.updated_at = utcnow_naive()
                    await self.db.commit()



                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"

    async def create_session(
        self,
        user_id: str,
        request: SessionCreate
    ) -> SessionResponse:
        """创建新会话"""
        normalized_user_id = self._to_uuid(user_id)
        session = ConversationSession(
            user_id=normalized_user_id,
            title=request.title,
            role=request.role,
            knowledge_node_code=request.context.knowledge_node_code if request.context else None,
            exercise_id=request.context.exercise_id if request.context else None,
            scope_type=request.scope_type,
            scope_id=request.scope_id,
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)

        return SessionResponse(
            id=str(session.id),  # UUID → str
            user_id=str(session.user_id),  # UUID → str
            title=session.title,
            role=session.role,
            knowledge_node_code=session.knowledge_node_code,
            exercise_id=str(session.exercise_id) if session.exercise_id else None,  # UUID → str
            scope_type=session.scope_type,
            scope_id=session.scope_id,
            is_active=session.is_active,
            created_at=session.created_at,
            updated_at=session.updated_at,
            message_count=0
        )

    async def list_sessions(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
        scope_type: Optional[str] = None,
        scope_id: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> tuple[List[SessionResponse], int]:
        """获取用户的会话列表"""
        normalized_user_id = self._to_uuid(user_id)
        filters = [
            ConversationSession.user_id == normalized_user_id,
            ConversationSession.is_active == True,
        ]
        if scope_type:
            filters.append(ConversationSession.scope_type == scope_type)
        if scope_id:
            filters.append(ConversationSession.scope_id == scope_id)
        if keyword and keyword.strip():
            search_term = f"%{keyword.strip()}%"
            message_session_ids = select(ConversationMessage.session_id).where(
                ConversationMessage.content.ilike(search_term)
            )
            filters.append(
                or_(
                    ConversationSession.title.ilike(search_term),
                    ConversationSession.id.in_(message_session_ids),
                )
            )

        # 查询总数
        count_stmt = select(func.count()).select_from(ConversationSession).where(
            and_(*filters)
        )
        total = await self.db.scalar(count_stmt)

        # 查询会话列表（含消息数量 — 使用子查询避免 N+1）
        msg_count_subq = (
            select(
                ConversationMessage.session_id,
                func.count(ConversationMessage.id).label("msg_count"),
            )
            .group_by(ConversationMessage.session_id)
            .subquery()
        )

        stmt = (
            select(ConversationSession, msg_count_subq.c.msg_count)
            .outerjoin(msg_count_subq, ConversationSession.id == msg_count_subq.c.session_id)
            .where(and_(*filters))
            .order_by(desc(ConversationSession.updated_at))
            .offset(offset)
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        rows = result.all()

        responses = []
        for session, msg_count in rows:
            responses.append(SessionResponse(
                id=str(session.id),
                user_id=str(session.user_id),
                title=session.title,
                role=session.role,
                knowledge_node_code=session.knowledge_node_code,
                exercise_id=str(session.exercise_id) if session.exercise_id else None,
                scope_type=session.scope_type,
                scope_id=session.scope_id,
                is_active=session.is_active,
                created_at=session.created_at,
                updated_at=session.updated_at,
                message_count=msg_count or 0
            ))

        return responses, total or 0

    async def get_session_history(
        self,
        user_id: str,
        session_id: str
    ) -> SessionHistoryResponse:
        """获取会话历史"""
        normalized_user_id = self._to_uuid(user_id)
        # 获取会话
        stmt = select(ConversationSession).where(
            and_(
                ConversationSession.id == session_id,
                ConversationSession.user_id == normalized_user_id
            )
        )
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()

        if not session:
            raise ConversationServiceError("会话不存在")

        # 获取消息
        messages = await self._get_session_messages(session_id)

        # 获取消息数
        msg_count = len(messages)

        session_response = SessionResponse(
            id=str(session.id),  # UUID → str
            user_id=str(session.user_id),  # UUID → str
            title=session.title,
            role=session.role,
            knowledge_node_code=session.knowledge_node_code,
            exercise_id=str(session.exercise_id) if session.exercise_id else None,  # UUID → str
            scope_type=session.scope_type,
            scope_id=session.scope_id,
            is_active=session.is_active,
            created_at=session.created_at,
            updated_at=session.updated_at,
            message_count=msg_count
        )

        chat_messages = [
            ChatMessage(
                role=m.role,
                content=m.content,
                created_at=m.created_at
            )
            for m in messages
        ]

        return SessionHistoryResponse(
            session=session_response,
            messages=chat_messages
        )

    async def delete_session(self, user_id: str, session_id: str) -> bool:
        """删除会话（软删除）"""
        normalized_user_id = self._to_uuid(user_id)
        stmt = select(ConversationSession).where(
            and_(
                ConversationSession.id == session_id,
                ConversationSession.user_id == normalized_user_id
            )
        )
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()

        if not session:
            return False

        session.is_active = False
        await self.db.commit()
        return True

    async def _get_or_create_session(
        self,
        user_id: UUID,
        session_id: Optional[str],
        role: str,
        context: Optional[ConversationContext],
        scope_type: Optional[str] = None,
        scope_id: Optional[str] = None,
    ) -> ConversationSession:
        """获取或创建会话"""
        if session_id:
            stmt = select(ConversationSession).where(
                and_(
                    ConversationSession.id == session_id,
                    ConversationSession.user_id == user_id,
                    ConversationSession.is_active == True
                )
            )
            result = await self.db.execute(stmt)
            session = result.scalar_one_or_none()
            if session:
                return session

        # 创建新会话
        session = ConversationSession(
            user_id=user_id,
            role=role,
            knowledge_node_code=context.knowledge_node_code if context else None,
            exercise_id=context.exercise_id if context else None,
            scope_type=scope_type,
            scope_id=scope_id,
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def _get_llm_config(
        self,
        user_id: UUID,
        role: str
    ) -> Optional[UserLLMConfig]:
        """获取用户的LLM配置，如无则使用系统默认（统一配置模式，不按角色区分）"""
        stmt = select(UserLLMConfig).where(
            and_(
                UserLLMConfig.user_id == user_id,
                UserLLMConfig.is_active == True
            )
        ).order_by(UserLLMConfig.updated_at.desc())
        result = await self.db.execute(stmt)
        config = result.scalars().first()

        if config:
            return config

        # 用户无配置，使用系统默认创建虚拟配置
        if settings.use_system_llm and settings.deepseek_api_key:
            # 返回一个虚拟的配置对象用于系统默认 LLM
            virtual_config = UserLLMConfig(
                id="system_default",
                user_id=user_id,
                model_role="default",
                api_base_url=settings.deepseek_base_url,
                api_key_encrypted=settings.deepseek_api_key,  # 系统密钥不加密
                model_name=settings.deepseek_model,
                temperature=70,  # 0.7
                max_tokens=2048,
                timeout_seconds=30,
                is_active=True
            )
            return virtual_config

        return None

    async def _get_session_messages(
        self,
        session_id: str,
        limit: int = 50
    ) -> List[ConversationMessage]:
        """获取会话消息历史"""
        stmt = select(ConversationMessage).where(
            ConversationMessage.session_id == session_id
        ).order_by(ConversationMessage.created_at).limit(limit)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        model_used: Optional[str] = None,
        tokens_used: Optional[int] = None
    ) -> ConversationMessage:
        """添加消息"""
        message = ConversationMessage(
            session_id=session_id,
            role=role,
            content=content,
            model_used=model_used,
            tokens_used=tokens_used
        )
        self.db.add(message)
        await self.db.flush()  # 获取ID但不提交
        return message

    def _build_llm_context(self, context: Optional[ConversationContext]) -> Dict[str, Any]:
        """构建LLM上下文"""
        if not context:
            return {}

        result: Dict[str, Any] = {
            "knowledge_node": context.knowledge_node_code or "通用学习",
            "recent_errors": ", ".join(context.recent_errors) if context.recent_errors else "无",
            "ability_tags": str(context.user_ability_tags) if context.user_ability_tags else "未知",
        }

        # 学习上下文（概念学习页面注入）
        if context.subject:
            result["subject"] = context.subject
        if context.chapter_title:
            result["chapter_title"] = context.chapter_title
        if context.chapter_summary:
            result["chapter_summary"] = context.chapter_summary
        if context.section_title:
            result["section_title"] = context.section_title
        if context.selected_text:
            result["selected_text"] = context.selected_text

        # 做题上下文（PracticeAIPanel 注入）
        if context.question_stem:
            result["question_stem"] = context.question_stem
        if context.question_type:
            result["question_type"] = context.question_type

        return result



