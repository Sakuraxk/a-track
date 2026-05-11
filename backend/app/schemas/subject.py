"""
Schemas for multi-subject learning platform.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field


# ==================== Subject Schemas ====================

class SubjectBase(BaseModel):
    key: str
    name: str
    icon: Optional[str] = None
    description: Optional[str] = None


class SubjectResponse(SubjectBase):
    id: UUID
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubjectWithProgress(SubjectResponse):
    """Subject with user's progress info"""
    onboarding_status: str = "not_started"  # not_started, in_progress, completed
    progress_percent: float = 0.0
    mastered_nodes: int = 0
    total_nodes: int = 0


class SubjectListResponse(BaseModel):
    subjects: List[SubjectWithProgress]
    current_subject_id: Optional[UUID] = None


# ==================== Chapter Schemas ====================

class ChapterBase(BaseModel):
    code: str
    title: str
    description: Optional[str] = None
    order_index: int = 0


class ChapterResponse(ChapterBase):
    id: UUID
    subject_id: UUID

    class Config:
        from_attributes = True


# ==================== User Subject Profile Schemas ====================

class UserSubjectProfileBase(BaseModel):
    level: Optional[str] = None
    pace_preference: Optional[str] = None
    goal: Optional[str] = None


class UserSubjectProfileCreate(UserSubjectProfileBase):
    subject_id: UUID


class UserSubjectProfileUpdate(UserSubjectProfileBase):
    onboarding_status: Optional[str] = None


class UserSubjectProfileResponse(UserSubjectProfileBase):
    id: UUID
    user_id: UUID
    subject_id: UUID
    onboarding_status: str
    diagnostic_summary: Optional[Dict[str, Any]] = None
    ability_tags: Optional[Dict[str, int]] = None
    active_learning_path_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== Switch Subject Request ====================

class SwitchSubjectRequest(BaseModel):
    subject_id: UUID


class SwitchSubjectResponse(BaseModel):
    success: bool
    subject: SubjectResponse
    profile: UserSubjectProfileResponse
    needs_onboarding: bool
