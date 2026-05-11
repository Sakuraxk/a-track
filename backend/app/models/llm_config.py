"""
LLM配置和对话相关的数据模型
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import relationship

from app.models.base import Base, utcnow_naive


def generate_uuid():
    """生成UUID字符串"""
    return str(uuid.uuid4())


class UserLLMConfig(Base):
    """用户的LLM配置（支持多模型角色）"""
    __tablename__ = "user_llm_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)

    # 模型角色: explainer | coder | reviewer
    model_role = Column(String(32), nullable=False)

    # API配置
    api_base_url = Column(String(512), nullable=False)
    api_key_encrypted = Column(Text, nullable=False)  # 加密存储
    model_name = Column(String(128), nullable=False)

    # 高级参数（存储为整数，避免浮点精度问题）
    temperature = Column(Integer, default=70)  # 实际值 * 100，如 0.7 -> 70
    max_tokens = Column(Integer, default=2048)
    timeout_seconds = Column(Integer, default=30)

    # 状态
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    def __repr__(self):
        return f"<UserLLMConfig(user_id={self.user_id}, role={self.model_role}, model={self.model_name})>"


class ConversationSession(Base):
    """AI对话会话"""
    __tablename__ = "conversation_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)

    # 会话信息
    title = Column(String(255), nullable=True)
    role = Column(String(32), default="explainer")  # explainer | code_reviewer

    # 关联的学习上下文
    knowledge_node_code = Column(String(64), nullable=True)  # 当前学习节点
    exercise_id = Column(UUID(as_uuid=True), nullable=True)  # 关联的题目ID
    scope_type = Column(String(32), nullable=True, index=True)  # concept | practice | global
    scope_id = Column(String(128), nullable=True, index=True)

    # 状态
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    # 关系
    messages = relationship("ConversationMessage", back_populates="session", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ConversationSession(id={self.id}, user_id={self.user_id}, role={self.role})>"


class ConversationMessage(Base):
    """对话消息历史"""
    __tablename__ = "conversation_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("conversation_sessions.id"), index=True, nullable=False)

    # 消息内容
    role = Column(String(16), nullable=False)  # user | assistant | system
    content = Column(Text, nullable=False)

    # 元数据
    model_used = Column(String(128), nullable=True)
    tokens_used = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=utcnow_naive)

    # 关系
    session = relationship("ConversationSession", back_populates="messages")

    def __repr__(self):
        return f"<ConversationMessage(id={self.id}, role={self.role})>"
