"""backfill source_annotation for question_groups and exercise_items

Revision ID: f5g6h7i8j9k0
Revises: e4f5g6h7i8j9
Create Date: 2026-02-14 12:00:00.000000

"""
from alembic import op

revision = 'f5g6h7i8j9k0'
down_revision = 'e4f5g6h7i8j9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 回填 question_groups: concept_learning 类型中 annotation 为 NULL 或机器格式的记录
    op.execute(r"""
        UPDATE question_groups
        SET source_annotation = title
        WHERE title IS NOT NULL
          AND source_type = 'concept_learning'
          AND (source_annotation IS NULL
               OR source_annotation LIKE 'concept\_learning:%' ESCAPE '\')
    """)

    # 回填 exercise_items: 从关联的 concept_learning 题组继承 annotation
    op.execute(r"""
        UPDATE exercise_items ei
        SET source_annotation = qg.title
        FROM question_groups qg
        WHERE ei.question_group_id = qg.id
          AND qg.title IS NOT NULL
          AND qg.source_type = 'concept_learning'
          AND (ei.source_annotation IS NULL
               OR ei.source_annotation LIKE 'concept\_learning:%' ESCAPE '\')
    """)


def downgrade() -> None:
    pass
