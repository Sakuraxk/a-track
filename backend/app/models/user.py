import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import Column, DateTime, JSON, String
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=True)
    phone = Column(String(32), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_login = Column(DateTime(timezone=True), nullable=True)

    # Profile and preferences
    pace_preference = Column(String(32), nullable=True)  # e.g., light/medium/intense
    survey_answers = Column(JSON, nullable=True)  # self-assessment answers
    ability_tags = Column(JSON, nullable=True)  # {"syntax": 70, "loops": 50, ...}


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    preferences = Column(JSON, nullable=True)  # additional key-value preferences
    portrait = Column(JSON, nullable=True)  # summarized portrait for UI consumption
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
