"""remove community seed data

Revision ID: l1m2n3o4p5q6
Revises: k0l1m2n3o4p5
Create Date: 2026-04-11 08:40:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "l1m2n3o4p5q6"
down_revision = "k0l1m2n3o4p5"
branch_labels = None
depends_on = None

# Demo post and comment UUIDs that were seeded in the previous migration
_DEMO_POST_IDS = [
    "00000000-0000-0000-0000-100000000001",
    "00000000-0000-0000-0000-100000000002",
    "00000000-0000-0000-0000-100000000003",
]

_DEMO_COMMENT_IDS = [
    "00000000-0000-0000-0000-200000000001",
    "00000000-0000-0000-0000-200000000002",
    "00000000-0000-0000-0000-200000000003",
    "00000000-0000-0000-0000-200000000004",
    "00000000-0000-0000-0000-200000000005",
    "00000000-0000-0000-0000-200000000006",
    "00000000-0000-0000-0000-200000000007",
]


def upgrade() -> None:
    """Delete all seeded demo posts, comments, and associated likes."""
    # Delete likes for demo posts first (foreign key constraint)
    for post_id in _DEMO_POST_IDS:
        op.execute(
            sa.text(f"DELETE FROM community_post_likes WHERE post_id = '{post_id}'")
        )

    # Delete demo comments (child replies first due to parent_id FK)
    for comment_id in reversed(_DEMO_COMMENT_IDS):
        op.execute(
            sa.text(f"DELETE FROM community_comments WHERE id = '{comment_id}'")
        )

    # Delete any remaining comments on demo posts
    for post_id in _DEMO_POST_IDS:
        op.execute(
            sa.text(f"DELETE FROM community_comments WHERE post_id = '{post_id}'")
        )

    # Delete demo posts
    for post_id in _DEMO_POST_IDS:
        op.execute(
            sa.text(f"DELETE FROM community_posts WHERE id = '{post_id}'")
        )


def downgrade() -> None:
    """Re-insert demo data is not supported. Community will start clean."""
    pass
