"""question_bank_enhancements

Revision ID: b1c2d3e4f5g6
Revises: 4807d4a0a18a
Create Date: 2026-01-29 20:00:00.000000

New tables for enhanced question bank:
- question_groups: Group questions by source task
- user_exercise_progress: Track per-question progress
- user_question_group_stats: Track per-group statistics
- user_wrong_questions: Wrong answer collection
- user_practice_streaks: Daily practice streaks
- achievement_badges: Badge definitions
- user_achievements: User earned badges
- user_gamification_profiles: User level and XP
- question_recommendations: Smart recommendations cache
- exercise_hint_cache: AI hint cache
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b1c2d3e4f5g6"
down_revision: Union[str, None] = "4807d4a0a18a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Question Groups - group questions by source task
    op.create_table(
        "question_groups",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_task_id", sa.String(length=64), nullable=False),
        sa.Column("source_annotation", sa.String(length=255), nullable=True),
        sa.Column("subject_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("item_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "source_type", "source_task_id", name="uq_question_groups_source"
        ),
    )
    op.create_index("ix_question_groups_user_id", "question_groups", ["user_id"])
    op.create_index("ix_question_groups_subject_id", "question_groups", ["subject_id"])
    op.create_index(
        "ix_question_groups_source", "question_groups", ["source_type", "source_task_id"]
    )

    # Add columns to exercise_items for group association
    op.add_column("exercise_items", sa.Column("question_group_id", sa.UUID(), nullable=True))
    op.add_column("exercise_items", sa.Column("source_type", sa.String(length=32), nullable=True))
    op.add_column("exercise_items", sa.Column("source_task_id", sa.String(length=64), nullable=True))
    op.create_index(
        "ix_exercise_items_question_group_id", "exercise_items", ["question_group_id"]
    )
    op.create_index(
        "ix_exercise_items_source", "exercise_items", ["source_type", "source_task_id"]
    )
    op.create_foreign_key(
        "fk_exercise_items_question_group_id",
        "exercise_items",
        "question_groups",
        ["question_group_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # User Exercise Progress - track per-question progress
    op.create_table(
        "user_exercise_progress",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("exercise_item_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="not_started"),
        sa.Column("attempts_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("wrong_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_attempt_at", sa.DateTime(), nullable=True),
        sa.Column("last_correct_at", sa.DateTime(), nullable=True),
        sa.Column("last_wrong_at", sa.DateTime(), nullable=True),
        sa.Column("mastery_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_review_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exercise_item_id"], ["exercise_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "exercise_item_id", name="uq_user_exercise_progress"),
    )
    op.create_index("ix_user_exercise_progress_user_id", "user_exercise_progress", ["user_id"])
    op.create_index("ix_user_exercise_progress_exercise_item_id", "user_exercise_progress", ["exercise_item_id"])
    op.create_index("ix_user_exercise_progress_user_status", "user_exercise_progress", ["user_id", "status"])

    # User Question Group Stats - track per-group statistics
    op.create_table(
        "user_question_group_stats",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("question_group_id", sa.UUID(), nullable=False),
        sa.Column("attempts_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("wrong_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("accuracy_rate", sa.Integer(), nullable=True),
        sa.Column("completed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_practiced_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_group_id"], ["question_groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "question_group_id", name="uq_user_question_group_stats"),
    )
    op.create_index("ix_user_question_group_stats_user_id", "user_question_group_stats", ["user_id"])
    op.create_index("ix_user_question_group_stats_group_id", "user_question_group_stats", ["question_group_id"])

    # User Wrong Questions - wrong answer collection
    op.create_table(
        "user_wrong_questions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("exercise_item_id", sa.UUID(), nullable=False),
        sa.Column("wrong_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_wrong_at", sa.DateTime(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("last_attempt_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exercise_item_id"], ["exercise_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["last_attempt_id"], ["attempts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "exercise_item_id", name="uq_user_wrong_questions"),
    )
    op.create_index("ix_user_wrong_questions_user_id", "user_wrong_questions", ["user_id"])
    op.create_index("ix_user_wrong_questions_exercise_item_id", "user_wrong_questions", ["exercise_item_id"])

    # User Practice Streaks - daily practice streaks
    op.create_table(
        "user_practice_streaks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("subject_id", sa.UUID(), nullable=True),
        sa.Column("current_streak_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("longest_streak_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_practice_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "subject_id", name="uq_user_practice_streaks"),
    )
    op.create_index("ix_user_practice_streaks_user_id", "user_practice_streaks", ["user_id"])
    op.create_index("ix_user_practice_streaks_subject_id", "user_practice_streaks", ["subject_id"])

    # Achievement Badges - badge definitions
    op.create_table(
        "achievement_badges",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("criteria", sa.JSON(), nullable=True),
        sa.Column("icon", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_achievement_badges_code"),
    )
    op.create_index("ix_achievement_badges_code", "achievement_badges", ["code"], unique=True)

    # User Achievements - user earned badges
    op.create_table(
        "user_achievements",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("badge_id", sa.UUID(), nullable=False),
        sa.Column("awarded_at", sa.DateTime(), nullable=True),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["badge_id"], ["achievement_badges.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "badge_id", name="uq_user_achievements"),
    )
    op.create_index("ix_user_achievements_user_id", "user_achievements", ["user_id"])
    op.create_index("ix_user_achievements_badge_id", "user_achievements", ["badge_id"])

    # User Gamification Profiles - user level and XP
    op.create_table(
        "user_gamification_profiles",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_gamification_profiles_user_id"),
    )
    op.create_index("ix_user_gamification_profiles_user_id", "user_gamification_profiles", ["user_id"])

    # Question Recommendations - smart recommendations cache
    op.create_table(
        "question_recommendations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("exercise_item_id", sa.UUID(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reason_code", sa.String(length=64), nullable=True),
        sa.Column("reason_detail", sa.JSON(), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=True),
        sa.Column("generated_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["exercise_item_id"], ["exercise_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "exercise_item_id", name="uq_question_recommendations"),
    )
    op.create_index("ix_question_recommendations_user_id", "question_recommendations", ["user_id"])
    op.create_index("ix_question_recommendations_user_score", "question_recommendations", ["user_id", "score"])

    # Exercise Hint Cache - AI hint cache
    op.create_table(
        "exercise_hint_cache",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("exercise_item_id", sa.UUID(), nullable=False),
        sa.Column("hint_level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("hint_text", sa.Text(), nullable=False),
        sa.Column("model", sa.String(length=64), nullable=True),
        sa.Column("prompt_hash", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["exercise_item_id"], ["exercise_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "exercise_item_id", "hint_level", "prompt_hash", name="uq_exercise_hint_cache"
        ),
    )
    op.create_index("ix_exercise_hint_cache_exercise_item_id", "exercise_hint_cache", ["exercise_item_id"])


def downgrade() -> None:
    op.drop_index("ix_exercise_hint_cache_exercise_item_id", table_name="exercise_hint_cache")
    op.drop_table("exercise_hint_cache")

    op.drop_index("ix_question_recommendations_user_score", table_name="question_recommendations")
    op.drop_index("ix_question_recommendations_user_id", table_name="question_recommendations")
    op.drop_table("question_recommendations")

    op.drop_index("ix_user_gamification_profiles_user_id", table_name="user_gamification_profiles")
    op.drop_table("user_gamification_profiles")

    op.drop_index("ix_user_achievements_badge_id", table_name="user_achievements")
    op.drop_index("ix_user_achievements_user_id", table_name="user_achievements")
    op.drop_table("user_achievements")

    op.drop_index("ix_achievement_badges_code", table_name="achievement_badges")
    op.drop_table("achievement_badges")

    op.drop_index("ix_user_practice_streaks_subject_id", table_name="user_practice_streaks")
    op.drop_index("ix_user_practice_streaks_user_id", table_name="user_practice_streaks")
    op.drop_table("user_practice_streaks")

    op.drop_index("ix_user_wrong_questions_exercise_item_id", table_name="user_wrong_questions")
    op.drop_index("ix_user_wrong_questions_user_id", table_name="user_wrong_questions")
    op.drop_table("user_wrong_questions")

    op.drop_index("ix_user_question_group_stats_group_id", table_name="user_question_group_stats")
    op.drop_index("ix_user_question_group_stats_user_id", table_name="user_question_group_stats")
    op.drop_table("user_question_group_stats")

    op.drop_index("ix_user_exercise_progress_user_status", table_name="user_exercise_progress")
    op.drop_index("ix_user_exercise_progress_exercise_item_id", table_name="user_exercise_progress")
    op.drop_index("ix_user_exercise_progress_user_id", table_name="user_exercise_progress")
    op.drop_table("user_exercise_progress")

    op.drop_constraint("fk_exercise_items_question_group_id", "exercise_items", type_="foreignkey")
    op.drop_index("ix_exercise_items_source", table_name="exercise_items")
    op.drop_index("ix_exercise_items_question_group_id", table_name="exercise_items")
    op.drop_column("exercise_items", "source_task_id")
    op.drop_column("exercise_items", "source_type")
    op.drop_column("exercise_items", "question_group_id")

    op.drop_index("ix_question_groups_source", table_name="question_groups")
    op.drop_index("ix_question_groups_subject_id", table_name="question_groups")
    op.drop_index("ix_question_groups_user_id", table_name="question_groups")
    op.drop_table("question_groups")
