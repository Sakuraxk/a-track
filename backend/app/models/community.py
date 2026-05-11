import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, DateTime, ForeignKey, Integer, JSON, String, Text,
    UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class CommunityPost(Base):
    """社区帖子表"""
    __tablename__ = "community_posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(JSON, nullable=True, default=list)
    likes_count = Column(Integer, nullable=False, default=0)
    comments_count = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=True,
    )


class CommunityComment(Base):
    """社区评论表"""
    __tablename__ = "community_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(
        UUID(as_uuid=True),
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    content = Column(Text, nullable=False)
    parent_id = Column(
        UUID(as_uuid=True),
        ForeignKey("community_comments.id", ondelete="CASCADE"),
        nullable=True,
    )
    likes_count = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class CommunityPostLike(Base):
    """社区帖子点赞表"""
    __tablename__ = "community_post_likes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(
        UUID(as_uuid=True),
        ForeignKey("community_posts.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_community_post_likes_post_user"),
        Index("ix_community_post_likes_post_id", "post_id"),
        Index("ix_community_post_likes_user_id", "user_id"),
    )


class CommunityCommentLike(Base):
    """社区评论点赞表"""
    __tablename__ = "community_comment_likes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("community_comments.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("comment_id", "user_id", name="uq_community_comment_likes_comment_user"),
        Index("ix_community_comment_likes_comment_id", "comment_id"),
        Index("ix_community_comment_likes_user_id", "user_id"),
    )
