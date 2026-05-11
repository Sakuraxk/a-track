"""add user skill tree snapshots

Revision ID: n3o4p5q6r7s8
Revises: m2n3o4p5q6r7
Create Date: 2026-04-27 18:50:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "n3o4p5q6r7s8"
down_revision: Union[str, None] = "m2n3o4p5q6r7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    if not _has_table("user_skill_tree_snapshot"):
        op.create_table(
            "user_skill_tree_snapshot",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("subject_key", sa.String(length=64), nullable=False),
            sa.Column("name", sa.String(length=128), nullable=False),
            sa.Column("base_version", sa.Integer(), nullable=False),
            sa.Column("tree_json", sa.JSON(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_user_skill_tree_snapshot_user_id",
            "user_skill_tree_snapshot",
            ["user_id"],
            unique=False,
        )
        op.create_index(
            "idx_user_snapshot_list",
            "user_skill_tree_snapshot",
            ["user_id", "subject_key"],
            unique=False,
        )
        op.create_index(
            "idx_user_snapshot_active",
            "user_skill_tree_snapshot",
            ["user_id", "subject_key"],
            unique=True,
            postgresql_where=sa.text("is_active = true"),
        )


def downgrade() -> None:
    if _has_table("user_skill_tree_snapshot"):
        op.drop_index("idx_user_snapshot_active", table_name="user_skill_tree_snapshot")
        op.drop_index("idx_user_snapshot_list", table_name="user_skill_tree_snapshot")
        op.drop_index("ix_user_skill_tree_snapshot_user_id", table_name="user_skill_tree_snapshot")
        op.drop_table("user_skill_tree_snapshot")
