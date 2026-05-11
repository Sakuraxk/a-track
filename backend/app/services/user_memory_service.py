"""
用户记忆管理服务层

提供用户长期记忆的创建、查询、更新和分析功能。
支持行为记录、偏好推断、交互保存、模式识别等核心业务逻辑。
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any
from sqlalchemy import and_, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import utcnow_naive
from app.models.user_memory import (
    UserBehaviorMemory,
    UserPreferenceMemory,
    UserLearningPattern,
    UserContextMemory
)


class UserMemoryService:
    """用户记忆管理服务"""
    
    @staticmethod
    async def record_behavior(
        db: AsyncSession,
        user_id: uuid.UUID,
        behavior_type: str,
        context: Optional[str] = None,
        event_metadata: Optional[Dict[str, Any]] = None
    ) -> UserBehaviorMemory:
        """
        记录用户行为事件
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            behavior_type: 行为类型 (login, node_visit, exercise_complete等)
            context: 上下文描述 (如节点code或练习id)
            event_metadata: 额外的行为详情
            
        Returns:
            创建的行为记录
        """
        behavior = UserBehaviorMemory(
            user_id=user_id,
            behavior_type=behavior_type,
            context=context,
            event_metadata=event_metadata or {}
        )
        db.add(behavior)
        await db.flush()
        return behavior
    
    @staticmethod
    async def update_preference(
        db: AsyncSession,
        user_id: uuid.UUID,
        preference_key: str,
        preference_value: str,
        confidence_increment: float = 0.1
    ) -> UserPreferenceMemory:
        """
        更新或创建用户偏好
        
        如果偏好已存在,增加evidence_count和confidence_score。
        如果偏好不存在,创建新记录。
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            preference_key: 偏好类型
            preference_value: 偏好值
            confidence_increment: 置信度增量
            
        Returns:
            更新后的偏好记录
        """
        # 查询现有偏好
        result = await db.execute(
            UserPreferenceMemory.__table__.select().where(
                and_(
                    UserPreferenceMemory.user_id == user_id,
                    UserPreferenceMemory.preference_key == preference_key
                )
            )
        )
        existing = result.first()
        
        if existing:
            # 更新现有偏好
            preference = await db.get(UserPreferenceMemory, existing.id)
            
            # 如果值相同,增加置信度
            if preference.preference_value == preference_value:
                preference.evidence_count += 1
                preference.confidence_score = min(1.0, preference.confidence_score + confidence_increment)
            else:
                # 如果值不同,重置为新值
                preference.preference_value = preference_value
                preference.evidence_count = 1
                preference.confidence_score = 0.5
            
            preference.last_observed_at = utcnow_naive()
            preference.updated_at = utcnow_naive()
        else:
            # 创建新偏好
            preference = UserPreferenceMemory(
                user_id=user_id,
                preference_key=preference_key,
                preference_value=preference_value,
                confidence_score=0.5,
                evidence_count=1,
                last_observed_at=utcnow_naive()
            )
            db.add(preference)
        
        await db.flush()
        return preference
    

    
    @staticmethod
    async def get_recent_context(
        db: AsyncSession,
        user_id: uuid.UUID,
        context_type: Optional[str] = None,
        limit: int = 5
    ) -> List[UserContextMemory]:
        """
        获取用户最近的学习上下文
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            context_type: 上下文类型 (None表示所有类型)
            limit: 返回数量限制
            
        Returns:
            上下文记录列表
        """
        query = UserContextMemory.__table__.select().where(
            UserContextMemory.user_id == user_id
        )
        
        if context_type:
            query = query.where(UserContextMemory.context_type == context_type)
        
        # 过滤未过期的记录
        query = query.where(
            (UserContextMemory.expires_at.is_(None)) |
            (UserContextMemory.expires_at > utcnow_naive())
        ).order_by(desc(UserContextMemory.updated_at)).limit(limit)
        
        result = await db.execute(query)
        return result.fetchall()
    
    @staticmethod
    async def set_context(
        db: AsyncSession,
        user_id: uuid.UUID,
        context_type: str,
        context_data: Dict[str, Any],
        ttl_hours: Optional[int] = None
    ) -> UserContextMemory:
        """
        设置用户上下文
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            context_type: 上下文类型
            context_data: 上下文数据
            ttl_hours: 过期时间(小时),None表示永不过期
            
        Returns:
            创建或更新的上下文记录
        """
        # 查找现有同类型上下文
        result = await db.execute(
            UserContextMemory.__table__.select().where(
                and_(
                    UserContextMemory.user_id == user_id,
                    UserContextMemory.context_type == context_type
                )
            )
        )
        existing = result.first()
        
        expires_at = None
        if ttl_hours:
            expires_at = utcnow_naive() + timedelta(hours=ttl_hours)
        
        if existing:
            # 更新现有上下文
            context = await db.get(UserContextMemory, existing.id)
            context.context_data = context_data
            context.expires_at = expires_at
            context.updated_at = utcnow_naive()
        else:
            # 创建新上下文
            context = UserContextMemory(
                user_id=user_id,
                context_type=context_type,
                context_data=context_data,
                expires_at=expires_at
            )
            db.add(context)
        
        await db.flush()
        return context
    
    @staticmethod
    async def get_user_patterns(
        db: AsyncSession,
        user_id: uuid.UUID,
        pattern_type: Optional[str] = None,
        min_confidence: float = 0.6
    ) -> List[UserLearningPattern]:
        """
        查询用户学习模式
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            pattern_type: 模式类型 (None表示所有类型)
            min_confidence: 最小置信度阈值
            
        Returns:
            学习模式列表
        """
        query = UserLearningPattern.__table__.select().where(
            and_(
                UserLearningPattern.user_id == user_id,
                UserLearningPattern.confidence >= min_confidence
            )
        )
        
        if pattern_type:
            query = query.where(UserLearningPattern.pattern_type == pattern_type)
        
        query = query.order_by(desc(UserLearningPattern.confidence))
        
        result = await db.execute(query)
        return result.fetchall()
    
    @staticmethod
    async def update_learning_pattern(
        db: AsyncSession,
        user_id: uuid.UUID,
        pattern_type: str,
        pattern_description: str,
        pattern_data: Optional[Dict[str, Any]] = None,
        confidence_increment: float = 0.1
    ) -> UserLearningPattern:
        """
        更新或创建学习模式
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            pattern_type: 模式类型
            pattern_description: 模式描述
            pattern_data: 模式结构化数据
            confidence_increment: 置信度增量
            
        Returns:
            更新后的模式记录
        """
        # 查询现有模式
        result = await db.execute(
            UserLearningPattern.__table__.select().where(
                and_(
                    UserLearningPattern.user_id == user_id,
                    UserLearningPattern.pattern_type == pattern_type
                )
            )
        )
        existing = result.first()
        
        if existing:
            # 更新现有模式
            pattern = await db.get(UserLearningPattern, existing.id)
            pattern.pattern_description = pattern_description
            pattern.pattern_data = pattern_data or {}
            pattern.evidence_count += 1
            pattern.confidence = min(1.0, pattern.confidence + confidence_increment)
            pattern.last_observed_at = utcnow_naive()
            pattern.updated_at = utcnow_naive()
        else:
            # 创建新模式
            pattern = UserLearningPattern(
                user_id=user_id,
                pattern_type=pattern_type,
                pattern_description=pattern_description,
                pattern_data=pattern_data or {},
                confidence=0.5,
                evidence_count=1,
                first_observed_at=utcnow_naive(),
                last_observed_at=utcnow_naive()
            )
            db.add(pattern)
        
        await db.flush()
        return pattern
    

    
    @staticmethod
    async def get_recent_behaviors(
        db: AsyncSession,
        user_id: uuid.UUID,
        limit: int = 20,
        behavior_type: Optional[str] = None
    ) -> List[UserBehaviorMemory]:
        """
        获取最近的用户行为记录
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            limit: 返回数量限制
            behavior_type: 行为类型过滤
            
        Returns:
            行为记录列表
        """
        query = UserBehaviorMemory.__table__.select().where(
            UserBehaviorMemory.user_id == user_id
        )
        
        if behavior_type:
            query = query.where(UserBehaviorMemory.behavior_type == behavior_type)
        
        query = query.order_by(desc(UserBehaviorMemory.created_at)).limit(limit)
        
        result = await db.execute(query)
        return result.fetchall()
    
    @staticmethod
    async def get_all_preferences(
        db: AsyncSession,
        user_id: uuid.UUID,
        min_confidence: float = 0.0
    ) -> List[UserPreferenceMemory]:
        """
        获取用户的所有偏好设置
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            min_confidence: 最小置信度过滤
            
        Returns:
            偏好记录列表
        """
        query = UserPreferenceMemory.__table__.select().where(
            and_(
                UserPreferenceMemory.user_id == user_id,
                UserPreferenceMemory.confidence_score >= min_confidence
            )
        ).order_by(desc(UserPreferenceMemory.confidence_score))
        
        result = await db.execute(query)
        return result.fetchall()
    
    @staticmethod
    async def cleanup_expired_context(db: AsyncSession) -> int:
        """
        清理过期的上下文数据
        
        Args:
            db: 数据库会话
            
        Returns:
            删除的记录数量
        """
        result = await db.execute(
            UserContextMemory.__table__.delete().where(
                and_(
                    UserContextMemory.expires_at.isnot(None),
                    UserContextMemory.expires_at < utcnow_naive()
                )
            )
        )
        await db.flush()
        return result.rowcount
    
    @staticmethod
    async def get_relevant_memories(
        db: AsyncSession,
        user_id: uuid.UUID,
        current_context: Dict[str, Any],
        limit: int = 5
    ) -> Dict[str, Any]:
        """
        检索与当前场景相关的用户记忆
        
        综合行为、偏好、交互历史和学习模式,为AI提供上下文。
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            current_context: 当前上下文 (如node_code, exercise_id等)
            limit: 每类记忆的返回数量
            
        Returns:
            包含各类相关记忆的字典
        """
        memories = {
            "recent_behaviors": [],
            "preferences": [],
            "learning_patterns": [],
            "context": []
        }
        
        # 获取最近行为
        behaviors = await UserMemoryService.get_recent_behaviors(db, user_id, limit=limit)
        memories["recent_behaviors"] = [
            {
                "type": b.behavior_type,
                "context": b.context,
                "event_metadata": b.event_metadata,
                "time": b.created_at.isoformat()
            }
            for b in behaviors
        ]
        
        # 获取偏好 (只返回高置信度的)
        preferences = await UserMemoryService.get_all_preferences(db, user_id, min_confidence=0.7)
        memories["preferences"] = [
            {
                "key": p.preference_key,
                "value": p.preference_value,
                "confidence": p.confidence_score
            }
            for p in preferences
        ]
        

        
        # 获取学习模式
        patterns = await UserMemoryService.get_user_patterns(db, user_id, min_confidence=0.7)
        memories["learning_patterns"] = [
            {
                "type": p.pattern_type,
                "description": p.pattern_description,
                "data": p.pattern_data,
                "confidence": p.confidence
            }
            for p in patterns
        ]
        
        # 获取上下文
        contexts = await UserMemoryService.get_recent_context(db, user_id, limit=limit)
        memories["context"] = [
            {
                "type": c.context_type,
                "data": c.context_data
            }
            for c in contexts
        ]
        
        return memories
