"""add learning source scope fields

Revision ID: j9k0l1m2n3o4
Revises: i8j9k0l1m2n3
Create Date: 2026-03-15 04:12:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "j9k0l1m2n3o4"
down_revision = "i8j9k0l1m2n3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("question_groups") as batch_op:
        batch_op.add_column(sa.Column("learning_path_id", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("learning_path_version", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("learning_path_version_name", sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column("source_day", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("source_chapter_id", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("source_chapter_title", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("source_task_title", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("source_scope_key", sa.String(length=255), nullable=True))
        batch_op.drop_constraint("uq_question_groups_source", type_="unique")
        batch_op.create_unique_constraint(
            "uq_question_groups_source_scope",
            ["user_id", "source_type", "source_scope_key"],
        )
        batch_op.create_index("ix_question_groups_scope", ["source_type", "source_scope_key"], unique=False)

    with op.batch_alter_table("concept_contents") as batch_op:
        batch_op.add_column(sa.Column("learning_path_id", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("learning_path_version", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("learning_path_version_name", sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column("source_day", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("source_chapter_id", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("source_chapter_title", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("source_task_title", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("source_scope_key", sa.String(length=255), nullable=True))
        batch_op.create_unique_constraint(
            "uq_concept_contents_scope",
            ["user_id", "source_scope_key"],
        )
        batch_op.create_index("ix_concept_contents_scope", ["user_id", "source_scope_key"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("concept_contents") as batch_op:
        batch_op.drop_index("ix_concept_contents_scope")
        batch_op.drop_constraint("uq_concept_contents_scope", type_="unique")
        batch_op.drop_column("source_scope_key")
        batch_op.drop_column("source_task_title")
        batch_op.drop_column("source_chapter_title")
        batch_op.drop_column("source_chapter_id")
        batch_op.drop_column("source_day")
        batch_op.drop_column("learning_path_version_name")
        batch_op.drop_column("learning_path_version")
        batch_op.drop_column("learning_path_id")

    with op.batch_alter_table("question_groups") as batch_op:
        batch_op.drop_index("ix_question_groups_scope")
        batch_op.drop_constraint("uq_question_groups_source_scope", type_="unique")
        batch_op.create_unique_constraint(
            "uq_question_groups_source",
            ["user_id", "source_type", "source_task_id"],
        )
        batch_op.drop_column("source_scope_key")
        batch_op.drop_column("source_task_title")
        batch_op.drop_column("source_chapter_title")
        batch_op.drop_column("source_chapter_id")
        batch_op.drop_column("source_day")
        batch_op.drop_column("learning_path_version_name")
        batch_op.drop_column("learning_path_version")
        batch_op.drop_column("learning_path_id")
