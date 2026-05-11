"""社区通知模型 - 用于评论/回复通知"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, DateTime, ForeignKey, Integer, String, Text, Boolean,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class CommunityNotification(Base):
    """社区通知表 - 当有人评论或回复用户的帖子/评论时生成通知"""
    __tablename__ = "community_notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # 通知接收者
    recipient_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    # 触发通知的用户
    actor_id = Column(UUID(as_uuid=True), nullable=False)
    # 通知类型: comment_on_post, reply_to_comment
    notification_type = Column(String(50), nullable=False)
    # 关联的帖子
    post_id = Column(
        UUID(as_uuid=True),
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        nullable=False,
    )
    # 关联的评论（触发通知的那条评论）
    comment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("community_comments.id", ondelete="CASCADE"),
        nullable=True,
    )
    # 帖子标题（冗余存储，避免额外查询）
    post_title = Column(String(200), nullable=True)
    # 评论内容预览
    comment_preview = Column(String(200), nullable=True)
    # 是否已读
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_community_notifications_recipient_read", "recipient_id", "is_read"),
        Index("ix_community_notifications_created_at", "created_at"),
    )
