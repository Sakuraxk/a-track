"""
用户记忆管理API路由

提供用户查看和管理自己的长期记忆数据的接口,
以及供系统内部调用的记忆记录接口。
"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.services.user_memory_service import UserMemoryService
from app.schemas.user_memory import (
    BehaviorMemoryCreate,
    BehaviorMemoryResponse,
    PreferenceMemoryCreate,
    PreferenceMemoryResponse,
    LearningPatternResponse,
    UserContextResponse,
    ContextMemoryCreate,
    RelevantMemoriesRequest,
    RelevantMemoriesResponse,
    BehaviorListResponse,
    PreferenceListResponse,
    PatternListResponse
)

router = APIRouter(prefix="/api/user-memory", tags=["用户记忆"])


# ========== 用户端API ========== #

@router.get("/behaviors", response_model=BehaviorListResponse)
async def get_my_behaviors(
    limit: int = 20,
    behavior_type: Optional[str] = None,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    查看自己的行为历史
    
    - **limit**: 返回数量限制
    - **behavior_type**: 行为类型过滤
    """
    behaviors = await UserMemoryService.get_recent_behaviors(
        db, current_user_id, limit=limit, behavior_type=behavior_type
    )
    
    return BehaviorListResponse(
        behaviors=[BehaviorMemoryResponse.model_validate(b) for b in behaviors],
        total=len(behaviors)
    )


@router.get("/preferences", response_model=PreferenceListResponse)
async def get_my_preferences(
    min_confidence: float = 0.0,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    查看自己的学习偏好
    
    - **min_confidence**: 最小置信度过滤
    """
    preferences = await UserMemoryService.get_all_preferences(
        db, current_user_id, min_confidence=min_confidence
    )
    
    return PreferenceListResponse(
        preferences=[PreferenceMemoryResponse.model_validate(p) for p in preferences],
        total=len(preferences)
    )




@router.get("/patterns", response_model=PatternListResponse)
async def get_my_patterns(
    min_confidence: float = 0.6,
    pattern_type: Optional[str] = None,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    查看自己的学习模式
    
    - **min_confidence**: 最小置信度过滤
    - **pattern_type**: 模式类型过滤
    """
    patterns = await UserMemoryService.get_user_patterns(
        db, current_user_id, pattern_type=pattern_type, min_confidence=min_confidence
    )
    
    return PatternListResponse(
        patterns=[LearningPatternResponse.model_validate(p) for p in patterns],
        total=len(patterns)
    )




@router.delete("/clear")
async def clear_my_memories(
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    清除自己的所有记忆数据 (隐私保护)
    
    警告: 此操作不可逆!
    """
    from app.models.user_memory import (
        UserBehaviorMemory,
        UserPreferenceMemory,
        UserLearningPattern,
        UserContextMemory
    )
    
    # 删除所有记忆数据
    await db.execute(
        UserBehaviorMemory.__table__.delete().where(
            UserBehaviorMemory.user_id == current_user_id
        )
    )
    await db.execute(
        UserPreferenceMemory.__table__.delete().where(
            UserPreferenceMemory.user_id == current_user_id
        )
    )
    await db.execute(
        UserLearningPattern.__table__.delete().where(
            UserLearningPattern.user_id == current_user_id
        )
    )
    await db.execute(
        UserContextMemory.__table__.delete().where(
            UserContextMemory.user_id == current_user_id
        )
    )
    
    await db.commit()
    
    return {"success": True, "message": "所有记忆数据已清除"}


# ========== 内部API (供其他模块调用) ========== #

@router.post("/internal/record-behavior", response_model=BehaviorMemoryResponse, include_in_schema=False)
async def record_behavior_internal(
    request: BehaviorMemoryCreate,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    内部接口: 记录用户行为事件
    """
    behavior = await UserMemoryService.record_behavior(
        db,
        current_user_id,
        request.behavior_type,
        request.context,
        request.event_metadata
    )
    
    return BehaviorMemoryResponse.model_validate(behavior)


@router.post("/internal/update-preference", response_model=PreferenceMemoryResponse, include_in_schema=False)
async def update_preference_internal(
    request: PreferenceMemoryCreate,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    内部接口: 更新用户偏好
    """
    preference = await UserMemoryService.update_preference(
        db,
        current_user_id,
        request.preference_key,
        request.preference_value
    )
    
    return PreferenceMemoryResponse.model_validate(preference)




@router.post("/internal/set-context", response_model=UserContextResponse, include_in_schema=False)
async def set_context_internal(
    request: ContextMemoryCreate,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    内部接口: 设置用户上下文
    """
    context = await UserMemoryService.set_context(
        db,
        current_user_id,
        request.context_type,
        request.context_data,
        request.ttl_hours
    )
    
    return UserContextResponse.model_validate(context)


@router.post("/internal/get-relevant-memories", response_model=RelevantMemoriesResponse, include_in_schema=False)
async def get_relevant_memories_internal(
    request: RelevantMemoriesRequest,
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    内部接口: 获取与当前场景相关的用户记忆
    
    供AI导师等模块调用,提供上下文感知能力。
    """
    memories = await UserMemoryService.get_relevant_memories(
        db,
        current_user_id,
        request.current_context,
        request.limit
    )
    
    return RelevantMemoriesResponse(**memories)
