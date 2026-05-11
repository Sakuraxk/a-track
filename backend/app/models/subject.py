"""
Multi-subject learning platform ORM models.

Covers:
- Subject (学科)
- Chapter (章节)
- ExerciseItem (题目，支持多题型)
- UserSubjectProfile (用户学科档案)
- UserNodeMastery (用户知识点掌握度)
- Attempt (作答记录)

Subject keys:
- python
- machine_learning
- advanced_math
- ai_literacy
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, utcnow_naive


class Subject(Base):
    """学科表"""

    __tablename__ = "subjects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(128), nullable=False)
    icon = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow_naive)


class Chapter(Base):
    """章节表"""

    __tablename__ = "chapters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_id = Column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    code = Column(String(64), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=utcnow_naive)

    __table_args__ = (
        UniqueConstraint("subject_id", "code", name="uq_chapter_subject_code"),
        Index("ix_chapter_subject_order", "subject_id", "order_index"),
    )


class ExerciseItem(Base):
    """
    题目表 - 支持多种题型

    item_type values:
    - coding: 编程题
    - mcq: 单选题 (Multiple Choice Question)
    - mcq_multi: 多选题
    - fill_blank: 填空题
    - short_answer: 简答题
    - essay: 论述题/作文
    """

    __tablename__ = "exercise_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_id = Column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    knowledge_node_id = Column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_nodes.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    chapter_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chapters.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )

    # Source annotation replaces pass_rate, e.g., "第2章-定语从句"
    source_annotation = Column(String(255), nullable=True)

    # Question type
    item_type = Column(String(32), nullable=False, index=True)

    # Question content
    stem = Column(Text, nullable=False)  # Question text/prompt
    options = Column(JSON, nullable=True)  # For MCQ: [{"key": "A", "text": "..."}, ...]
    answer_key = Column(JSON, nullable=True)  # Standard answer
    rubric = Column(JSON, nullable=True)  # Scoring rubric for subjective questions
    hints = Column(JSON, nullable=True)  # Hints for the question

    # For coding questions
    initial_code = Column(Text, nullable=True)
    expected_output = Column(Text, nullable=True)
    test_cases = Column(JSON, nullable=True)

    # Metadata
    difficulty = Column(Integer, default=1, nullable=False)
    estimated_seconds = Column(Integer, nullable=True)
    tags = Column(JSON, nullable=True)

    # AI generation metadata
    llm_generation_meta = Column(JSON, nullable=True)

    # Question group association (for dynamic question bank)
    question_group_id = Column(
        UUID(as_uuid=True),
        ForeignKey("question_groups.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    source_type = Column(String(32), nullable=True)
    source_task_id = Column(String(64), nullable=True)

    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)


class UserSubjectProfile(Base):
    """
    用户学科档案 - 记录用户在每个学科的状态

    level values: beginner, intermediate, advanced
    pace_preference values: light, medium, intense
    onboarding_status values: not_started, in_progress, completed
    """

    __tablename__ = "user_subject_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    subject_id = Column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # User's self-reported level and preferences
    level = Column(String(32), nullable=True)
    pace_preference = Column(String(32), nullable=True)
    goal = Column(Text, nullable=True)

    # Onboarding/assessment status
    onboarding_status = Column(String(32), default="not_started", nullable=False)
    diagnostic_summary = Column(JSON, nullable=True)

    # Ability tags specific to this subject (0-100 scale)
    ability_tags = Column(JSON, nullable=True)

    # Active learning path ID for this subject
    active_learning_path_id = Column(UUID(as_uuid=True), nullable=True)

    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    __table_args__ = (
        UniqueConstraint("user_id", "subject_id", name="uq_user_subject_profile"),
    )


class UserNodeMastery(Base):
    """
    用户知识点掌握度

    mastery: 0-100 整数，与 UserNodeState.mastery 保持一致
    status values:
    - locked: 前置知识点未完成
    - unlocked: 可以开始学习
    - learning: 正在学习中
    - mastered: 已掌握
    """

    __tablename__ = "user_node_masteries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    # Note: subject_id can be derived from knowledge_node.subject_id
    # but kept here for query performance (denormalization)
    knowledge_node_id = Column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_nodes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # Mastery level (0-100, consistent with UserNodeState)
    mastery = Column(Integer, default=0, nullable=False)
    status = Column(String(32), default="locked", nullable=False)

    # Learning evidence
    practice_count = Column(Integer, default=0, nullable=False)
    correct_count = Column(Integer, default=0, nullable=False)
    last_practiced_at = Column(DateTime, nullable=True)
    evidence = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    __table_args__ = (
        UniqueConstraint("user_id", "knowledge_node_id", name="uq_user_node_mastery"),
    )


class Attempt(Base):
    """
    作答记录

    scoring_method values:
    - rule: 规则评分（选择题、填空题）
    - llm: AI评分（主观题）
    - hybrid: 混合评分
    - code_execution: 代码执行评分
    """

    __tablename__ = "attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    exercise_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("exercise_items.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # User's response
    response = Column(JSON, nullable=True)

    # Scoring (0-100 scale)
    is_correct = Column(Boolean, nullable=True)
    score = Column(Integer, nullable=True)
    scoring_method = Column(String(32), nullable=True)

    # AI scoring details (for subjective questions)
    llm_score_detail = Column(JSON, nullable=True)

    # Execution details (for coding questions)
    execution_result = Column(JSON, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)

    # Feedback
    feedback = Column(Text, nullable=True)

    # Attempt metadata
    duration_ms = Column(Integer, nullable=True)  # Time spent on this attempt

    created_at = Column(DateTime, default=utcnow_naive)

    __table_args__ = (
        Index("ix_attempt_user_exercise", "user_id", "exercise_item_id"),
    )


class QuestionGroup(Base):
    """
    题组表 - 按来源任务分组题目

    source_type values:
    - concept_learning: 来自概念学习
    - ai_generated: AI实时生成
    - manual: 手动创建
    """

    __tablename__ = "question_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    source_type = Column(String(32), nullable=False)
    source_task_id = Column(String(64), nullable=False)
    source_annotation = Column(String(255), nullable=True)
    learning_path_id = Column(String(64), nullable=True)
    learning_path_version = Column(Integer, nullable=True)
    learning_path_version_name = Column(String(100), nullable=True)
    source_day = Column(Integer, nullable=True)
    source_chapter_id = Column(String(64), nullable=True)
    source_chapter_title = Column(String(255), nullable=True)
    source_task_title = Column(String(255), nullable=True)
    source_scope_key = Column(String(255), nullable=True)
    subject_id = Column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(32), default="active", nullable=False)
    item_count = Column(Integer, default=0, nullable=False)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    __table_args__ = (
        UniqueConstraint("user_id", "source_type", "source_scope_key", name="uq_question_groups_source_scope"),
        Index("ix_question_groups_source", "source_type", "source_task_id"),
        Index("ix_question_groups_scope", "source_type", "source_scope_key"),
    )


class UserExerciseProgress(Base):
    """
    用户单题进度

    status values:
    - not_started: 未开始
    - in_progress: 进行中
    - completed: 已完成
    - mastered: 已掌握
    """

    __tablename__ = "user_exercise_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    exercise_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("exercise_items.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    status = Column(String(32), default="not_started", nullable=False)
    attempts_count = Column(Integer, default=0, nullable=False)
    correct_count = Column(Integer, default=0, nullable=False)
    wrong_count = Column(Integer, default=0, nullable=False)
    last_attempt_at = Column(DateTime, nullable=True)
    last_correct_at = Column(DateTime, nullable=True)
    last_wrong_at = Column(DateTime, nullable=True)
    mastery_score = Column(Integer, default=0, nullable=False)
    next_review_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    __table_args__ = (
        UniqueConstraint("user_id", "exercise_item_id", name="uq_user_exercise_progress"),
        Index("ix_user_exercise_progress_user_status", "user_id", "status"),
    )


class UserQuestionGroupStats(Base):
    """用户题组级统计"""

    __tablename__ = "user_question_group_stats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    question_group_id = Column(
        UUID(as_uuid=True),
        ForeignKey("question_groups.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    attempts_count = Column(Integer, default=0, nullable=False)
    correct_count = Column(Integer, default=0, nullable=False)
    wrong_count = Column(Integer, default=0, nullable=False)
    accuracy_rate = Column(Integer, nullable=True)
    completed_count = Column(Integer, default=0, nullable=False)
    total_count = Column(Integer, default=0, nullable=False)
    last_practiced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    __table_args__ = (
        UniqueConstraint("user_id", "question_group_id", name="uq_user_question_group_stats"),
    )


class UserWrongQuestion(Base):
    """错题本"""

    __tablename__ = "user_wrong_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    exercise_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("exercise_items.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    wrong_count = Column(Integer, default=0, nullable=False)
    last_wrong_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    last_attempt_id = Column(
        UUID(as_uuid=True),
        ForeignKey("attempts.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    __table_args__ = (
        UniqueConstraint("user_id", "exercise_item_id", name="uq_user_wrong_questions"),
    )


class UserPracticeStreak(Base):
    """用户连续打卡天数"""

    __tablename__ = "user_practice_streaks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    subject_id = Column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    current_streak_days = Column(Integer, default=0, nullable=False)
    longest_streak_days = Column(Integer, default=0, nullable=False)
    last_practice_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    __table_args__ = (
        UniqueConstraint("user_id", "subject_id", name="uq_user_practice_streaks"),
    )


class AchievementBadge(Base):
    """徽章定义"""

    __tablename__ = "achievement_badges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    criteria = Column(JSON, nullable=True)
    icon = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow_naive)


class UserAchievement(Base):
    """用户已获徽章"""

    __tablename__ = "user_achievements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    badge_id = Column(
        UUID(as_uuid=True),
        ForeignKey("achievement_badges.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    awarded_at = Column(DateTime, default=utcnow_naive)
    meta = Column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "badge_id", name="uq_user_achievements"),
    )


class UserGamificationProfile(Base):
    """用户等级与经验"""

    __tablename__ = "user_gamification_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    level = Column(Integer, default=1, nullable=False)
    xp = Column(Integer, default=0, nullable=False)
    total_points = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=utcnow_naive)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_gamification_profiles_user_id"),
    )


class QuestionRecommendation(Base):
    """智能推荐缓存"""

    __tablename__ = "question_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    exercise_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("exercise_items.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    score = Column(Integer, default=0, nullable=False)
    reason_code = Column(String(64), nullable=True)
    reason_detail = Column(JSON, nullable=True)
    source = Column(String(32), nullable=True)
    generated_at = Column(DateTime, default=utcnow_naive)
    expires_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "exercise_item_id", name="uq_question_recommendations"),
        Index("ix_question_recommendations_user_score", "user_id", "score"),
    )


class ExerciseHintCache(Base):
    """AI提示缓存"""

    __tablename__ = "exercise_hint_cache"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exercise_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("exercise_items.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    hint_level = Column(Integer, default=1, nullable=False)
    hint_text = Column(Text, nullable=False)
    model = Column(String(64), nullable=True)
    prompt_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)

    __table_args__ = (
        UniqueConstraint("exercise_item_id", "hint_level", "prompt_hash", name="uq_exercise_hint_cache"),
    )
