import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, String, Text, text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, utcnow_naive


class SubjectSkillMap(Base):
    __tablename__ = "subject_skill_map"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_key = Column(String(64), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    tree_json = Column(JSON, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)

    __table_args__ = (
        Index("idx_subject_skill_map_active", "subject_key", "is_active"),
        Index("idx_subject_skill_map_version", "subject_key", "version", unique=True),
    )


class LearningPathClarificationSession(Base):
    __tablename__ = "learning_path_clarification_session"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    subject_key = Column(String(64), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="collecting")
    current_turn_index = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)

    __table_args__ = (
        Index("idx_learning_path_session_user_subject", "user_id", "subject_key"),
    )


class LearningPathClarificationMessage(Base):
    __tablename__ = "learning_path_clarification_message"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("learning_path_clarification_session.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(16), nullable=False)
    message_type = Column(String(32), nullable=False)
    content = Column(Text, nullable=False)
    structured_payload = Column(JSON, nullable=True)
    turn_index = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=utcnow_naive, nullable=False)

    __table_args__ = (
        Index("idx_learning_path_message_session_turn", "session_id", "turn_index"),
    )


class LearningPathPreferenceSnapshot(Base):
    __tablename__ = "learning_path_preference_snapshot"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("learning_path_clarification_session.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    known_node_ids = Column(JSON, nullable=False, default=list)
    target_node_ids = Column(JSON, nullable=False, default=list)
    avoid_node_ids = Column(JSON, nullable=False, default=list)
    free_text_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)

    __table_args__ = (
        Index("idx_learning_path_snapshot_session", "session_id", unique=True),
    )


class LearningPathGenerationContext(Base):
    __tablename__ = "learning_path_generation_context"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("learning_path_clarification_session.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    goal_summary = Column(Text, nullable=False)
    constraints_json = Column(JSON, nullable=False, default=dict)
    prompt_inputs_json = Column(JSON, nullable=False, default=dict)
    generated_path_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)

    __table_args__ = (
        Index("idx_learning_path_generation_context_session", "session_id", unique=True),
    )


class UserSubjectSkillExpansionNode(Base):
    __tablename__ = "user_subject_skill_expansion_node"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    subject_key = Column(String(64), nullable=False, index=True)
    parent_node_id = Column(String(255), nullable=False, index=True)
    node_id = Column(String(255), nullable=False)
    label = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")
    tags = Column(JSON, nullable=False, default=list)
    order_index = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)

    __table_args__ = (
        Index("idx_user_subject_skill_expansion_parent", "user_id", "subject_key", "parent_node_id"),
        Index("idx_user_subject_skill_expansion_node", "user_id", "subject_key", "node_id", unique=True),
    )


class UserSkillTreeSnapshot(Base):
    """用户个人星图快照 —— 每条记录是一棵完整的技术树（含发散节点）。

    用户可以保存多个快照（方案），在不同探索方向之间自由切换。
    每用户每学科有且只有一条 is_active=True 的快照。
    """
    __tablename__ = "user_skill_tree_snapshot"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    subject_key = Column(String(64), nullable=False)
    name = Column(String(128), nullable=False)
    base_version = Column(Integer, nullable=False)
    tree_json = Column(JSON, nullable=False)
    is_active = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)

    __table_args__ = (
        Index(
            "idx_user_snapshot_active",
            "user_id", "subject_key",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
        Index("idx_user_snapshot_list", "user_id", "subject_key"),
    )

