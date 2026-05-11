"""add_subject_key_to_user_learning_paths

Revision ID: c2d3e4f5g6h7
Revises: b1c2d3e4f5g6
Create Date: 2026-02-07 10:00:00.000000

Add subject_key column to user_learning_paths for multi-subject support.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c2d3e4f5g6h7"
down_revision: Union[str, None] = "b1c2d3e4f5g6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_learning_paths",
        sa.Column("subject_key", sa.String(length=50), nullable=False, server_default="python"),
    )
    op.create_index(
        op.f("ix_user_learning_paths_subject_key"),
        "user_learning_paths",
        ["subject_key"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_learning_paths_subject_key"), table_name="user_learning_paths")
    op.drop_column("user_learning_paths", "subject_key")
