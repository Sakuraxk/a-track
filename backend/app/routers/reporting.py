from typing import Dict, List, Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from ..core.db import get_db
from ..services.learning_path_models import SUBJECT_CONFIGS
from ..schemas.reporting import (
    ProgressSummary,
    WeeklyReport,
    RadarDataPoint,
    AbilityRadarResponse,
    LearningStatsResponse,
    RecommendedExercise,
    DashboardDataResponse,
    DailyDetailItem,
    DailyDetailResponse,
)
from ..services.stats_service import StatsService
from app.models.subject import Attempt, ExerciseItem, QuestionGroup


router = APIRouter()


# 模拟用户数据存储（保留用于缓存能力标签）


def _get_level_from_score(score: int) -> str:
    """根据分数确定等级"""
    if score >= 80:
        return "进阶"
    elif score >= 60:
        return "中级"
    elif score >= 40:
        return "初级"
    else:
        return "入门"


def _generate_radar_data(ability_tags: Dict[str, int]) -> List[RadarDataPoint]:
    """从能力标签生成雷达图数据（适配任意学科）"""
    if not ability_tags:
        return []
    # 按分数排序，取前 8 个维度（雷达图 3-8 个点效果最佳）
    sorted_tags = sorted(ability_tags.items(), key=lambda x: x[1], reverse=True)[:8]
    return [RadarDataPoint(category=cat, score=score) for cat, score in sorted_tags]


def _get_default_abilities_for_subject(subject_key: Optional[str] = None) -> Dict[str, int]:
    """根据学科配置为新用户生成默认能力维度（所有维度分数为 0）"""
    config = SUBJECT_CONFIGS.get(subject_key or "python")
    if not config:
        config = SUBJECT_CONFIGS["python"]
    # 用 default_themes 的主题名称作为能力维度
    return {theme_name: 0 for theme_name, _ in config.default_themes}


@router.get("/progress/{user_id}", response_model=ProgressSummary)
async def progress(
    user_id: UUID,
    subject_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> ProgressSummary:
    """获取用户学习进度摘要"""
    stats_service = StatsService(db)
    stats = await stats_service.get_user_stats(str(user_id), str(subject_id) if subject_id else None)

    conditions = [Attempt.user_id == user_id]
    if subject_id:
        conditions.append(ExerciseItem.subject_id == subject_id)

    recent_stmt = (
        select(Attempt.exercise_item_id)
    )
    
    if subject_id:
        recent_stmt = recent_stmt.join(ExerciseItem, Attempt.exercise_item_id == ExerciseItem.id)
        
    recent_stmt = (
        recent_stmt.where(and_(*conditions))
        .order_by(Attempt.created_at.desc())
        .limit(10)
    )
    recent_result = await db.execute(recent_stmt)
    recent_activity = [str(item_id) for item_id in recent_result.scalars().all()]

    return ProgressSummary(
        total_minutes=stats.total_study_minutes,
        # 当前系统暂无“知识节点完成”落库，先用已完成题目数作为进度节点
        completed_nodes=stats.completed_exercises // 5,  # 模拟已掌握概念 (随便给个比例)
        completed_exercises=stats.completed_exercises,
        recent_activity=recent_activity,
    )


@router.get("/daily-detail/{user_id}", response_model=DailyDetailResponse, summary="获取每日学习趋势")
async def get_daily_detail(
    user_id: UUID,
    subject_id: Optional[UUID] = Query(None),
    learning_path_id: Optional[str] = Query(None, description="学习计划ID"),
    days: int = Query(14, ge=1, le=90, description="查询天数"),
    db: AsyncSession = Depends(get_db),
) -> DailyDetailResponse:
    """获取用户每日学习详情趋势，支持按科目/学习计划过滤"""
    today = datetime.utcnow().date()
    items: list[DailyDetailItem] = []

    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())

        # 总做题数
        total_stmt = select(func.count(Attempt.id))
        correct_stmt = select(func.count(Attempt.id))

        if learning_path_id:
            total_stmt = (
                total_stmt
                .join(ExerciseItem, Attempt.exercise_item_id == ExerciseItem.id)
                .join(QuestionGroup, ExerciseItem.question_group_id == QuestionGroup.id)
                .where(and_(
                    Attempt.user_id == user_id,
                    Attempt.created_at >= day_start,
                    Attempt.created_at <= day_end,
                    QuestionGroup.learning_path_id == learning_path_id,
                ))
            )
            correct_stmt = (
                correct_stmt
                .join(ExerciseItem, Attempt.exercise_item_id == ExerciseItem.id)
                .join(QuestionGroup, ExerciseItem.question_group_id == QuestionGroup.id)
                .where(and_(
                    Attempt.user_id == user_id,
                    Attempt.created_at >= day_start,
                    Attempt.created_at <= day_end,
                    Attempt.is_correct == True,
                    QuestionGroup.learning_path_id == learning_path_id,
                ))
            )
        elif subject_id:
            total_stmt = (
                total_stmt
                .join(ExerciseItem, Attempt.exercise_item_id == ExerciseItem.id)
                .where(and_(
                    Attempt.user_id == user_id,
                    Attempt.created_at >= day_start,
                    Attempt.created_at <= day_end,
                    ExerciseItem.subject_id == subject_id,
                ))
            )
            correct_stmt = (
                correct_stmt
                .join(ExerciseItem, Attempt.exercise_item_id == ExerciseItem.id)
                .where(and_(
                    Attempt.user_id == user_id,
                    Attempt.created_at >= day_start,
                    Attempt.created_at <= day_end,
                    Attempt.is_correct == True,
                    ExerciseItem.subject_id == subject_id,
                ))
            )
        else:
            total_stmt = total_stmt.where(and_(
                Attempt.user_id == user_id,
                Attempt.created_at >= day_start,
                Attempt.created_at <= day_end,
            ))
            correct_stmt = correct_stmt.where(and_(
                Attempt.user_id == user_id,
                Attempt.created_at >= day_start,
                Attempt.created_at <= day_end,
                Attempt.is_correct == True,
            ))

        total_result = await db.execute(total_stmt)
        exercises_count = int(total_result.scalar() or 0)

        correct_result = await db.execute(correct_stmt)
        correct_count = int(correct_result.scalar() or 0)

        items.append(DailyDetailItem(
            date=day.isoformat(),
            exercises_count=exercises_count,
            correct_count=correct_count,
            study_minutes=exercises_count * 5,
        ))

    return DailyDetailResponse(items=items, total_days=len(items))


