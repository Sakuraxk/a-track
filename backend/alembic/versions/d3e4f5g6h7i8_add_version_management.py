"""add version management to user_learning_paths

Revision ID: d3e4f5g6h7i8
Revises: c2d3e4f5g6h7
Create Date: 2026-02-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d3e4f5g6h7i8"
down_revision: Union[str, None] = "c2d3e4f5g6h7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 添加版本管理字段
    op.add_column('user_learning_paths',
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('user_learning_paths',
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('user_learning_paths',
        sa.Column('version_name', sa.String(length=100), nullable=True))
    op.add_column('user_learning_paths',
        sa.Column('archived_at', sa.DateTime(), nullable=True))

    # 创建索引
    op.create_index('idx_user_subject_active', 'user_learning_paths',
                    ['user_id', 'subject_key', 'is_active'], unique=False)
    op.create_index('idx_user_subject_version', 'user_learning_paths',
                    ['user_id', 'subject_key', 'version'], unique=False)


def downgrade() -> None:
    # 删除索引
    op.drop_index('idx_user_subject_version', table_name='user_learning_paths')
    op.drop_index('idx_user_subject_active', table_name='user_learning_paths')

    # 删除字段
    op.drop_column('user_learning_paths', 'archived_at')
    op.drop_column('user_learning_paths', 'version_name')
    op.drop_column('user_learning_paths', 'is_active')
    op.drop_column('user_learning_paths', 'version')
