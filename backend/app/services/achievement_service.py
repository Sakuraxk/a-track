"""
成就与等级服务
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.subject import (
    AchievementBadge,
    UserAchievement,
    UserGamificationProfile,
    UserWrongQuestion,
)
from ..models.base import utcnow_naive


def _coerce_uuid(value: object) -> UUID:
    if isinstance(value, UUID):
        return value
    return UUID(str(value))


def _as_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _xp_for_next_level(level: int) -> int:
    """计算升到下一级所需XP: 100 + (level-1) * 50"""
    base = 100
    increment = 50
    safe_level = max(level, 1)
    return base + (safe_level - 1) * increment


def _badge_payload(badge: AchievementBadge, achievement: UserAchievement) -> Dict[str, Any]:
    return {
        "badge_id": str(badge.id),
        "code": badge.code,
        "name": badge.name,
        "description": badge.description,
        "icon": badge.icon,
        "awarded_at": achievement.awarded_at,
        "meta": achievement.meta,
    }


async def _get_badge_stats(db: AsyncSession, user_id: UUID) -> Dict[str, int]:
    """获取用于徽章判定的统计数据"""
    total_wrong_result = await db.execute(
        select(func.count(UserWrongQuestion.id)).where(UserWrongQuestion.user_id == user_id)
    )
    total_wrong = total_wrong_result.scalar() or 0

    resolved_wrong_result = await db.execute(
        select(func.count(UserWrongQuestion.id)).where(
            UserWrongQuestion.user_id == user_id,
            UserWrongQuestion.resolved_at.isnot(None),
        )
    )
    resolved_wrong = resolved_wrong_result.scalar() or 0

    achievements_result = await db.execute(
        select(func.count(UserAchievement.id)).where(UserAchievement.user_id == user_id)
    )
    badges_count = achievements_result.scalar() or 0

    return {
        "wrong_questions_total": int(total_wrong),
        "wrong_questions_resolved": int(resolved_wrong),
        "badges_count": int(badges_count),
    }


def _criteria_met(
    criteria: Optional[Dict[str, Any]],
    profile: UserGamificationProfile,
    stats: Dict[str, int],
) -> bool:
    """检查徽章条件是否满足"""
    if not criteria or not isinstance(criteria, dict):
        return False

    if "all_of" in criteria:
        items = criteria.get("all_of")
        if not isinstance(items, list):
            return False
        return all(_criteria_met(item, profile, stats) for item in items)

    if "any_of" in criteria:
        items = criteria.get("any_of")
        if not isinstance(items, list):
            return False
        return any(_criteria_met(item, profile, stats) for item in items)

    allowed_keys = {
        "min_level",
        "min_xp",
        "min_total_points",
        "min_wrong_questions_resolved",
        "min_wrong_questions",
        "min_badges",
    }
    for key in criteria:
        if key not in allowed_keys:
            return False

    if "min_level" in criteria and profile.level < _as_int(criteria.get("min_level")):
        return False
    if "min_xp" in criteria and profile.xp < _as_int(criteria.get("min_xp")):
        return False
    if "min_total_points" in criteria and profile.total_points < _as_int(criteria.get("min_total_points")):
        return False
    if "min_wrong_questions_resolved" in criteria:
        if stats["wrong_questions_resolved"] < _as_int(criteria.get("min_wrong_questions_resolved")):
            return False
    if "min_wrong_questions" in criteria:
        if stats["wrong_questions_total"] < _as_int(criteria.get("min_wrong_questions")):
            return False
    if "min_badges" in criteria and stats["badges_count"] < _as_int(criteria.get("min_badges")):
        return False

    return True


async def get_or_create_gamification_profile(
    db: AsyncSession,
    user_id: str,
) -> UserGamificationProfile:
    """获取或创建用户等级档案"""
    user_uuid = _coerce_uuid(user_id)
    result = await db.execute(
        select(UserGamificationProfile).where(UserGamificationProfile.user_id == user_uuid)
    )
    profile = result.scalar_one_or_none()
    if profile:
        return profile

    profile = UserGamificationProfile(
        user_id=user_uuid,
        level=1,
        xp=0,
        total_points=0,
    )
    db.add(profile)
    return profile


async def add_xp(
    db: AsyncSession,
    user_id: str,
    xp_amount: int,
    reason: str,
) -> Dict[str, Any]:
    """增加经验值并处理升级"""
    profile = await get_or_create_gamification_profile(db, user_id)
    xp_delta = _as_int(xp_amount)

    profile.xp = max((profile.xp or 0) + xp_delta, 0)
    if xp_delta > 0:
        profile.total_points = (profile.total_points or 0) + xp_delta

    leveled_up = False
    levels_gained = 0
    next_level_xp = _xp_for_next_level(profile.level)

    while profile.xp >= next_level_xp:
        profile.xp -= next_level_xp
        profile.level += 1
        leveled_up = True
        levels_gained += 1
        next_level_xp = _xp_for_next_level(profile.level)

    return {
        "profile": profile,
        "leveled_up": leveled_up,
        "levels_gained": levels_gained,
        "next_level_xp": next_level_xp,
        "xp_added": xp_delta,
        "reason": reason,
    }


async def check_and_award_badges(db: AsyncSession, user_id: str) -> List[Dict[str, Any]]:
    """检查徽章条件并授予徽章"""
    user_uuid = _coerce_uuid(user_id)
    profile = await get_or_create_gamification_profile(db, user_id)

    badges_result = await db.execute(
        select(AchievementBadge).where(AchievementBadge.is_active.is_(True))
    )
    badges = badges_result.scalars().all()

    existing_result = await db.execute(
        select(UserAchievement).where(UserAchievement.user_id == user_uuid)
    )
    existing_achievements = existing_result.scalars().all()
    existing_badge_ids = {achievement.badge_id for achievement in existing_achievements}

    stats = await _get_badge_stats(db, user_uuid)
    awarded: List[Dict[str, Any]] = []
    now = utcnow_naive()

    for badge in badges:
        if badge.id in existing_badge_ids:
            continue
        if not _criteria_met(badge.criteria, profile, stats):
            continue

        achievement = UserAchievement(
            user_id=user_uuid,
            badge_id=badge.id,
            awarded_at=now,
            meta={"criteria": badge.criteria} if badge.criteria else None,
        )
        db.add(achievement)
        awarded.append(_badge_payload(badge, achievement))

    return awarded


async def get_user_achievements(db: AsyncSession, user_id: str) -> List[Dict[str, Any]]:
    """获取用户已获徽章"""
    user_uuid = _coerce_uuid(user_id)

    stmt = (
        select(UserAchievement, AchievementBadge)
        .join(AchievementBadge, UserAchievement.badge_id == AchievementBadge.id)
        .where(UserAchievement.user_id == user_uuid)
        .order_by(UserAchievement.awarded_at.desc())
    )
    result = await db.execute(stmt)

    badges = []
    for achievement, badge in result.all():
        badges.append(_badge_payload(badge, achievement))
    return badges


async def get_user_level_info(db: AsyncSession, user_id: str) -> Dict[str, Any]:
    """获取用户等级信息"""
    profile = await get_or_create_gamification_profile(db, user_id)
    next_level_xp = _xp_for_next_level(profile.level)
    xp_to_next_level = max(next_level_xp - (profile.xp or 0), 0)
    progress_percent = round((profile.xp / next_level_xp) * 100, 2) if next_level_xp else 0.0

    return {
        "level": profile.level,
        "xp": profile.xp,
        "next_level_xp": next_level_xp,
        "xp_to_next_level": xp_to_next_level,
        "total_points": profile.total_points,
        "progress_percent": progress_percent,
    }