@router.get("/weekly/{user_id}", response_model=WeeklyReport)
async def weekly_report(
    user_id: UUID,
    subject_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> WeeklyReport:
    """获取用户周报"""
    stats_service = StatsService(db)
    stats = await stats_service.get_user_stats(str(user_id), str(subject_id) if subject_id else None)
    ability_data = await stats_service.get_ability_data(str(user_id), str(subject_id) if subject_id else None)
    wrong_details = await stats_service.get_wrong_details_by_topic(str(user_id), str(subject_id) if subject_id else None)

    # 构建薄弱项：基于真实错题数据生成描述
    weaknesses: Dict[str, str] = {}
    for tag, score in (ability_data or {}).items():
        if score < 60 or tag in wrong_details:
            # 从错题详情构建具体描述
            details = wrong_details.get(tag, [])
            if details:
                total_wrong = sum(d["wrong_count"] for d in details)
                stems = [d["stem_preview"] for d in details if d["stem_preview"]]
                desc_parts = [f"累计答错 {total_wrong} 次"]
                if score < 100:
                    desc_parts.append(f"正确率 {score}%")
                if stems:
                    desc_parts.append("典型错题: " + "; ".join(stems[:2]))
                weaknesses[tag] = "，".join(desc_parts)
            elif score < 60:
                weaknesses[tag] = f"正确率仅 {score}%，建议加强练习"

    week_start = datetime.utcnow() - timedelta(days=7)
    
    total_conditions = [
        Attempt.user_id == user_id,
        Attempt.created_at >= week_start
    ]
    
    total_stmt = select(func.count(Attempt.id))
    if subject_id:
        total_stmt = total_stmt.join(ExerciseItem, Attempt.exercise_item_id == ExerciseItem.id)
        total_stmt = total_stmt.where(and_(*total_conditions, ExerciseItem.subject_id == subject_id))
    else:
        total_stmt = total_stmt.where(and_(*total_conditions))
        
    total_result = await db.execute(total_stmt)
    total_submissions = int(total_result.scalar() or 0)

    correct_conditions = [
        Attempt.user_id == user_id,
        Attempt.created_at >= week_start,
        Attempt.is_correct == True
    ]

    correct_stmt = select(func.count(Attempt.id))
    if subject_id:
        correct_stmt = correct_stmt.join(ExerciseItem, Attempt.exercise_item_id == ExerciseItem.id)
        correct_stmt = correct_stmt.where(and_(*correct_conditions, ExerciseItem.subject_id == subject_id))
    else:
        correct_stmt = correct_stmt.where(and_(*correct_conditions))
        
    correct_result = await db.execute(correct_stmt)
    correct_submissions = int(correct_result.scalar() or 0)

    weekly_accuracy = (correct_submissions / total_submissions) if total_submissions else 0.0

    highlights: List[str] = []
    if total_submissions == 0:
        highlights.append("本周暂无练习记录，建议先完成 1 道基础题进行热身")
    else:
        highlights.append(f"本周共提交 {total_submissions} 次练习")
        highlights.append(f"本周正确率 {int(weekly_accuracy * 100)}%")
        if stats.streak_days:
            highlights.append(f"当前连续学习 {stats.streak_days} 天")

    recommendations: List[str] = []
    if weaknesses:
        # 取最弱项（差值最大）
        weak_item = max(weaknesses.items(), key=lambda x: x[1])
        recommendations.append(f"建议重点加强「{weak_item[0]}」相关练习（从简单题开始逐步提升）")
    if total_submissions == 0:
        recommendations.append("建议今天先用 15-20 分钟完成一次练习提交，建立学习节奏")
    recommendations.append("建议每天保持 30 分钟的学习时间")

    return WeeklyReport(
        highlights=highlights,
        weaknesses=weaknesses,
        recommendations=recommendations,
    )


async def _build_ability_radar_response(
    user_id: UUID,
    db: AsyncSession,
    ability_tags: Optional[str] = None,
    ability_data: Optional[Dict[str, int]] = None,
    subject_key: Optional[str] = None,
    subject_id: Optional[UUID] = None,
) -> AbilityRadarResponse:
    """
    获取用户能力雷达图数据（适配任意学科）

    如果提供了 ability_tags 参数，将使用该数据生成雷达图；
    否则从数据库推算；再无数据则使用学科默认维度。
    """
    import json

    # 优先使用传入的能力数据
    parsed_abilities: Dict[str, int] = ability_data or {}

    # 解析能力标签
    if not parsed_abilities and ability_tags:
        try:
            parsed_abilities = json.loads(ability_tags)
        except json.JSONDecodeError:
            pass

    # 如果没有提供，尝试从数据库推算
    if not parsed_abilities:
        stats_service = StatsService(db)
        parsed_abilities = await stats_service.get_ability_data(
            str(user_id), str(subject_id) if subject_id else None
        )

    # 如果仍然没有数据，新用户返回学科默认维度（分数均为 0）
    if not parsed_abilities:
        parsed_abilities = _get_default_abilities_for_subject(subject_key)
    else:
        # 真实数据维度不足时，用学科默认维度补齐（保留已有分数）
        default_dims = _get_default_abilities_for_subject(subject_key)
        merged = dict(default_dims)          # 先铺底所有默认维度（score=0）
        merged.update(parsed_abilities)       # 真实数据覆盖对应维度
        parsed_abilities = merged

    # 生成雷达数据
    radar_data = _generate_radar_data(parsed_abilities)

    # 计算总分
    overall_score = int(sum(p.score for p in radar_data) / len(radar_data)) if radar_data else 0

    # 确定等级
    level = _get_level_from_score(overall_score)

    # 获取学科名称用于摘要
    config = SUBJECT_CONFIGS.get(subject_key or "python")
    subject_name = config.name if config else "当前学科"

    # 生成摘要（通用，适配所有学科）
    if overall_score >= 80:
        summary = f"您的{subject_name}能力非常出色，可以挑战进阶内容！"
    elif overall_score >= 60:
        summary = f"您已掌握{subject_name}基础，继续加强薄弱环节。"
    elif overall_score >= 40:
        summary = f"正在稳步进步，建议多做{subject_name}相关练习巩固知识点。"
    else:
        summary = f"刚开始学习{subject_name}，建议从基础内容开始循序渐进。"

    return AbilityRadarResponse(
        data=radar_data,
        overall_score=overall_score,
        level=level,
        summary=summary
    )


@router.get("/radar/{user_id}", response_model=AbilityRadarResponse, summary="获取能力雷达数据")
async def get_ability_radar(
    user_id: UUID,
    ability_tags: Optional[str] = Query(None, description="能力标签JSON"),
    subject_key: Optional[str] = Query(None, description="学科标识，如 python / machine_learning / advanced_math"),
    subject_id: Optional[UUID] = Query(None, description="学科UUID，用于数据库过滤"),
    db: AsyncSession = Depends(get_db),
) -> AbilityRadarResponse:
    return await _build_ability_radar_response(
        user_id=user_id,
        db=db,
        ability_tags=ability_tags,
        ability_data=None,
        subject_key=subject_key,
        subject_id=subject_id,
    )


@router.get("/stats/{user_id}", response_model=LearningStatsResponse, summary="获取学习统计")
async def get_learning_stats(
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> LearningStatsResponse:
    """获取用户真实学习统计数据（从数据库查询）"""
    stats_service = StatsService(db)
    return await stats_service.get_user_stats(str(user_id))


@router.get("/dashboard/{user_id}", response_model=DashboardDataResponse, summary="获取仪表盘数据")
async def get_dashboard_data(
    user_id: UUID,
    ability_tags: Optional[str] = Query(None, description="能力标签JSON"),
    subject_key: Optional[str] = Query(None, description="学科标识"),
    subject_id: Optional[UUID] = Query(None, description="学科UUID"),
    db: AsyncSession = Depends(get_db)
) -> DashboardDataResponse:
    """
    获取仪表盘综合数据

    一次请求获取：
    - 能力雷达图数据
    - 学习统计数据
    - 推荐练习题
    - 下一课建议
    """
    # 获取雷达数据（使用真实能力数据）
    stats_service = StatsService(db)
    ability_data = await stats_service.get_ability_data(
        str(user_id), str(subject_id) if subject_id else None
    )

    # 如果用户提供了ability_tags，优先使用
    if ability_tags:
        import json
        try:
            ability_data = json.loads(ability_tags)
        except json.JSONDecodeError:
            pass

    radar = await _build_ability_radar_response(
        user_id=user_id,
        db=db,
        ability_data=ability_data,
        subject_key=subject_key,
        subject_id=subject_id,
    )

    # 获取统计数据
    stats = await stats_service.get_user_stats(str(user_id))

    # 生成推荐练习
    recommendations = []

    # 找出薄弱项推荐
    weak_categories = [p for p in radar.data if p.score < 60]
    if weak_categories:
        weak_categories.sort(key=lambda x: x.score)
        for weak in weak_categories[:3]:
            recommendations.append(RecommendedExercise(
                id=f"rec-{weak.category}",
                title=f"{weak.category}强化练习",
                difficulty=2,
                category=weak.category,
                reason=f"加强「{weak.category}」能力"
            ))

    # 如果推荐不足，从学科配置的默认主题中推荐
    if len(recommendations) < 3:
        config = SUBJECT_CONFIGS.get(subject_key or "python", SUBJECT_CONFIGS["python"])
        for theme_name, _ in config.default_themes:
            if len(recommendations) >= 3:
                break
            rec_id = f"gen-{theme_name}"
            if rec_id not in [r.id for r in recommendations]:
                recommendations.append(RecommendedExercise(
                    id=rec_id,
                    title=f"{theme_name}基础练习",
                    difficulty=1,
                    category=theme_name,
                    reason="巩固基础"
                ))

    # 确定下一课（基于薄弱点或学科默认主题）
    next_lesson = None
    next_lesson_title = None

    if weak_categories:
        # 推荐最薄弱的维度
        weakest = weak_categories[0]
        next_lesson = weakest.category
        next_lesson_title = f"{weakest.category}强化"
    else:
        # 从学科配置取第一个主题
        config = SUBJECT_CONFIGS.get(subject_key or "python", SUBJECT_CONFIGS["python"])
        if config.default_themes:
            next_lesson = config.default_themes[0][0]
            next_lesson_title = config.default_themes[0][0]

    return DashboardDataResponse(
        radar=radar,
        stats=stats,
        recommendations=recommendations[:3],
        next_lesson=next_lesson,
        next_lesson_title=next_lesson_title
    )
