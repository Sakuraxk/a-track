"""
练习服务 - 题组管理、进度追踪、答题提交
"""
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.subject import (
    Attempt,
    ExerciseItem,
    QuestionGroup,
    UserExerciseProgress,
    UserQuestionGroupStats,
)
from .ai_scoring_service import AIScoringService, ScoringResult
from .wrong_answer_service import add_wrong_question
from .achievement_service import add_xp, check_and_award_badges
from .sandbox_service import sandbox
from .user_memory_service import UserMemoryService
from ..models.base import utcnow_naive


AI_PASSING_SCORE = 70
AI_GRADED_ITEM_TYPES = {"short_answer", "essay"}


def _coerce_uuid(value: object) -> UUID:
    """将字符串或UUID转换为UUID对象"""
    if isinstance(value, UUID):
        return value
    return UUID(str(value))


def _normalize_text(value: Any) -> str:
    """标准化文本用于比较"""
    return str(value).strip() if value is not None else ""


def _normalize_json(value: Any) -> str:
    """标准化JSON用于比较"""
    try:
        return json.dumps(value, sort_keys=True, ensure_ascii=True)
    except TypeError:
        return str(value)


def _strip_code_fences(text: str) -> str:
    """去除 markdown 代码块标记（```python ... ```）"""
    if not isinstance(text, str):
        return str(text) if text is not None else ""
    match = re.search(r'```(?:\w*)\n?(.*?)```', text, re.DOTALL)
    return match.group(1).strip() if match else text.strip()


async def _run_code_async(code: str, stdin_text: str = "", timeout: int = 10) -> tuple[bool, str, str]:
    """异步运行 Python 代码，返回 (success, stdout, stderr)，通过沙箱服务执行"""
    result = await sandbox.execute(code, stdin_text=stdin_text, timeout=timeout)
    return result.success, result.stdout, result.stderr


async def _evaluate_coding_with_tests(code: str, test_cases: list) -> Optional[bool]:
    """OJ 式判题：逐个 test case 运行用户代码并比对输出"""
    if not test_cases:
        return None  # 无测试用例，无法自动判题

    for tc in test_cases:
        stdin_text = tc.get("input", "")
        expected = tc.get("expected_output", "").strip()
        if not expected:
            continue

        # 如果有 stdin 输入且不是"无"，需要注入
        if stdin_text and stdin_text.strip() not in ("无", "无输入", "None", ""):
            success, stdout, _ = await _run_code_async(code, stdin_text=stdin_text)
        else:
            success, stdout, _ = await _run_code_async(code)

        if not success:
            return False

        actual = stdout.strip()
        if actual != expected:
            return False

    return True


async def _evaluate_response(response: Any, answer_key: Any, item_type: str = "", test_cases: Any = None) -> Optional[bool]:
    """
    评估用户答案是否正确

    返回:
    - True: 正确
    - False: 错误
    - None: 无法自动判断（主观题）
    """
    if answer_key is None:
        return None

    # 编程题：优先使用 test_cases 进行 OJ 式判题
    if item_type == "coding" and test_cases and isinstance(test_cases, list) and len(test_cases) > 0:
        code = str(response) if response else ""
        return await _evaluate_coding_with_tests(code, test_cases)

    if isinstance(answer_key, dict):
        if isinstance(response, dict):
            return _normalize_json(response) == _normalize_json(answer_key)
        if "code" in answer_key:
            # 清洗 markdown 代码块标记后再比较
            clean_key = _strip_code_fences(answer_key.get("code", ""))
            clean_resp = _strip_code_fences(str(response))
            return _normalize_text(clean_resp) == _normalize_text(clean_key)
        # 多字段 dict（如编程题）无法自动判断
        if len(answer_key) > 1:
            return None
        if len(answer_key) == 1:
            only_value = next(iter(answer_key.values()))
            return _normalize_text(response) == _normalize_text(only_value)
        return None

    if isinstance(answer_key, list):
        if isinstance(response, list):
            # 多选题：排序后比较，忽略顺序
            return sorted([_normalize_text(x) for x in response]) == sorted([_normalize_text(x) for x in answer_key])
        return _normalize_text(response) in [_normalize_text(x) for x in answer_key]

    if isinstance(response, list):
        return _normalize_text(answer_key) in [_normalize_text(x) for x in response]

    return _normalize_text(response) == _normalize_text(answer_key)


