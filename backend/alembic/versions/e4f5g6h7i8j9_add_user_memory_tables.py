"""add user memory tables

Revision ID: e4f5g6h7i8j9
Revises: d3e4f5g6h7i8
Create Date: 2026-02-13 10:36:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'e4f5g6h7i8j9'
down_revision = 'd3e4f5g6h7i8'
branch_labels = None
depends_on = None


def upgrade():
    # 创建用户行为记忆表
    op.create_table(
        'user_behavior_memory',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('behavior_type', sa.String(64), nullable=False, index=True),
        sa.Column('context', sa.String(255), nullable=True),
        sa.Column('event_metadata', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    
    # 创建行为记忆表的复合索引
    op.create_index('idx_behavior_user_time', 'user_behavior_memory', ['user_id', 'created_at'])
    op.create_index('idx_behavior_user_type', 'user_behavior_memory', ['user_id', 'behavior_type'])
    
    # 创建用户偏好记忆表
    op.create_table(
        'user_preference_memory',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('preference_key', sa.String(128), nullable=False, index=True),
        sa.Column('preference_value', sa.Text(), nullable=False),
        sa.Column('confidence_score', sa.Float(), nullable=False, server_default='0.5'),
        sa.Column('evidence_count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('last_observed_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    
    # 创建偏好记忆表的复合索引
    op.create_index('idx_preference_user_key', 'user_preference_memory', ['user_id', 'preference_key'], unique=True)
    op.create_index('idx_preference_confidence', 'user_preference_memory', ['user_id', 'confidence_score'])
    
    # 创建用户交互记忆表
    op.create_table(
        'user_interaction_memory',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('interaction_type', sa.String(64), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('response', sa.Text(), nullable=False),
        sa.Column('context', postgresql.JSON, nullable=True),
        sa.Column('is_helpful', sa.Boolean(), nullable=True),
        sa.Column('feedback_text', sa.Text(), nullable=True),
        sa.Column('model_used', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    
    # 创建交互记忆表的索引
    op.create_index('idx_interaction_user_time', 'user_interaction_memory', ['user_id', 'created_at'])
    op.create_index('idx_interaction_user_helpful', 'user_interaction_memory', ['user_id', 'is_helpful'])
    
    # 创建学习模式总结表
    op.create_table(
        'user_learning_pattern',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('pattern_type', sa.String(64), nullable=False, index=True),
        sa.Column('pattern_description', sa.Text(), nullable=False),
        sa.Column('pattern_data', postgresql.JSON, nullable=True),
        sa.Column('evidence_count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('confidence', sa.Float(), nullable=False, server_default='0.5'),
        sa.Column('first_observed_at', sa.DateTime(), nullable=False),
        sa.Column('last_observed_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    
    # 创建学习模式表的索引
    op.create_index('idx_pattern_user_type', 'user_learning_pattern', ['user_id', 'pattern_type'])
    op.create_index('idx_pattern_confidence', 'user_learning_pattern', ['user_id', 'confidence'])
    
    # 创建上下文记忆表
    op.create_table(
        'user_context_memory',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('context_type', sa.String(64), nullable=False, index=True),
        sa.Column('context_data', postgresql.JSON, nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    
    # 创建上下文记忆表的索引
    op.create_index('idx_context_user_type', 'user_context_memory', ['user_id', 'context_type'])
    op.create_index('idx_context_user_expires', 'user_context_memory', ['user_id', 'expires_at'])


def downgrade():
    # 删除所有索引和表(逆序)
    op.drop_index('idx_context_user_expires', 'user_context_memory')
    op.drop_index('idx_context_user_type', 'user_context_memory')
    op.drop_table('user_context_memory')
    
    op.drop_index('idx_pattern_confidence', 'user_learning_pattern')
    op.drop_index('idx_pattern_user_type', 'user_learning_pattern')
    op.drop_table('user_learning_pattern')
    
    op.drop_index('idx_interaction_user_helpful', 'user_interaction_memory')
    op.drop_index('idx_interaction_user_time', 'user_interaction_memory')
    op.drop_table('user_interaction_memory')
    
    op.drop_index('idx_preference_confidence', 'user_preference_memory')
    op.drop_index('idx_preference_user_key', 'user_preference_memory')
    op.drop_table('user_preference_memory')
    
    op.drop_index('idx_behavior_user_type', 'user_behavior_memory')
    op.drop_index('idx_behavior_user_time', 'user_behavior_memory')
    op.drop_table('user_behavior_memory')
