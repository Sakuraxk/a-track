from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str = Field(
        ...,
        min_length=6,
        max_length=128,
        description="Max 128 characters"
    )
    pace_preference: Optional[str] = Field(None, description="light|medium|intense")

    @field_validator("email", "phone", mode="before")
    @classmethod
    def _normalize_contact_fields(cls, value: Any):
        if value is None:
            return None
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        return value


class LoginRequest(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str = Field(
        ...,
        min_length=6,
        max_length=128,
        description="Max 128 characters"
    )

    @field_validator("email", "phone", mode="before")
    @classmethod
    def _normalize_contact_fields(cls, value: Any):
        if value is None:
            return None
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        return value


class SurveyAnswer(BaseModel):
    question: str
    answer: str


class SurveySubmission(BaseModel):
    answers: List[SurveyAnswer]


class AbilityTags(BaseModel):
    tags: Dict[str, int] = Field(default_factory=dict, description="Knowledge area -> score 0-100")

    @field_validator("tags", mode="before")
    @classmethod
    def _round_scores(cls, v: Any):
        if isinstance(v, dict):
            return {k: round(float(score)) if isinstance(score, (int, float, str)) and str(score).replace('.', '', 1).isdigit() else score for k, score in v.items()}
        return v


class ProfileResponse(BaseModel):
    user_id: UUID
    email: Optional[str] = None
    phone: Optional[str] = None
    pace_preference: Optional[str]
    ability_tags: Dict[str, int] = Field(default_factory=dict)
    portrait: Dict[str, str] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

    @field_validator("ability_tags", mode="before")
    @classmethod
    def _round_scores(cls, v: Any):
        if isinstance(v, dict):
            return {k: round(float(score)) if isinstance(score, (int, float, str)) and str(score).replace('.', '', 1).isdigit() else score for k, score in v.items()}
        return v


class ProfileUpdate(BaseModel):
    nickname: Optional[str] = Field(None, min_length=2, max_length=20)
    learning_stage: Optional[str] = Field(None, description="beginner|elementary|intermediate|advanced")
    learning_goals: Optional[List[str]] = Field(None, description="List of goals: job|academic|hobby|skill")
    onboarding_completed: Optional[bool] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=128)


class AvatarUploadResponse(BaseModel):
    avatar_url: str