def _serialize_scoring_result(result: Optional[ScoringResult]) -> Optional[Dict[str, Any]]:
    """将 AI 评分结果转为可落库和接口返回的结构。"""
    if result is None:
        return None
    if hasattr(result, "model_dump"):
        return result.model_dump()
    return result.dict()


def _build_rubric_payload(item: ExerciseItem) -> Optional[str]:
    """优先使用 rubric，否则把参考答案明确标记为 AI 评分依据。"""
    if item.rubric is not None:
        rubric = item.rubric if isinstance(item.rubric, str) else json.dumps(item.rubric, ensure_ascii=False)
        return f"评分标准：{rubric}"
    if item.answer_key is not None:
        answer_key = (
            item.answer_key
            if isinstance(item.answer_key, str)
            else json.dumps(item.answer_key, ensure_ascii=False)
        )
        return f"参考答案：{answer_key}\n请根据参考答案评估用户回答的准确性、完整性和表达清晰度。"
    return None


def _progress_payload(progress: Optional[UserExerciseProgress]) -> Dict[str, Any]:
    """构建单题进度响应"""
    if not progress:
        return {
            "status": "not_started",
            "attempts_count": 0,
            "correct_count": 0,
            "wrong_count": 0,
            "mastery_score": 0,
            "last_attempt_at": None,
            "last_correct_at": None,
            "last_wrong_at": None,
        }

    return {
        "status": progress.status,
        "attempts_count": progress.attempts_count,
        "correct_count": progress.correct_count,
        "wrong_count": progress.wrong_count,
        "mastery_score": progress.mastery_score,
        "last_attempt_at": progress.last_attempt_at,
        "last_correct_at": progress.last_correct_at,
        "last_wrong_at": progress.last_wrong_at,
    }


def _group_stats_payload(
    stats: Optional[UserQuestionGroupStats],
    fallback_total: int,
) -> Dict[str, Any]:
    """构建题组统计响应"""
    attempts = stats.attempts_count if stats else 0
    correct = stats.correct_count if stats else 0
    wrong = stats.wrong_count if stats else 0
    total_count = stats.total_count if stats and stats.total_count else fallback_total
    completed_count = stats.completed_count if stats else 0
    accuracy_rate = stats.accuracy_rate if stats and stats.accuracy_rate is not None else (
        int(correct / attempts * 100) if attempts else 0
    )
    last_practiced_at = stats.last_practiced_at if stats else None

    return {
        "attempts_count": attempts,
        "correct_count": correct,
        "wrong_count": wrong,
        "accuracy_rate": accuracy_rate,
        "completed_count": completed_count,
        "total_count": total_count,
        "last_practiced_at": last_practiced_at,
    }


async def _get_group_total_count(db: AsyncSession, group_id: UUID) -> int:
    """获取题组总题目数"""
    result = await db.execute(
        select(func.count(ExerciseItem.id)).where(ExerciseItem.question_group_id == group_id)
    )
    return result.scalar() or 0


async def _get_attempted_count(db: AsyncSession, user_id: UUID, group_id: UUID) -> int:
    """获取用户在题组中已作答的题目数"""
    attempted_case = case(
        (UserExerciseProgress.attempts_count > 0, 1),
        else_=0,
    )
    result = await db.execute(
        select(func.coalesce(func.sum(attempted_case), 0))
        .select_from(UserExerciseProgress)
        .join(ExerciseItem, UserExerciseProgress.exercise_item_id == ExerciseItem.id)
        .where(
            UserExerciseProgress.user_id == user_id,
            ExerciseItem.question_group_id == group_id,
        )
    )
    return result.scalar() or 0


