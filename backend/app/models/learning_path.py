import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Index, Integer, JSON, String
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, utcnow_naive


class UserLearningPath(Base):
    __tablename__ = "user_learning_paths"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    subject_key = Column(String(50), nullable=False, default="python", index=True)

    goal = Column(String(255), nullable=False)
    total_days = Column(Integer, nullable=False)
    daily_minutes = Column(Integer, nullable=False)

    # 完整学习路线结构（与 API 返回的 LearningPath 基本一致）
    data = Column(JSON, nullable=False)

    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    # 版本管理字段
    version = Column(Integer, nullable=False, default=1)  # 版本序号
    is_active = Column(Boolean, nullable=False, default=True, index=True)  # 是否激活
    version_name = Column(String(100), nullable=True)  # 版本名称（可选）
    archived_at = Column(DateTime, nullable=True)  # 归档时间（软删除）

    # 复合索引优化查询性能
    __table_args__ = (
        Index('idx_user_subject_active', 'user_id', 'subject_key', 'is_active'),
        Index('idx_user_subject_version', 'user_id', 'subject_key', 'version'),
    )

