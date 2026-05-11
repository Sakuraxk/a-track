"""add community_notifications and community_comment_likes tables

Revision ID: m2n3o4p5q6r7
Revises: l1m2n3o4p5q6
Create Date: 2026-04-27 12:30:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "m2n3o4p5q6r7"
down_revision = "l1m2n3o4p5q6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- community_comment_likes ---
    op.create_table(
        "community_comment_likes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("comment_id", UUID(as_uuid=True),
                  sa.ForeignKey("community_comments.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.UniqueConstraint("comment_id", "user_id", name="uq_community_comment_likes_comment_user"),
    )
    op.create_index("ix_community_comment_likes_comment_id", "community_comment_likes", ["comment_id"])
    op.create_index("ix_community_comment_likes_user_id", "community_comment_likes", ["user_id"])

    # --- community_notifications ---
    op.create_table(
        "community_notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("recipient_id", UUID(as_uuid=True), nullable=False),
        sa.Column("actor_id", UUID(as_uuid=True), nullable=False),
        sa.Column("notification_type", sa.String(50), nullable=False),
        sa.Column("post_id", UUID(as_uuid=True),
                  sa.ForeignKey("community_posts.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("comment_id", UUID(as_uuid=True),
                  sa.ForeignKey("community_comments.id", ondelete="CASCADE"),
                  nullable=True),
        sa.Column("post_title", sa.String(200), nullable=True),
        sa.Column("comment_preview", sa.String(200), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_community_notifications_recipient_id", "community_notifications", ["recipient_id"])
    op.create_index("ix_community_notifications_recipient_read", "community_notifications", ["recipient_id", "is_read"])
    op.create_index("ix_community_notifications_created_at", "community_notifications", ["created_at"])


def downgrade() -> None:
    op.drop_table("community_notifications")
    op.drop_table("community_comment_likes")
