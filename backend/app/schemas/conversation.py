"""
对话相关的Pydantic模型
"""
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from pydantic import BaseModel, Field


class ConversationContext(BaseModel):
    """对话上下文信息"""
    knowledge_node_code: Optional[str] = Field(
        default=None,
        description="当前学习的知识节点代码"
    )
    exercise_id: Optional[str] = Field(
        default=None,
        description="关联的练习题ID"
    )
    recent_errors: List[str] = Field(
        default_factory=list,
        description="用户最近的错误标签列表"
    )
    user_ability_tags: Dict[str, int] = Field(
        default_factory=dict,
        description="用户能力标签，如 {'syntax': 75, 'loops': 60}"
    )

    # ── 学习上下文（概念学习页面注入） ──
    selected_text: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="用户选中的文本（快捷提问时传入）"
    )
    section_title: Optional[str] = Field(
        default=None,
        max_length=200,
        description="选中文本所在的章节/小节标题"
    )
    chapter_summary: Optional[str] = Field(
        default=None,
        max_length=4000,
        description="当前正在学习的章节摘要（从 concept map 及 TOC 提炼）"
    )
    chapter_title: Optional[str] = Field(
        default=None,
        max_length=200,
        description="当前章节标题"
    )
    subject: Optional[str] = Field(
        default=None,
        max_length=100,
        description="当前学习学科名称"
    )
    task_id: Optional[str] = Field(
        default=None,
        max_length=128,
        description="当前学习任务 ID"
    )

    # ── 做题上下文（PracticeAIPanel 注入） ──
    question_stem: Optional[str] = Field(
        default=None,
        max_length=4000,
        description="当前正在做的题目内容（题干）"
    )
    question_type: Optional[str] = Field(
        default=None,
        max_length=50,
        description="题目类型（mcq/coding/fill_blank/short_answer/essay）"
    )


class ChatMessage(BaseModel):
    """单条消息"""
    role: str = Field(
        ...,
        pattern="^(user|assistant|system)$",
        description="消息角色"
    )
    content: str = Field(..., description="消息内容")
    created_at: Optional[datetime] = None


class ChatRequest(BaseModel):
    """聊天请求"""
    session_id: Optional[str] = Field(
        default=None,
        description="会话ID，新会话时为空"
    )
    message: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        description="用户消息内容"
    )

    # 角色选择（保留字段兼容旧前端，不再限制具体值）
    tutor_role: str = Field(
        default="explainer",
        description="AI导师角色标识（统一配置模式）"
    )

    # 上下文
    context: Optional[ConversationContext] = Field(
        default=None,
        description="学习上下文信息"
    )

    # 是否请求直接答案
    request_direct_answer: bool = Field(
        default=False,
        description="是否要求直接给出答案（默认为引导式回答）"
    )
    scope_type: Optional[Literal["concept", "practice", "global"]] = Field(
        default=None,
        description="会话范围类型"
    )
    scope_id: Optional[str] = Field(
        default=None,
        max_length=128,
        description="会话范围标识"
    )


class ChatResponse(BaseModel):
    """聊天响应"""
    session_id: str = Field(..., description="会话ID")
    message: str = Field(..., description="AI回复内容")

    # 引导性内容
    guidance_only: bool = Field(
        default=True,
        description="是否为引导式回答（非直接答案）"
    )
    hints: List[str] = Field(
        default_factory=list,
        description="学习提示列表"
    )
    follow_up_questions: List[str] = Field(
        default_factory=list,
        description="后续引导问题"
    )

    # 推荐的学习资源
    recommended_nodes: List[str] = Field(
        default_factory=list,
        description="推荐学习的知识节点"
    )

    # 元数据
    model_used: str = Field(..., description="使用的模型名称")
    tokens_used: Optional[int] = Field(
        default=None,
        description="消耗的token数量"
    )


class SessionCreate(BaseModel):
    """创建会话请求"""
    title: Optional[str] = Field(
        default=None,
        max_length=255,
        description="会话标题"
    )
    role: str = Field(
        default="explainer",
        description="AI导师角色标识"
    )
    context: Optional[ConversationContext] = None
    scope_type: Optional[Literal["concept", "practice", "global"]] = Field(
        default=None,
        description="会话范围类型"
    )
    scope_id: Optional[str] = Field(
        default=None,
        max_length=128,
        description="会话范围标识"
    )


class SessionResponse(BaseModel):
    """会话响应"""
    id: str
    user_id: str
    title: Optional[str]
    role: str
    knowledge_node_code: Optional[str]
    exercise_id: Optional[str]
    scope_type: Optional[Literal["concept", "practice", "global"]] = None
    scope_id: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    message_count: int = Field(default=0, description="消息数量")

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    """会话列表响应"""
    sessions: List[SessionResponse]
    total: int


class SessionHistoryResponse(BaseModel):
    """会话历史响应"""
    session: SessionResponse
    messages: List[ChatMessage]
