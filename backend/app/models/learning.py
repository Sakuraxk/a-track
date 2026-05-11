import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, utcnow_naive


class KnowledgeNode(Base):
    """
    知识点表 - 支持多学科

    每个知识点属于一个学科，可选属于一个章节。
    前置关系通过 prerequisites JSON 字段存储（存储 code 列表）。

    注意：code 字段保持全局唯一，建议使用 "subject.category.name" 格式
    例如：python.basics.print, math.calculus.derivative
    """

    __tablename__ = "knowledge_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Subject and chapter references
    # subject_id 默认为 Python 学科的 ID（向后兼容）
    subject_id = Column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        index=True,
        nullable=True,  # Nullable for backward compatibility during migration
    )
    chapter_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chapters.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )

    # code 保持全局唯一，使用命名空间前缀区分学科
    code = Column(String(64), unique=True, index=True, nullable=False)  # e.g., "python.loops.for_basic"
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    difficulty = Column(Integer, default=1)
    duration_minutes = Column(Integer, default=10)
    prerequisites = Column(JSON, nullable=True)  # list of prerequisite node codes
    attributes = Column(JSON, nullable=True)  # arbitrary metadata (tags, objective)
    order_index = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)


class UserNodeState(Base):
    __tablename__ = "user_node_states"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    node_code = Column(String(64), index=True, nullable=False)
    status = Column(String(32), default="not_started")  # not_started|in_progress|mastered|review
    mastery = Column(Integer, default=0)  # 0-100
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
    latest_errors = Column(JSON, nullable=True)  # recent error tags for adaptive logic


class LearningTask(Base):
    __tablename__ = "learning_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    task_type = Column(String(32), nullable=False)  # e.g., daily_plan, weekly_goal
    payload = Column(JSON, nullable=True)  # list of nodes/exercises
    due_date = Column(DateTime, nullable=True)
    status = Column(String(32), default="pending")  # pending|in_progress|done
    created_at = Column(DateTime, default=utcnow_naive)
