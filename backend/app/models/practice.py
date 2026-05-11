import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, JSON, String
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, utcnow_naive


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    exercise_type = Column(String(32), nullable=False)  # fill_blank|bug_fix|completion
    difficulty = Column(Integer, default=1)
    linked_nodes = Column(JSON, nullable=True)  # list of knowledge node codes
    content = Column(JSON, nullable=True)  # question body/attachments
    answer = Column(JSON, nullable=True)  # reference answer, hidden from default API


class ExerciseResult(Base):
    __tablename__ = "exercise_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    exercise_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    status = Column(String(32), nullable=False)  # correct|wrong|timeout|error
    score = Column(Integer, default=0)
    error_tags = Column(JSON, nullable=True)  # e.g., ["recursion.base_case"]
    submitted_at = Column(DateTime, default=utcnow_naive)


class Weakness(Base):
    __tablename__ = "weaknesses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    node_code = Column(String(64), nullable=False)
    error_tag = Column(String(128), nullable=True)
    count = Column(Integer, default=0)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive)
