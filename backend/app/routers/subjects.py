"""
Subject management API routes.

Provides endpoints for:
- Listing available subjects
- Switching current subject
- Getting/updating user's subject profile
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from app.models.subject import Subject, Chapter, UserSubjectProfile, UserNodeMastery
from app.models.learning import KnowledgeNode
from app.schemas.subject import (
    SubjectResponse,
    SubjectWithProgress,
    SubjectListResponse,
    ChapterResponse,
    UserSubjectProfileResponse,
    UserSubjectProfileUpdate,
    SwitchSubjectRequest,
    SwitchSubjectResponse,
)

router = APIRouter()


@router.get("", response_model=SubjectListResponse)
async def list_subjects(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all available subjects with user's progress"""
    # Get all active subjects
    result = await db.execute(
        select(Subject).where(Subject.is_active == True).order_by(Subject.created_at)
    )
    subjects = result.scalars().all()

    # Get user's profiles for all subjects
    profiles_result = await db.execute(
        select(UserSubjectProfile).where(UserSubjectProfile.user_id == user_id)
    )
    profiles = {p.subject_id: p for p in profiles_result.scalars().all()}

    # Build response with progress info
    subjects_with_progress = []
    current_subject_id = None

    for subject in subjects:
        profile = profiles.get(subject.id)

        # Count nodes for this subject
        total_nodes_result = await db.execute(
            select(func.count(KnowledgeNode.id)).where(
                KnowledgeNode.subject_id == subject.id
            )
        )
        total_nodes = total_nodes_result.scalar() or 0

        # Count mastered nodes
        mastered_nodes = 0
        progress_percent = 0.0
        onboarding_status = "not_started"

        if profile:
            onboarding_status = profile.onboarding_status or "not_started"
            if profile.active_learning_path_id:
                current_subject_id = subject.id

            # Count mastered nodes for this user
            mastered_result = await db.execute(
                select(func.count(UserNodeMastery.id)).where(
                    UserNodeMastery.user_id == user_id,
                    UserNodeMastery.knowledge_node_id.in_(
                        select(KnowledgeNode.id).where(
                            KnowledgeNode.subject_id == subject.id
                        )
                    ),
                    UserNodeMastery.status == "mastered",
                )
            )
            mastered_nodes = mastered_result.scalar() or 0

            if total_nodes > 0:
                progress_percent = (mastered_nodes / total_nodes) * 100

        subjects_with_progress.append(
            SubjectWithProgress(
                id=subject.id,
                key=subject.key,
                name=subject.name,
                icon=subject.icon,
                description=subject.description,
                is_active=subject.is_active,
                created_at=subject.created_at,
                onboarding_status=onboarding_status,
                progress_percent=round(progress_percent, 1),
                mastered_nodes=mastered_nodes,
                total_nodes=total_nodes,
            )
        )

    return SubjectListResponse(
        subjects=subjects_with_progress,
        current_subject_id=current_subject_id,
    )


@router.get("/{subject_id}", response_model=SubjectResponse)
async def get_subject(
    subject_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single subject by ID"""
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    return subject


@router.get("/{subject_id}/chapters", response_model=list[ChapterResponse])
async def get_subject_chapters(
    subject_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all chapters for a subject"""
    result = await db.execute(
        select(Chapter)
        .where(Chapter.subject_id == subject_id)
        .order_by(Chapter.order_index)
    )
    return result.scalars().all()


@router.post("/switch", response_model=SwitchSubjectResponse)
async def switch_subject(
    user_id: UUID,
    request: SwitchSubjectRequest,
    db: AsyncSession = Depends(get_db),
):
    """Switch user's current subject"""
    # Verify subject exists
    subject_result = await db.execute(
        select(Subject).where(Subject.id == request.subject_id, Subject.is_active == True)
    )
    subject = subject_result.scalar_one_or_none()

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Get or create user's profile for this subject
    profile_result = await db.execute(
        select(UserSubjectProfile).where(
            UserSubjectProfile.user_id == user_id,
            UserSubjectProfile.subject_id == request.subject_id,
        )
    )
    profile = profile_result.scalar_one_or_none()

    needs_onboarding = True
    if not profile:
        # Create new profile
        profile = UserSubjectProfile(
            user_id=user_id,
            subject_id=request.subject_id,
            onboarding_status="not_started",
        )
        db.add(profile)
        await db.flush()
    else:
        needs_onboarding = profile.onboarding_status != "completed"

    await db.commit()

    return SwitchSubjectResponse(
        success=True,
        subject=SubjectResponse.model_validate(subject),
        profile=UserSubjectProfileResponse.model_validate(profile),
        needs_onboarding=needs_onboarding,
    )


@router.get("/{subject_id}/profile", response_model=UserSubjectProfileResponse)
async def get_user_subject_profile(
    subject_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get user's profile for a specific subject"""
    result = await db.execute(
        select(UserSubjectProfile).where(
            UserSubjectProfile.user_id == user_id,
            UserSubjectProfile.subject_id == subject_id,
        )
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return profile


@router.put("/{subject_id}/profile", response_model=UserSubjectProfileResponse)
async def update_user_subject_profile(
    subject_id: UUID,
    user_id: UUID,
    update: UserSubjectProfileUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update user's profile for a specific subject"""
    result = await db.execute(
        select(UserSubjectProfile).where(
            UserSubjectProfile.user_id == user_id,
            UserSubjectProfile.subject_id == subject_id,
        )
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Update fields
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)

    return profile
