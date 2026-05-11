"""Revision alias for historical databases.

Revision ID: ac780ae36564
Revises: 3c36242a9dbd
Create Date: 2026-01-03

This migration intentionally does nothing. It exists to keep compatibility with
databases that were previously stamped with revision `ac780ae36564`, while the
actual initial schema migration lives at `3c36242a9dbd`.
"""

from typing import Union

# revision identifiers, used by Alembic.
revision: str = "ac780ae36564"
down_revision: Union[str, None] = "3c36242a9dbd"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

