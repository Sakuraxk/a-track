"""add_multi_subject_tables

Revision ID: 4a5b6c7d8e9f
Revises: ac780ae36564
Create Date: 2025-01-05 10:00:00.000000

This migration adds support for multi-subject learning:
- subjects: 学科表
- chapters: 章节表
- exercise_items: 题目表（支持多题型）
- user_subject_profiles: 用户学科档案
- user_node_masteries: 用户知识点掌握度
- attempts: 作答记录

Also modifies knowledge_nodes to add subject_id and chapter_id.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '4a5b6c7d8e9f'
down_revision: Union[str, None] = 'ac780ae36564'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create subjects table
    op.create_table('subjects',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('key', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('icon', sa.String(length=255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key')
    )
    op.create_index(op.f('ix_subjects_key'), 'subjects', ['key'], unique=True)

    # 2. Create chapters table
    op.create_table('chapters',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('subject_id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(length=64), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('subject_id', 'code', name='uq_chapter_subject_code')
    )
    op.create_index(op.f('ix_chapters_subject_id'), 'chapters', ['subject_id'], unique=False)
    op.create_index(op.f('ix_chapters_code'), 'chapters', ['code'], unique=False)
    op.create_index('ix_chapter_subject_order', 'chapters', ['subject_id', 'order_index'], unique=False)

    # 3. Modify knowledge_nodes table - add subject_id, chapter_id, and new fields
    op.add_column('knowledge_nodes', sa.Column('subject_id', sa.UUID(), nullable=True))
    op.add_column('knowledge_nodes', sa.Column('chapter_id', sa.UUID(), nullable=True))
    op.add_column('knowledge_nodes', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('knowledge_nodes', sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('knowledge_nodes', sa.Column('created_at', sa.DateTime(), nullable=True))
    op.add_column('knowledge_nodes', sa.Column('updated_at', sa.DateTime(), nullable=True))

    op.create_index(op.f('ix_knowledge_nodes_subject_id'), 'knowledge_nodes', ['subject_id'], unique=False)
    op.create_index(op.f('ix_knowledge_nodes_chapter_id'), 'knowledge_nodes', ['chapter_id'], unique=False)
    op.create_index(op.f('ix_knowledge_nodes_code'), 'knowledge_nodes', ['code'], unique=False)

    op.create_foreign_key(
        'fk_knowledge_nodes_subject_id',
        'knowledge_nodes', 'subjects',
        ['subject_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_knowledge_nodes_chapter_id',
        'knowledge_nodes', 'chapters',
        ['chapter_id'], ['id'],
        ondelete='SET NULL'
    )

    # 4. Create exercise_items table
    op.create_table('exercise_items',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('subject_id', sa.UUID(), nullable=False),
        sa.Column('knowledge_node_id', sa.UUID(), nullable=True),
        sa.Column('chapter_id', sa.UUID(), nullable=True),
        sa.Column('source_annotation', sa.String(length=255), nullable=True),
        sa.Column('item_type', sa.String(length=32), nullable=False),
        sa.Column('stem', sa.Text(), nullable=False),
        sa.Column('options', sa.JSON(), nullable=True),
        sa.Column('answer_key', sa.JSON(), nullable=True),
        sa.Column('rubric', sa.JSON(), nullable=True),
        sa.Column('hints', sa.JSON(), nullable=True),
        sa.Column('initial_code', sa.Text(), nullable=True),
        sa.Column('expected_output', sa.Text(), nullable=True),
        sa.Column('test_cases', sa.JSON(), nullable=True),
        sa.Column('difficulty', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('estimated_seconds', sa.Integer(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('llm_generation_meta', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['knowledge_node_id'], ['knowledge_nodes.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_exercise_items_subject_id'), 'exercise_items', ['subject_id'], unique=False)
    op.create_index(op.f('ix_exercise_items_knowledge_node_id'), 'exercise_items', ['knowledge_node_id'], unique=False)
    op.create_index(op.f('ix_exercise_items_chapter_id'), 'exercise_items', ['chapter_id'], unique=False)
    op.create_index(op.f('ix_exercise_items_item_type'), 'exercise_items', ['item_type'], unique=False)

    # 5. Create user_subject_profiles table
    op.create_table('user_subject_profiles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('subject_id', sa.UUID(), nullable=False),
        sa.Column('level', sa.String(length=32), nullable=True),
        sa.Column('pace_preference', sa.String(length=32), nullable=True),
        sa.Column('goal', sa.Text(), nullable=True),
        sa.Column('onboarding_status', sa.String(length=32), nullable=False, server_default='not_started'),
        sa.Column('diagnostic_summary', sa.JSON(), nullable=True),
        sa.Column('ability_tags', sa.JSON(), nullable=True),
        sa.Column('active_learning_path_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'subject_id', name='uq_user_subject_profile')
    )
    op.create_index(op.f('ix_user_subject_profiles_user_id'), 'user_subject_profiles', ['user_id'], unique=False)
    op.create_index(op.f('ix_user_subject_profiles_subject_id'), 'user_subject_profiles', ['subject_id'], unique=False)

    # 6. Create user_node_masteries table
    op.create_table('user_node_masteries',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('knowledge_node_id', sa.UUID(), nullable=False),
        sa.Column('mastery', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='locked'),
        sa.Column('practice_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('correct_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_practiced_at', sa.DateTime(), nullable=True),
        sa.Column('evidence', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['knowledge_node_id'], ['knowledge_nodes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'knowledge_node_id', name='uq_user_node_mastery')
    )
    op.create_index(op.f('ix_user_node_masteries_user_id'), 'user_node_masteries', ['user_id'], unique=False)
    op.create_index(op.f('ix_user_node_masteries_knowledge_node_id'), 'user_node_masteries', ['knowledge_node_id'], unique=False)

    # 7. Create attempts table
    op.create_table('attempts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('exercise_item_id', sa.UUID(), nullable=False),
        sa.Column('response', sa.JSON(), nullable=True),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('scoring_method', sa.String(length=32), nullable=True),
        sa.Column('llm_score_detail', sa.JSON(), nullable=True),
        sa.Column('execution_result', sa.JSON(), nullable=True),
        sa.Column('execution_time_ms', sa.Integer(), nullable=True),
        sa.Column('feedback', sa.Text(), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['exercise_item_id'], ['exercise_items.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_attempts_user_id'), 'attempts', ['user_id'], unique=False)
    op.create_index(op.f('ix_attempts_exercise_item_id'), 'attempts', ['exercise_item_id'], unique=False)
    op.create_index('ix_attempt_user_exercise', 'attempts', ['user_id', 'exercise_item_id'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index('ix_attempt_user_exercise', table_name='attempts')
    op.drop_index(op.f('ix_attempts_exercise_item_id'), table_name='attempts')
    op.drop_index(op.f('ix_attempts_user_id'), table_name='attempts')
    op.drop_table('attempts')

    op.drop_index(op.f('ix_user_node_masteries_knowledge_node_id'), table_name='user_node_masteries')
    op.drop_index(op.f('ix_user_node_masteries_user_id'), table_name='user_node_masteries')
    op.drop_table('user_node_masteries')

    op.drop_index(op.f('ix_user_subject_profiles_subject_id'), table_name='user_subject_profiles')
    op.drop_index(op.f('ix_user_subject_profiles_user_id'), table_name='user_subject_profiles')
    op.drop_table('user_subject_profiles')

    op.drop_index(op.f('ix_exercise_items_item_type'), table_name='exercise_items')
    op.drop_index(op.f('ix_exercise_items_chapter_id'), table_name='exercise_items')
    op.drop_index(op.f('ix_exercise_items_knowledge_node_id'), table_name='exercise_items')
    op.drop_index(op.f('ix_exercise_items_subject_id'), table_name='exercise_items')
    op.drop_table('exercise_items')

    # Remove foreign keys and columns from knowledge_nodes
    op.drop_constraint('fk_knowledge_nodes_chapter_id', 'knowledge_nodes', type_='foreignkey')
    op.drop_constraint('fk_knowledge_nodes_subject_id', 'knowledge_nodes', type_='foreignkey')
    op.drop_index(op.f('ix_knowledge_nodes_code'), table_name='knowledge_nodes')
    op.drop_index(op.f('ix_knowledge_nodes_chapter_id'), table_name='knowledge_nodes')
    op.drop_index(op.f('ix_knowledge_nodes_subject_id'), table_name='knowledge_nodes')
    op.drop_column('knowledge_nodes', 'updated_at')
    op.drop_column('knowledge_nodes', 'created_at')
    op.drop_column('knowledge_nodes', 'order_index')
    op.drop_column('knowledge_nodes', 'description')
    op.drop_column('knowledge_nodes', 'chapter_id')
    op.drop_column('knowledge_nodes', 'subject_id')

    op.drop_index('ix_chapter_subject_order', table_name='chapters')
    op.drop_index(op.f('ix_chapters_code'), table_name='chapters')
    op.drop_index(op.f('ix_chapters_subject_id'), table_name='chapters')
    op.drop_table('chapters')

    op.drop_index(op.f('ix_subjects_key'), table_name='subjects')
    op.drop_table('subjects')