async def get_question_groups(
    db: AsyncSession,
    user_id: str,
    subject_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """获取用户的题组列表（含进度）"""
    user_uuid = _coerce_uuid(user_id)
    subject_uuid = _coerce_uuid(subject_id) if subject_id else None

    stmt = (
        select(QuestionGroup, UserQuestionGroupStats)
        .outerjoin(
            UserQuestionGroupStats,
            and_(
                UserQuestionGroupStats.user_id == user_uuid,
                UserQuestionGroupStats.question_group_id == QuestionGroup.id,
            ),
        )
        .where(QuestionGroup.user_id == user_uuid)
        .order_by(QuestionGroup.updated_at.desc())
    )
    if subject_uuid:
        stmt = stmt.where(QuestionGroup.subject_id == subject_uuid)

    result = await db.execute(stmt)
    groups = []
    for group, stats in result.all():
        progress = _group_stats_payload(stats, group.item_count or 0)
        groups.append({
            "id": str(group.id),
            "subject_id": str(group.subject_id) if group.subject_id else None,
            "source_type": group.source_type,
            "source_task_id": group.source_task_id,
            "source_annotation": group.source_annotation,
            "learning_path_id": group.learning_path_id,
            "learning_path_version": group.learning_path_version,
            "learning_path_version_name": group.learning_path_version_name,
            "source_day": group.source_day,
            "source_chapter_id": group.source_chapter_id,
            "source_chapter_title": group.source_chapter_title,
            "source_task_title": group.source_task_title,
            "source_scope_key": group.source_scope_key,
            "title": group.title,
            "description": group.description,
            "item_count": group.item_count,
            "progress": progress,
        })
    return groups


async def get_group_items(
    db: AsyncSession,
    group_id: str,
    user_id: str,
) -> List[Dict[str, Any]]:
    """获取题组内的题目（含用户进度）"""
    group_uuid = _coerce_uuid(group_id)
    user_uuid = _coerce_uuid(user_id)

    # 先校验题组归属
    group_check = await db.execute(
        select(QuestionGroup).where(
            QuestionGroup.id == group_uuid,
            QuestionGroup.user_id == user_uuid,
        )
    )
    if not group_check.scalar_one_or_none():
        return []

    stmt = (
        select(ExerciseItem, UserExerciseProgress)
        .outerjoin(
            UserExerciseProgress,
            and_(
                UserExerciseProgress.user_id == user_uuid,
                UserExerciseProgress.exercise_item_id == ExerciseItem.id,
            ),
        )
        .where(ExerciseItem.question_group_id == group_uuid)
        .order_by(ExerciseItem.created_at.asc())
    )
    result = await db.execute(stmt)

    items = []
    for item, progress in result.all():
        items.append({
            "id": str(item.id),
            "question_type": item.item_type,
            "stem": item.stem,
            "options": item.options,
            "answer_key": item.answer_key,
            "rubric": item.rubric,
            "difficulty": item.difficulty,
            "source_annotation": item.source_annotation or "",
            "hints": item.hints,
            "initial_code": item.initial_code,
            "expected_output": item.expected_output,
            "test_cases": item.test_cases,
            "progress": _progress_payload(progress),
        })
    return items


async def submit_attempt(
    db: AsyncSession,
    user_id: str,
    exercise_item_id: str,
    response: Any,
) -> Optional[Dict[str, Any]]:
    """提交答题并更新进度"""
    user_uuid = _coerce_uuid(user_id)
    item_uuid = _coerce_uuid(exercise_item_id)

    # 查询题目并校验归属
    item_result = await db.execute(
        select(ExerciseItem, QuestionGroup)
        .outerjoin(QuestionGroup, ExerciseItem.question_group_id == QuestionGroup.id)
        .where(ExerciseItem.id == item_uuid)
    )
    row = item_result.one_or_none()
    if not row:
        return None

    item, group = row
    # 如果题目属于某个题组，校验题组归属
    if group and group.user_id != user_uuid:
        return None

    should_ai_grade = item.item_type in AI_GRADED_ITEM_TYPES
    is_correct = None if should_ai_grade else await _evaluate_response(
        response,
        item.answer_key,
        item_type=item.item_type,
        test_cases=item.test_cases,
    )
    now = utcnow_naive()
    score: Optional[int] = None
    scoring_method: Optional[str] = None
    feedback: Optional[str] = None
    grading_detail: Optional[Dict[str, Any]] = None
    grading_trace: List[str] = []

    if is_correct is not None:
        score = 100 if is_correct else 0
        scoring_method = (
            "code_execution"
            if item.item_type == "coding" and item.test_cases
            else "rule"
        )
        grading_trace = ["使用确定性规则判题。"]
    elif should_ai_grade:
        scorer = AIScoringService(db)
        rubric_payload = _build_rubric_payload(item)
        grading_trace = [
            "已读取题干与参考答案。",
            "正在对照参考答案评估用户回答覆盖度。",
            "正在生成分数、评分依据与改进建议摘要。",
        ]

        scoring_result = await scorer.score_answer(
            user_id=user_id,
            question=item.stem,
            answer=str(response or ""),
            question_type=item.item_type,
            rubric=rubric_payload,
        )
        grading_detail = _serialize_scoring_result(scoring_result)

        if scorer.last_error:
            scoring_method = "fallback"
            feedback = (
                scoring_result.overall_feedback
                if scoring_result
                else "已记录你的答案，AI 判题暂时不可用。"
            )
            score = None
            is_correct = None
            grading_trace.append("AI 评分不可用，本次仅保存答案。")
        elif scoring_result:
            score = scoring_result.total_score
            is_correct = score >= AI_PASSING_SCORE
            scoring_method = "llm"
            feedback = scoring_result.overall_feedback
            grading_trace.append("AI 评分完成，已生成可展示的评分依据摘要。")
        else:
            scoring_method = "pending"
            score = None
            is_correct = None
            feedback = "已记录你的答案，暂时无法完成自动判题。"
            grading_trace.append("暂时无法完成自动判题，本次仅保存答案。")

    try:
        # 更新单题进度
        progress_result = await db.execute(
            select(UserExerciseProgress).where(
                UserExerciseProgress.user_id == user_uuid,
                UserExerciseProgress.exercise_item_id == item_uuid,
            )
        )
        progress = progress_result.scalar_one_or_none()
        if not progress:
            progress = UserExerciseProgress(
                user_id=user_uuid,
                exercise_item_id=item_uuid,
            )
            db.add(progress)

        progress.attempts_count = (progress.attempts_count or 0) + 1
        progress.last_attempt_at = now

        if is_correct is True:
            progress.correct_count = (progress.correct_count or 0) + 1
            progress.last_correct_at = now
            progress.status = "completed"
            progress.mastery_score = min(100, (progress.mastery_score or 0) + 20)
        elif is_correct is False:
            progress.wrong_count = (progress.wrong_count or 0) + 1
            progress.last_wrong_at = now
            progress.status = "in_progress"
            progress.mastery_score = max(0, (progress.mastery_score or 0) - 5)
            # 记录错题
            await add_wrong_question(db, user_id, exercise_item_id, attempt_id=None)
        else:
            if not progress.status or progress.status == "not_started":
                progress.status = "in_progress"

        # 记录到 Attempt 表
        attempt = Attempt(
            user_id=user_uuid,
            exercise_item_id=item_uuid,
            is_correct=is_correct,
            score=score,
            scoring_method=scoring_method,
            llm_score_detail=grading_detail,
            response=response,
            feedback=feedback,
            created_at=now
        )
        db.add(attempt)

        # 奖励经验值
        xp_result = None
        if is_correct is True:
            xp_result = await add_xp(db, user_id, 10, "correct_answer")
        elif is_correct is False:
            xp_result = await add_xp(db, user_id, 2, "attempt")

        # 更新题组统计
        group_progress_payload = None
        if item.question_group_id:
            stats_result = await db.execute(
                select(UserQuestionGroupStats).where(
                    UserQuestionGroupStats.user_id == user_uuid,
                    UserQuestionGroupStats.question_group_id == item.question_group_id,
                )
            )
            stats = stats_result.scalar_one_or_none()
            if not stats:
                stats = UserQuestionGroupStats(
                    user_id=user_uuid,
                    question_group_id=item.question_group_id,
                )
                db.add(stats)

            stats.attempts_count = (stats.attempts_count or 0) + 1
            if is_correct is True:
                stats.correct_count = (stats.correct_count or 0) + 1
            elif is_correct is False:
                stats.wrong_count = (stats.wrong_count or 0) + 1

            stats.last_practiced_at = now
            await db.flush()

            stats.total_count = await _get_group_total_count(db, item.question_group_id)
            stats.completed_count = await _get_attempted_count(db, user_uuid, item.question_group_id)
            stats.accuracy_rate = (
                int(stats.correct_count / stats.attempts_count * 100)
                if stats.attempts_count
                else 0
            )

            group_progress_payload = _group_stats_payload(stats, stats.total_count)

        # 检查徽章
        new_badges = await check_and_award_badges(db, user_id)

        # 记录用户行为到记忆系统
        await UserMemoryService.record_behavior(
            db,
            user_uuid,
            behavior_type="exercise_complete",
            context=str(item.id),
            event_metadata={
                "is_correct": is_correct,
                "difficulty": item.difficulty,
                "subject_id": str(item.subject_id),
                "item_type": item.item_type,
                "linked_nodes": item.tags if hasattr(item, "tags") and item.tags else [],
                "mastery_score": progress.mastery_score
            }
        )

        await db.commit()

        return {
            "is_correct": is_correct,
            "score": score,
            "scoring_method": scoring_method,
            "feedback": feedback,
            "grading_detail": grading_detail,
            "grading_trace": grading_trace,
            "progress": _progress_payload(progress),
            "group_progress": group_progress_payload,
            "xp_gained": xp_result.get("xp_added", 0) if xp_result else 0,
            "leveled_up": xp_result.get("leveled_up", False) if xp_result else False,
            "new_badges": new_badges,
        }
    except Exception:
        await db.rollback()
        raise


async def get_user_progress_summary(
    db: AsyncSession,
    user_id: str,
    subject_id: Optional[str] = None,
) -> Dict[str, Any]:
    """获取用户练习进度汇总"""
    user_uuid = _coerce_uuid(user_id)
    subject_uuid = _coerce_uuid(subject_id) if subject_id else None

    # 题组总数
    group_stmt = select(func.count(QuestionGroup.id)).where(
        QuestionGroup.user_id == user_uuid
    )
    if subject_uuid:
        group_stmt = group_stmt.where(QuestionGroup.subject_id == subject_uuid)
    total_groups_result = await db.execute(group_stmt)
    total_groups = total_groups_result.scalar() or 0

    # 题目总数
    items_stmt = (
        select(func.count(ExerciseItem.id))
        .join(QuestionGroup, ExerciseItem.question_group_id == QuestionGroup.id)
        .where(QuestionGroup.user_id == user_uuid)
    )
    if subject_uuid:
        items_stmt = items_stmt.where(QuestionGroup.subject_id == subject_uuid)
    total_items_result = await db.execute(items_stmt)
    total_items = total_items_result.scalar() or 0

    # 进度统计
    completed_case = case(
        (UserExerciseProgress.status.in_(["completed", "mastered"]), 1),
        else_=0,
    )
    progress_stmt = (
        select(
            func.coalesce(func.sum(UserExerciseProgress.attempts_count), 0),
            func.coalesce(func.sum(UserExerciseProgress.correct_count), 0),
            func.coalesce(func.sum(UserExerciseProgress.wrong_count), 0),
            func.coalesce(func.sum(completed_case), 0),
        )
        .select_from(UserExerciseProgress)
        .join(ExerciseItem, UserExerciseProgress.exercise_item_id == ExerciseItem.id)
        .join(QuestionGroup, ExerciseItem.question_group_id == QuestionGroup.id)
        .where(UserExerciseProgress.user_id == user_uuid)
    )
    if subject_uuid:
        progress_stmt = progress_stmt.where(QuestionGroup.subject_id == subject_uuid)

    progress_result = await db.execute(progress_stmt)
    attempts_count, correct_count, wrong_count, completed_items = progress_result.one()
    attempts_count = attempts_count or 0
    correct_count = correct_count or 0
    wrong_count = wrong_count or 0
    completed_items = completed_items or 0

    accuracy_rate = int(correct_count / attempts_count * 100) if attempts_count else 0

    return {
        "total_groups": total_groups,
        "total_items": total_items,
        "completed_items": completed_items,
        "attempts_count": attempts_count,
        "correct_count": correct_count,
        "wrong_count": wrong_count,
        "accuracy_rate": accuracy_rate,
    }
