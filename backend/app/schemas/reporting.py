from typing import Dict, List, Optional
from pydantic import BaseModel


class ProgressSummary(BaseModel):
    total_minutes: int
    completed_nodes: int
    completed_exercises: int
    recent_activity: List[str]


class WeeklyReport(BaseModel):
    highlights: List[str]
    weaknesses: Dict[str, str]
    recommendations: List[str]


class RadarDataPoint(BaseModel):
    """能力雷达图数据点"""
    category: str
    score: int
    full_score: int = 100


class AbilityRadarResponse(BaseModel):
    """能力雷达图响应"""
    data: List[RadarDataPoint]
    overall_score: int
    level: str
    summary: str


class LearningStatsResponse(BaseModel):
    """学习统计响应"""
    total_exercises: int
    completed_exercises: int
    accuracy_rate: float
    total_study_minutes: int
    streak_days: int
    weekly_activity: List[int]  # 最近7天的学习时长


class RecommendedExercise(BaseModel):
    """推荐练习题"""
    id: str
    title: str
    difficulty: int
    category: str
    reason: str


class DashboardDataResponse(BaseModel):
    """仪表盘综合数据响应"""
    radar: AbilityRadarResponse
    stats: LearningStatsResponse
    recommendations: List[RecommendedExercise]
    next_lesson: Optional[str] = None
    next_lesson_title: Optional[str] = None


class DailyDetailItem(BaseModel):
    """每日学习详情"""
    date: str                # "2026-03-22"
    exercises_count: int     # 当日做题数
    correct_count: int       # 正确数
    study_minutes: int       # 学习时长(分钟)


class DailyDetailResponse(BaseModel):
    """每日学习趋势数据"""
    items: List[DailyDetailItem]
    total_days: int
