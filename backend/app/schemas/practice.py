from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class Exercise(BaseModel):
    id: UUID
    title: str
    exercise_type: str
    difficulty: int
    linked_nodes: List[str] = Field(default_factory=list)
    content: Dict[str, object] = Field(default_factory=dict)
    subject_key: str = "python"


class ExerciseRecommendationResponse(BaseModel):
    items: List[Exercise]
    rationale: str


class ExerciseResultSubmission(BaseModel):
    exercise_id: UUID
    # 前端可选传入 code，让后端完成判题与落库
    code: Optional[str] = Field(default=None, min_length=1, max_length=10000)
    timeout: int = Field(default=5, ge=1, le=120, description="判题执行超时时间(秒)")

    # 兼容旧前端：允许仍然传 status/score，由后端以判题结果覆盖（如提供了 code）
    status: str = "submitted"
    score: int = Field(default=0, ge=0, le=100)
    error_tags: List[str] = Field(default_factory=list)


class ExerciseSubmissionResponse(BaseModel):
    """提交结果的判题响应（用于前端展示正确/错误）"""

    success: bool
    status: str
    score: int
    output: str
    expected_output: Optional[str] = None
    error: Optional[str] = None
    execution_time_ms: int = 0
    error_tags: List[str] = Field(default_factory=list)


class Weakness(BaseModel):
    node_code: str
    error_tag: Optional[str] = None
    count: int


class CodeExecutionRequest(BaseModel):
    """代码执行请求"""
    code: str = Field(..., min_length=1, max_length=10000, description="要执行的Python代码")
    timeout: int = Field(default=5, ge=1, le=120, description="执行超时时间(秒)")


class CodeExecutionResponse(BaseModel):
    """代码执行响应"""
    success: bool
    output: str
    error: Optional[str] = None
    execution_time_ms: int
    images: List[str] = Field(default_factory=list, description="base64-encoded PNG images from matplotlib")
