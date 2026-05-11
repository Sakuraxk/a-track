"""用户学习统计服务 - 从数据库获取真实数据"""
from datetime import datetime, timedelta
from uuid import UUID
from typing import Dict, List, Optional
from sqlalchemy import func, select, and_, distinct, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subject import Attempt, UserExerciseProgress, ExerciseItem, QuestionGroup
from app.schemas.reporting import LearningStatsResponse


def _get_total_exercises_count() -> int:
    """获取题库中的题目总数"""
    # 延迟导入避免循环依赖
    from app.routers.practice import _EXERCISES
    return len(_EXERCISES)


class StatsService:
    """统计服务 - 从数据库获取用户真实学习数据"""

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _coerce_uuid(value: object) -> UUID:
        if isinstance(value, UUID):
            return value
        return UUID(str(value))

    async def get_user_stats(self, user_id: str, subject_id: Optional[str] = None) -> LearningStatsResponse:
        """获取用户真实学习统计数据"""
        user_uuid = self._coerce_uuid(user_id)
        subject_uuid = self._coerce_uuid(subject_id) if subject_id else None
        
        # 查询已完成的题目数（去重）
        completed_exercises = await self._count_completed_exercises(user_uuid, subject_uuid)

        # 计算正确率
        accuracy_rate = await self._calculate_accuracy_rate(user_uuid, subject_uuid)

        # 计算连胜天数
        streak_days = await self._calculate_streak_days(user_uuid, subject_uuid)

        # 获取最近7天活动（每天的练习时间，估算每道题5分钟）
        weekly_activity = await self._get_weekly_activity(user_uuid, subject_uuid)

        # 总学习时长：基于所有历史提交次数估算（每道题5分钟）
        total_study_minutes = await self._calculate_total_study_minutes(user_uuid, subject_uuid)

        # 从数据库动态获取总题目数
        total_exercises = await self._get_total_exercises_count(subject_uuid)

        return LearningStatsResponse(
            total_exercises=total_exercises,
            completed_exercises=completed_exercises,
            accuracy_rate=accuracy_rate,
            total_study_minutes=total_study_minutes,
            streak_days=streak_days,
            weekly_activity=weekly_activity
        )

    async def _calculate_total_study_minutes(self, user_id: UUID, subject_id: Optional[UUID] = None) -> int:
        """计算用户总学习时长（基于所有提交记录估算，每道题约5分钟）"""
        stmt = select(func.count(Attempt.id))
        if subject_id:
            stmt = stmt.join(ExerciseItem, Attempt.exercise_item_id == ExerciseItem.id)
            stmt = stmt.where(and_(Attempt.user_id == user_id, ExerciseItem.subject_id == subject_id))
        else:
            stmt = stmt.where(Attempt.user_id == user_id)
        result = await self.db.execute(stmt)
        total_attempts = result.scalar() or 0
        return total_attempts * 5

    async def _get_total_exercises_count(self, subject_id: Optional[UUID] = None) -> int:
        """获取题目总数"""
        stmt = select(func.count(ExerciseItem.id))
        if subject_id:
            stmt = stmt.where(ExerciseItem.subject_id == subject_id)
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def _count_completed_exercises(self, user_id: UUID, subject_id: Optional[UUID] = None) -> int:
        """统计用户已完成的题目数（去重，status in [completed, mastered]）"""
        conditions = [
            UserExerciseProgress.user_id == user_id,
            UserExerciseProgress.status.in_(["completed", "mastered"])
        ]
        
        stmt = select(func.count(distinct(UserExerciseProgress.exercise_item_id)))
        
        if subject_id:
            # 需要关联 ExerciseItem 来过滤学科
            stmt = stmt.join(ExerciseItem, UserExerciseProgress.exercise_item_id == ExerciseItem.id)
            stmt = stmt.where(and_(*conditions, ExerciseItem.subject_id == subject_id))
        else:
            stmt = stmt.where(and_(*conditions))
            
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def _calculate_accuracy_rate(self, user_id: UUID, subject_id: Optional[UUID] = None) -> float:
        """计算用户的正确率"""
        # 查询总提交次数
        total_stmt = select(func.count(Attempt.id))
        
        if subject_id:
            total_stmt = total_stmt.join(ExerciseItem, Attempt.exercise_item_id == ExerciseItem.id)
            total_stmt = total_stmt.where(and_(Attempt.user_id == user_id, ExerciseItem.subject_id == subject_id))
        else:
            total_stmt = total_stmt.where(Attempt.user_id == user_id)
            
        total_result = await self.db.execute(total_stmt)
        total_count = total_result.scalar() or 0

        if total_count == 0:
            return 0.0

        # 查询正确次数
        correct_stmt = select(func.count(Attempt.id))
        
        if subject_id:
            correct_stmt = correct_stmt.join(ExerciseItem, Attempt.exercise_item_id == ExerciseItem.id)
            correct_stmt = correct_stmt.where(
                and_(
                    Attempt.user_id == user_id, 
                    Attempt.is_correct == True,
                    ExerciseItem.subject_id == subject_id
                )
            )
        else:
            correct_stmt = correct_stmt.where(
                and_(
                    Attempt.user_id == user_id, 
                    Attempt.is_correct == True
                )
            )
            
        correct_result = await self.db.execute(correct_stmt)
        correct_count = correct_result.scalar() or 0

        return round(correct_count / total_count, 2)

    async def _calculate_streak_days(self, user_id: UUID, subject_id: Optional[UUID] = None) -> int:
        """计算连续学习天数"""
        stmt = select(func.date(Attempt.created_at)).distinct()
        
        if subject_id:
            stmt = stmt.join(ExerciseItem, Attempt.exercise_item_id == ExerciseItem.id)
            stmt = stmt.where(and_(Attempt.user_id == user_id, ExerciseItem.subject_id == subject_id))
        else:
            stmt = stmt.where(Attempt.user_id == user_id)
            
        stmt = stmt.order_by(func.date(Attempt.created_at).desc())
        
        result = await self.db.execute(stmt)
        dates = [row[0] for row in result.fetchall()]

        if not dates:
            return 0

        # 计算连续天数
        streak = 0
        today = datetime.now().date()

        for i, d in enumerate(dates):
            expected_date = today - timedelta(days=i)
            if d == expected_date:
                streak += 1
            else:
                break

        return streak

    async def _get_weekly_activity(self, user_id: UUID, subject_id: Optional[UUID] = None) -> List[int]:
        """获取最近7天的学习活动（每天的估算学习时间）— 单次查询"""
        today = datetime.now().date()
        week_start = datetime.combine(today - timedelta(days=6), datetime.min.time())

        stmt = (
            select(
                func.date(Attempt.created_at).label("day"),
                func.count(Attempt.id).label("cnt"),
            )
            .where(
                Attempt.user_id == user_id,
                Attempt.created_at >= week_start,
            )
            .group_by(func.date(Attempt.created_at))
        )

        if subject_id:
            stmt = stmt.join(ExerciseItem, Attempt.exercise_item_id == ExerciseItem.id)
            stmt = stmt.where(ExerciseItem.subject_id == subject_id)

        result = await self.db.execute(stmt)
        day_counts = {row.day: row.cnt for row in result.fetchall()}

        # 构建7天数组（从6天前到今天），每题约5分钟
        return [day_counts.get(today - timedelta(days=i), 0) * 5 for i in range(6, -1, -1)]

    async def get_ability_data(self, user_id: str, subject_id: Optional[str] = None) -> Dict[str, int]:
        """从练习结果推算用户各知识点能力数据 (基于真实错题统计)"""
        user_uuid = self._coerce_uuid(user_id)
        subject_uuid = self._coerce_uuid(subject_id) if subject_id else None

        # 按 QuestionGroup 的 source_chapter_title 分组统计 正确数/总数
        stmt = (
            select(
                QuestionGroup.source_chapter_title,
                func.count(Attempt.id).label("total"),
                func.count(case((Attempt.is_correct == True, 1))).label("correct"),
            )
            .join(ExerciseItem, Attempt.exercise_item_id == ExerciseItem.id)
            .join(QuestionGroup, ExerciseItem.question_group_id == QuestionGroup.id)
            .where(Attempt.user_id == user_uuid)
            .group_by(QuestionGroup.source_chapter_title)
        )
        if subject_uuid:
            stmt = stmt.where(ExerciseItem.subject_id == subject_uuid)

        result = await self.db.execute(stmt)
        rows = result.fetchall()

        if not rows:
            return {}

        ability: Dict[str, int] = {}
        for row in rows:
            chapter = row.source_chapter_title or "其他"
            total = row.total or 0
            correct = row.correct or 0
            score = int((correct / total) * 100) if total > 0 else 0
            ability[chapter] = score

        return ability

    async def get_wrong_details_by_topic(
        self, user_id: str, subject_id: Optional[str] = None, limit_per_topic: int = 3
    ) -> Dict[str, list]:
        """获取各知识点下的错题详情: {topic: [{title, wrong_count, last_wrong_at}, ...]}"""
        user_uuid = self._coerce_uuid(user_id)
        subject_uuid = self._coerce_uuid(subject_id) if subject_id else None

        # 查出所有错误 Attempt, 关联 ExerciseItem + QuestionGroup
        stmt = (
            select(
                QuestionGroup.source_chapter_title,
                QuestionGroup.source_task_title,
                ExerciseItem.stem,
                func.count(Attempt.id).label("wrong_count"),
                func.max(Attempt.created_at).label("last_wrong_at"),
            )
            .join(ExerciseItem, Attempt.exercise_item_id == ExerciseItem.id)
            .join(QuestionGroup, ExerciseItem.question_group_id == QuestionGroup.id)
            .where(and_(Attempt.user_id == user_uuid, Attempt.is_correct == False))
            .group_by(
                QuestionGroup.source_chapter_title,
                QuestionGroup.source_task_title,
                ExerciseItem.stem,
            )
            .order_by(func.count(Attempt.id).desc())
        )
        if subject_uuid:
            stmt = stmt.where(ExerciseItem.subject_id == subject_uuid)

        result = await self.db.execute(stmt)
        rows = result.fetchall()

        topic_details: Dict[str, list] = {}
        for row in rows:
            chapter = row.source_chapter_title or "其他"
            if chapter not in topic_details:
                topic_details[chapter] = []
            if len(topic_details[chapter]) < limit_per_topic:
                topic_details[chapter].append({
                    "task_title": row.source_task_title or "",
                    "stem_preview": (row.stem or "")[:60],
                    "wrong_count": row.wrong_count,
                    "last_wrong_at": row.last_wrong_at.isoformat() if row.last_wrong_at else None,
                })

        return topic_details
