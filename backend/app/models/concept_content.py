"""
概念学习内容缓存模型
用于存储AI生成的概念学习文档，避免重复生成
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String, Text, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, utcnow_naive


class ConceptContent(Base):
    """
    缓存AI生成的概念学习内容
    
    每个用户的每个任务对应一条记录，内容生成后保存到此表，
    下次访问时直接读取，无需重新生成。
    """
    __tablename__ = "concept_contents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    task_id = Column(String(64), index=True, nullable=False)  # 任务ID
    task_title = Column(String(255), nullable=False)
    subject = Column(String(64), nullable=True)
    learning_path_id = Column(String(64), nullable=True)
    learning_path_version = Column(Integer, nullable=True)
    learning_path_version_name = Column(String(100), nullable=True)
    source_day = Column(Integer, nullable=True)
    source_chapter_id = Column(String(64), nullable=True)
    source_chapter_title = Column(String(255), nullable=True)
    source_task_title = Column(String(255), nullable=True)
    source_scope_key = Column(String(255), nullable=True)
    
    content = Column(Text, nullable=True)      # Markdown 内容
    reasoning = Column(Text, nullable=True)    # AI 思维过程（可选）
    
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    __table_args__ = (
        UniqueConstraint("user_id", "source_scope_key", name="uq_concept_contents_scope"),
        Index("ix_concept_contents_scope", "user_id", "source_scope_key"),
    )
