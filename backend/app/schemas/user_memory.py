"""
用户记忆相关的Pydantic Schema定义
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
import uuid


# ========== 行为记忆 ========== #

class BehaviorMemoryCreate(BaseModel):
    """创建行为记忆请求"""
    behavior_type: str = Field(..., description="行为类型")
    context: Optional[str] = Field(None, description="上下文描述")
    event_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="元数据")


class BehaviorMemoryResponse(BaseModel):
    """行为记忆响应"""
    id: uuid.UUID
    user_id: uuid.UUID
    behavior_type: str
    context: Optional[str]
    event_metadata: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


# ========== 偏好记忆 ========== #

class PreferenceMemoryCreate(BaseModel):
    """创建偏好记忆请求"""
    preference_key: str = Field(..., description="偏好类型")
    preference_value: str = Field(..., description="偏好值")


class PreferenceMemoryResponse(BaseModel):
    """偏好记忆响应"""
    id: uuid.UUID
    user_id: uuid.UUID
    preference_key: str
    preference_value: str
    confidence_score: float
    evidence_count: int
    last_observed_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== 交互记忆 ========== #

class InteractionMemoryCreate(BaseModel):
    """创建交互记忆请求"""
    interaction_type: str = Field(..., description="交互类型")
    question: str = Field(..., description="用户问题")
    response: str = Field(..., description="AI回答")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="上下文信息")
    model_used: Optional[str] = Field(None, description="使用的模型")


class InteractionFeedback(BaseModel):
    """交互反馈"""
    is_helpful: bool = Field(..., description="是否有帮助")
    feedback_text: Optional[str] = Field(None, description="反馈文字")


class InteractionMemoryResponse(BaseModel):
    """交互记忆响应"""
    id: uuid.UUID
    user_id: uuid.UUID
    interaction_type: str
    question: str
    response: str
    context: Dict[str, Any]
    is_helpful: Optional[bool]
    feedback_text: Optional[str]
    model_used: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ========== 学习模式 ========== #

class LearningPatternCreate(BaseModel):
    """创建学习模式请求"""
    pattern_type: str = Field(..., description="模式类型")
    pattern_description: str = Field(..., description="模式描述")
    pattern_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="模式数据")


class LearningPatternResponse(BaseModel):
    """学习模式响应"""
    id: uuid.UUID
    user_id: uuid.UUID
    pattern_type: str
    pattern_description: str
    pattern_data: Dict[str, Any]
    evidence_count: int
    confidence: float
    first_observed_at: datetime
    last_observed_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== 上下文记忆 ========== #

class ContextMemoryCreate(BaseModel):
    """创建上下文记忆请求"""
    context_type: str = Field(..., description="上下文类型")
    context_data: Dict[str, Any] = Field(..., description="上下文数据")
    ttl_hours: Optional[int] = Field(None, description="过期时间(小时)")


class UserContextResponse(BaseModel):
    """上下文记忆响应"""
    id: uuid.UUID
    user_id: uuid.UUID
    context_type: str
    context_data: Dict[str, Any]
    expires_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== 综合记忆查询 ========== #

class RelevantMemoriesRequest(BaseModel):
    """相关记忆查询请求"""
    current_context: Dict[str, Any] = Field(..., description="当前上下文")
    limit: int = Field(5, ge=1, le=20, description="每类记忆返回数量")


class RelevantMemoriesResponse(BaseModel):
    """相关记忆查询响应"""
    recent_behaviors: List[Dict[str, Any]] = Field(default_factory=list)
    preferences: List[Dict[str, Any]] = Field(default_factory=list)
    recent_interactions: List[Dict[str, Any]] = Field(default_factory=list)
    learning_patterns: List[Dict[str, Any]] = Field(default_factory=list)
    context: List[Dict[str, Any]] = Field(default_factory=list)


# ========== 列表查询 ========== #

class MemoryListParams(BaseModel):
    """记忆列表查询参数"""
    limit: int = Field(20, ge=1, le=100, description="返回数量")
    offset: int = Field(0, ge=0, description="偏移量")
    type_filter: Optional[str] = Field(None, description="类型过滤")


class BehaviorListResponse(BaseModel):
    """行为记录列表响应"""
    behaviors: List[BehaviorMemoryResponse]
    total: int


class PreferenceListResponse(BaseModel):
    """偏好列表响应"""
    preferences: List[PreferenceMemoryResponse]
    total: int


class InteractionListResponse(BaseModel):
    """交互记录列表响应"""
    interactions: List[InteractionMemoryResponse]
    total: int


class PatternListResponse(BaseModel):
    """学习模式列表响应"""
    patterns: List[LearningPatternResponse]
    total: int
