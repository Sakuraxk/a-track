"""add conversation scope fields

Revision ID: h7i8j9k0l1m2
Revises: g6h7i8j9k0l1
Create Date: 2026-02-27 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "h7i8j9k0l1m2"
down_revision: Union[str, None] = "g6h7i8j9k0l1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column_name in [col["name"] for col in inspector.get_columns(table_name)]


def _has_index(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(idx["name"] == index_name for idx in inspector.get_indexes(table_name))


def upgrade() -> None:
    if not _has_column("conversation_sessions", "scope_type"):
        op.add_column(
            "conversation_sessions",
            sa.Column("scope_type", sa.String(length=32), nullable=True),
        )
    if not _has_column("conversation_sessions", "scope_id"):
        op.add_column(
            "conversation_sessions",
            sa.Column("scope_id", sa.String(length=128), nullable=True),
        )

    if not _has_index("conversation_sessions", "ix_conversation_sessions_scope_type"):
        op.create_index(
            "ix_conversation_sessions_scope_type",
            "conversation_sessions",
            ["scope_type"],
            unique=False,
        )
    if not _has_index("conversation_sessions", "ix_conversation_sessions_scope_id"):
        op.create_index(
            "ix_conversation_sessions_scope_id",
            "conversation_sessions",
            ["scope_id"],
            unique=False,
        )


def downgrade() -> None:
    if _has_index("conversation_sessions", "ix_conversation_sessions_scope_id"):
        op.drop_index("ix_conversation_sessions_scope_id", table_name="conversation_sessions")
    if _has_index("conversation_sessions", "ix_conversation_sessions_scope_type"):
        op.drop_index("ix_conversation_sessions_scope_type", table_name="conversation_sessions")

    if _has_column("conversation_sessions", "scope_id"):
        op.drop_column("conversation_sessions", "scope_id")
    if _has_column("conversation_sessions", "scope_type"):
        op.drop_column("conversation_sessions", "scope_type")
