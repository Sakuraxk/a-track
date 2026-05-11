"""
AI 评分服务
用于主观题（简答题、论述题）的智能评分
"""
import json
import logging
from typing import Optional, Dict, List
from pydantic import BaseModel
from openai import AsyncOpenAI

from ..prompts import get_prompt_registry
from ..services.llm_service import LLMService, LLMServiceFactory
from ..services.encryption import decrypt_api_key
from ..models.llm_config import UserLLMConfig
from ..core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)


class ScoringDimension(BaseModel):
    """评分维度"""
    name: str
    score: int  # 0-100
    feedback: str


class ScoringResult(BaseModel):
    """评分结果"""
    total_score: int  # 0-100
    dimensions: List[ScoringDimension]
    overall_feedback: str
    strengths: List[str]
    improvements: List[str]


class AIScoringService:
    """AI 评分服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.last_error: Optional[str] = None

    async def _get_llm_service(self, user_id: str) -> Optional[LLMService]:
        """获取用户配置的 LLM 服务"""
        result = await self.db.execute(
            select(UserLLMConfig)
            .where(UserLLMConfig.user_id == user_id, UserLLMConfig.is_active == True)
            .order_by(UserLLMConfig.updated_at.desc())
        )
        config = result.scalar_one_or_none()

        if config:
            try:
                decrypted_key = decrypt_api_key(config.api_key_encrypted)
                return LLMServiceFactory.create(
                    api_base_url=config.api_base_url,
                    api_key=decrypted_key,
                    model_name=config.model_name,
                    max_tokens=config.max_tokens,
                    temperature=config.temperature / 100,
                )
            except Exception as e:
                logger.warning(f"[AI Scoring] 用户 LLM 配置解密失败: {e}")

        # 尝试系统默认配置
        if settings.use_system_llm and settings.deepseek_api_key:
            return LLMServiceFactory.create(
                api_base_url=settings.deepseek_base_url,
                api_key=settings.deepseek_api_key,
                model_name=settings.deepseek_model,
            )

        return None

    async def score_answer(
        self,
        user_id: str,
        question: str,
        answer: str,
        question_type: str = "short_answer",
        rubric: Optional[str] = None,
    ) -> Optional[ScoringResult]:
        """
        对主观题答案进行 AI 评分

        Args:
            user_id: 用户ID
            question: 题目内容
            answer: 学生答案
            question_type: 题型 (short_answer, essay)
            rubric: 评分标准/参考答案

        Returns:
            评分结果，或 None（如果评分失败）
        """
        self.last_error = None
        llm_service = await self._get_llm_service(user_id)

        if not llm_service:
            self.last_error = "未配置 LLM 服务"
            return self._generate_default_score(answer)

        try:
            prompt_registry = get_prompt_registry()
            prompt_definition = prompt_registry.get_definition("ai_scoring.score_answer")
            messages = prompt_registry.render_messages(
                "ai_scoring.score_answer",
                {
                    "question_type": question_type,
                    "question": question,
                    "rubric": rubric or "根据答案的准确性、完整性和表达清晰度进行评分",
                    "answer": answer,
                },
            )

            tmp_client = AsyncOpenAI(
                base_url=llm_service.api_base_url,
                api_key=llm_service.api_key,
                timeout=60,
            )

            response = await tmp_client.chat.completions.create(
                model=llm_service.model_name,
                messages=messages,
                temperature=prompt_definition.temperature,
                max_tokens=prompt_definition.max_tokens,
            )

            content = response.choices[0].message.content or ""
            content = content.strip()

            # 解析 JSON
            if content.startswith("```"):
                lines = content.split("\n")
                json_lines = [l for l in lines if not l.startswith("```")]
                content = "\n".join(json_lines)

            data = json.loads(content)

            return ScoringResult(
                total_score=data.get("total_score", 0),
                dimensions=[
                    ScoringDimension(**d) for d in data.get("dimensions", [])
                ],
                overall_feedback=data.get("overall_feedback", ""),
                strengths=data.get("strengths", []),
                improvements=data.get("improvements", []),
            )

        except Exception as e:
            logger.error(f"[AI Scoring] 评分失败: {e}")
            self.last_error = str(e)
            return self._generate_default_score(answer)

    def _generate_default_score(self, answer: str) -> ScoringResult:
        """生成默认评分（无 AI 时使用）"""
        # 基于答案长度给出基础分
        base_score = min(60 + len(answer) // 10, 80)

        return ScoringResult(
            total_score=base_score,
            dimensions=[
                ScoringDimension(
                    name="内容准确性",
                    score=base_score,
                    feedback="已收到您的答案，建议配置 AI 获取详细评分"
                ),
                ScoringDimension(
                    name="逻辑清晰度",
                    score=base_score,
                    feedback="暂无详细评价"
                ),
                ScoringDimension(
                    name="表达规范性",
                    score=base_score,
                    feedback="暂无详细评价"
                ),
            ],
            overall_feedback="已记录您的答案。建议配置 LLM 以获取 AI 智能评分和详细反馈。",
            strengths=["已完成作答"],
            improvements=["配置 AI 服务以获取个性化反馈"],
        )
