from typing import Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..schemas.user import AbilityTags
from ..services.assessment_service import (
    get_assessment_questions,
    evaluate_assessment,
    AssessmentQuestion,
    AssessmentResult,
)


router = APIRouter()


# ==================== 请求/响应模型 ====================

class AssessmentStartResponse(BaseModel):
    """评估开始响应"""
    assessment_id: str
    questions: List[AssessmentQuestion]
    total_questions: int
    estimated_time_minutes: int


class AssessmentSubmission(BaseModel):
    """评估提交请求"""
    assessment_id: str
    answers: Dict[int, int]  # {题目ID: 用户选择的答案索引}


class AssessmentResultResponse(BaseModel):
    """评估结果响应"""
    result: AssessmentResult
    ability_tags: Dict[str, int]
    next_steps: List[str]


# 存储进行中的评估
_active_assessments: Dict[str, Dict] = {}


# ==================== 新用户水平评估 API ====================

@router.get("/assessment", response_model=AssessmentStartResponse, summary="获取水平评估题目")
async def get_assessment(
    question_count: int = 10
) -> AssessmentStartResponse:
    """
    获取新用户水平评估题目

    返回一组用于评估用户 Python 水平的题目，
    包含基础语法、条件循环、数据结构、函数等方面的问题。
    """
    assessment_id = str(uuid4())
    questions = get_assessment_questions(count=question_count)

    # 保存评估会话
    _active_assessments[assessment_id] = {
        "questions": questions,
        "created_at": str(uuid4()),  # 简化时间戳
    }

    return AssessmentStartResponse(
        assessment_id=assessment_id,
        questions=questions,
        total_questions=len(questions),
        estimated_time_minutes=len(questions) * 2  # 每题约2分钟
    )


@router.post("/{user_id}/submit", response_model=AssessmentResultResponse, summary="提交评估答案")
async def submit_assessment(
    user_id: UUID,
    submission: AssessmentSubmission
) -> AssessmentResultResponse:
    """
    提交水平评估答案并获取结果

    根据用户的答案进行评分，生成：
    - 总分和等级
    - 各项能力标签分数
    - 学习建议
    """
    # 验证评估会话
    if submission.assessment_id not in _active_assessments:
        raise HTTPException(
            status_code=404,
            detail="评估会话不存在或已过期"
        )

    # 评估答案
    result = evaluate_assessment(submission.answers)

    # 清理已完成的评估会话
    del _active_assessments[submission.assessment_id]

    # 生成后续步骤建议
    next_steps = []
    if result.level == "入门":
        next_steps = [
            "开始学习「输出与打印」基础知识",
            "完成变量与数据类型的入门练习",
            "熟悉 Python 基本语法规则"
        ]
    elif result.level == "初级":
        next_steps = [
            "学习条件语句和循环结构",
            "练习使用列表和字典",
            "掌握基本的函数定义"
        ]
    elif result.level == "中级":
        next_steps = [
            "深入学习函数的高级用法",
            "掌握列表推导式和生成器",
            "学习异常处理机制"
        ]
    else:
        next_steps = [
            "学习面向对象编程",
            "探索 Python 高级特性",
            "尝试综合项目练习"
        ]

    return AssessmentResultResponse(
        result=result,
        ability_tags=result.ability_tags,
        next_steps=next_steps
    )


# ==================== 旧版 API (保持兼容) ====================

@router.get("/starter-quiz")
async def starter_quiz() -> Dict[str, List[Dict[str, str]]]:
    """Returns a lightweight adaptive quiz seed (deprecated, use /assessment)"""
    questions = [
        {"id": "q1", "type": "choice", "text": "What is the output of print(1==True)"},
        {"id": "q2", "type": "code_reading", "text": "Identify bug in a loop"},
    ]
    return {"quiz_id": str(uuid4()), "questions": questions}


@router.post("/{user_id}/results", response_model=AbilityTags)
async def submit_results(user_id: UUID, answers: Dict[str, str]) -> AbilityTags:
    """Mock scoring (deprecated, use /submit)"""
    base_score = 60 + (len(answers) % 5) * 5
    return AbilityTags(tags={"syntax": base_score, "loops": base_score - 5, "functions": base_score - 10})
