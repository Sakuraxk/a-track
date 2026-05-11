"""add users.last_login column

Revision ID: g6h7i8j9k0l1
Revises: f5g6h7i8j9k0
Create Date: 2026-02-27 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "g6h7i8j9k0l1"
down_revision: Union[str, None] = "f5g6h7i8j9k0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col["name"] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    if not _has_column("users", "last_login"):
        op.add_column("users", sa.Column("last_login", sa.DateTime(), nullable=True))


def downgrade() -> None:
    if _has_column("users", "last_login"):
        op.drop_column("users", "last_login")
