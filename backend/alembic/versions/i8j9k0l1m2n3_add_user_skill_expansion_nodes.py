"""add user skill expansion nodes

Revision ID: i8j9k0l1m2n3
Revises: h7i8j9k0l1m2
Create Date: 2026-03-14 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "i8j9k0l1m2n3"
down_revision: Union[str, None] = "h7i8j9k0l1m2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    if not _has_table("user_subject_skill_expansion_node"):
        op.create_table(
            "user_subject_skill_expansion_node",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("subject_key", sa.String(length=64), nullable=False),
            sa.Column("parent_node_id", sa.String(length=255), nullable=False),
            sa.Column("node_id", sa.String(length=255), nullable=False),
            sa.Column("label", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("tags", sa.JSON(), nullable=False),
            sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "idx_user_subject_skill_expansion_parent",
            "user_subject_skill_expansion_node",
            ["user_id", "subject_key", "parent_node_id"],
            unique=False,
        )
        op.create_index(
            "idx_user_subject_skill_expansion_node",
            "user_subject_skill_expansion_node",
            ["user_id", "subject_key", "node_id"],
            unique=True,
        )


def downgrade() -> None:
    if _has_table("user_subject_skill_expansion_node"):
        op.drop_index("idx_user_subject_skill_expansion_node", table_name="user_subject_skill_expansion_node")
        op.drop_index("idx_user_subject_skill_expansion_parent", table_name="user_subject_skill_expansion_node")
        op.drop_table("user_subject_skill_expansion_node")
