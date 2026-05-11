"""
错题本服务 - 记录/查询/统计
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.subject import ExerciseItem, UserWrongQuestion
from ..models.base import utcnow_naive


def _coerce_uuid(value: object) -> UUID:
    if isinstance(value, UUID):
        return value
    return UUID(str(value))


async def add_wrong_question(
    db: AsyncSession,
    user_id: str,
    exercise_item_id: str,
    attempt_id: Optional[str] = None,
) -> UserWrongQuestion:
    """新增或更新错题记录"""
    user_uuid = _coerce_uuid(user_id)
    exercise_uuid = _coerce_uuid(exercise_item_id)
    attempt_uuid = _coerce_uuid(attempt_id) if attempt_id else None

    result = await db.execute(
        select(UserWrongQuestion).where(
            UserWrongQuestion.user_id == user_uuid,
            UserWrongQuestion.exercise_item_id == exercise_uuid,
        )
    )
    wrong_question = result.scalar_one_or_none()
    now = utcnow_naive()

    if wrong_question:
        wrong_question.wrong_count = (wrong_question.wrong_count or 0) + 1
        wrong_question.last_wrong_at = now
        wrong_question.last_attempt_id = attempt_uuid
        wrong_question.resolved_at = None
    else:
        wrong_question = UserWrongQuestion(
            user_id=user_uuid,
            exercise_item_id=exercise_uuid,
            wrong_count=1,
            last_wrong_at=now,
            last_attempt_id=attempt_uuid,
        )
        db.add(wrong_question)

    return wrong_question


async def get_wrong_questions(
    db: AsyncSession,
    user_id: str,
    subject_id: Optional[str] = None,
    resolved: bool = False,
) -> List[Dict[str, Any]]:
    """获取错题列表"""
    user_uuid = _coerce_uuid(user_id)
    subject_uuid = _coerce_uuid(subject_id) if subject_id else None

    stmt = (
        select(UserWrongQuestion, ExerciseItem)
        .join(ExerciseItem, UserWrongQuestion.exercise_item_id == ExerciseItem.id)
        .where(UserWrongQuestion.user_id == user_uuid)
    )
    if resolved:
        stmt = stmt.where(UserWrongQuestion.resolved_at.isnot(None))
    else:
        stmt = stmt.where(UserWrongQuestion.resolved_at.is_(None))
    if subject_uuid:
        stmt = stmt.where(ExerciseItem.subject_id == subject_uuid)

    stmt = stmt.order_by(
        UserWrongQuestion.last_wrong_at.desc().nullslast(),
        UserWrongQuestion.updated_at.desc(),
    )

    result = await db.execute(stmt)
    items = []
    for wrong_question, exercise in result.all():
        items.append({
            "id": str(wrong_question.id),
            "user_id": str(wrong_question.user_id),
            "exercise_item_id": str(wrong_question.exercise_item_id),
            "wrong_count": wrong_question.wrong_count,
            "last_wrong_at": wrong_question.last_wrong_at,
            "resolved_at": wrong_question.resolved_at,
            "last_attempt_id": str(wrong_question.last_attempt_id) if wrong_question.last_attempt_id else None,
            "subject_id": str(exercise.subject_id) if exercise.subject_id else None,
            "question_type": exercise.item_type,
            "stem": exercise.stem,
            "options": exercise.options,
            "answer_key": exercise.answer_key,
            "rubric": exercise.rubric,
            "difficulty": exercise.difficulty,
            "source_annotation": exercise.source_annotation,
            "hints": exercise.hints,
        })
    return items


async def resolve_wrong_question(
    db: AsyncSession,
    user_id: str,
    wrong_question_id: str,
) -> Optional[UserWrongQuestion]:
    """标记错题为已解决"""
    user_uuid = _coerce_uuid(user_id)
    wrong_uuid = _coerce_uuid(wrong_question_id)

    result = await db.execute(
        select(UserWrongQuestion).where(
            UserWrongQuestion.id == wrong_uuid,
            UserWrongQuestion.user_id == user_uuid,
        )
    )
    wrong_question = result.scalar_one_or_none()
    if not wrong_question:
        return None

    wrong_question.resolved_at = utcnow_naive()
    return wrong_question


async def get_wrong_question_stats(db: AsyncSession, user_id: str) -> Dict[str, Any]:
    """获取错题统计信息"""
    user_uuid = _coerce_uuid(user_id)

    total_result = await db.execute(
        select(
            func.count(UserWrongQuestion.id),
            func.coalesce(func.sum(UserWrongQuestion.wrong_count), 0),
            func.max(UserWrongQuestion.last_wrong_at),
        ).where(UserWrongQuestion.user_id == user_uuid)
    )
    total_count, total_wrong, last_wrong_at = total_result.one()

    resolved_result = await db.execute(
        select(func.count(UserWrongQuestion.id)).where(
            UserWrongQuestion.user_id == user_uuid,
            UserWrongQuestion.resolved_at.isnot(None),
        )
    )
    resolved_count = resolved_result.scalar() or 0

    total_count = int(total_count or 0)
    total_wrong = int(total_wrong or 0)
    unresolved_count = max(total_count - resolved_count, 0)

    return {
        "total_questions": total_count,
        "unresolved_questions": unresolved_count,
        "resolved_questions": resolved_count,
        "total_wrong_count": total_wrong,
        "last_wrong_at": last_wrong_at,
    }
