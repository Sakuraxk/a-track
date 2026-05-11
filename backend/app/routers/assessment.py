"""
Subject Assessment API routes.

Provides endpoints for:
- Starting a new assessment session
- Submitting assessment answers
- Completing assessment and generating learning path
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from app.models.subject import Subject, UserSubjectProfile

router = APIRouter()


class StartAssessmentRequest(BaseModel):
    subject_id: UUID
    user_id: UUID
    self_reported_level: str  # beginner, intermediate, advanced


class StartAssessmentResponse(BaseModel):
    session_id: UUID
    subject_name: str
    questions: list[dict]  # Questions without correct answers


def sanitize_question(q: dict) -> dict:
    """Remove correct answer from a single question"""
    return {
        "id": q["id"],
        "question": q["question"],
        "options": q["options"],
        "difficulty": q["difficulty"],
    }


def sanitize_questions(questions: list[dict]) -> list[dict]:
    """Remove correct answers from questions before sending to frontend"""
    return [sanitize_question(q) for q in questions]


class SubmitAnswerRequest(BaseModel):
    session_id: UUID
    question_id: str
    answer: str


class SubmitAnswerResponse(BaseModel):
    is_correct: bool
    next_question: Optional[dict] = None
    is_complete: bool


class CompleteAssessmentRequest(BaseModel):
    session_id: UUID
    user_id: UUID
    learning_goals: list[str]


class CompleteAssessmentResponse(BaseModel):
    success: bool
    assessed_level: str
    learning_path_summary: dict


class SkipAssessmentRequest(BaseModel):
    subject_id: UUID
    user_id: UUID
    self_reported_level: str = "beginner"  # Default to beginner when skipping


class SkipAssessmentResponse(BaseModel):
    success: bool
    message: str



# Diagnostic questions by subject (simplified for now)
DIAGNOSTIC_QUESTIONS = {
    "python": [
        {
            "id": "py-q1",
            "question": "Python 中如何定义一个变量？",
            "options": ["var x = 1", "x = 1", "int x = 1", "let x = 1"],
            "correct": 1,
            "difficulty": 1,
        },
        {
            "id": "py-q2",
            "question": "以下哪个是 Python 的列表方法？",
            "options": ["push()", "append()", "add()", "insert_end()"],
            "correct": 1,
            "difficulty": 1,
        },
        {
            "id": "py-q3",
            "question": "Python 中 for 循环的正确语法是？",
            "options": [
                "for (i = 0; i < 10; i++)",
                "for i in range(10):",
                "foreach i in range(10)",
                "for i = 0 to 10",
            ],
            "correct": 1,
            "difficulty": 1,
        },
        {
            "id": "py-q4",
            "question": "如何在 Python 中定义一个函数？",
            "options": ["function foo():", "def foo():", "fn foo():", "func foo():"],
            "correct": 1,
            "difficulty": 2,
        },
        {
            "id": "py-q5",
            "question": "Python 中的字典(dict)使用什么符号定义？",
            "options": ["[]", "()", "{}", "<>"],
            "correct": 2,
            "difficulty": 2,
        },
        {
            "id": "py-q6",
            "question": "以下哪个是 Python 的内置数据类型？",
            "options": ["array", "tuple", "vector", "hashmap"],
            "correct": 1,
            "difficulty": 2,
        },
    ],
    "machine_learning": [
        {
            "id": "ml-q1",
            "question": "监督学习和无监督学习的主要区别是什么？",
            "options": [
                "数据量大小",
                "是否有标签数据",
                "算法复杂度",
                "训练时间",
            ],
            "correct": 1,
            "difficulty": 1,
        },
        {
            "id": "ml-q2",
            "question": "线性回归用于解决什么类型的问题？",
            "options": ["分类问题", "回归问题", "聚类问题", "降维问题"],
            "correct": 1,
            "difficulty": 1,
        },
        {
            "id": "ml-q3",
            "question": "过拟合(Overfitting)是指什么？",
            "options": [
                "模型在训练集上表现差",
                "模型在测试集上表现好",
                "模型过度学习训练数据的噪声",
                "模型训练时间过长",
            ],
            "correct": 2,
            "difficulty": 2,
        },
    ],

    "advanced_math": [
        {
            "id": "math-q1",
            "question": "函数 f(x) = x² 在 x = 2 处的导数是？",
            "options": ["2", "4", "8", "1"],
            "correct": 1,
            "difficulty": 1,
        },
        {
            "id": "math-q2",
            "question": "∫x dx 的结果是？",
            "options": ["x", "x²/2 + C", "2x", "1"],
            "correct": 1,
            "difficulty": 1,
        },
        {
            "id": "math-q3",
            "question": "lim(x→0) sin(x)/x 的值是？",
            "options": ["0", "1", "∞", "不存在"],
            "correct": 1,
            "difficulty": 2,
        },
    ],
    "linear_algebra": [
        {
            "id": "la-q1",
            "question": "矩阵乘法是否满足交换律？",
            "options": ["满足", "不满足", "视情况而定", "仅方阵满足"],
            "correct": 1,
            "difficulty": 1,
        },
        {
            "id": "la-q2",
            "question": "什么是单位矩阵？",
            "options": ["所有元素均为1的矩阵", "对角线元素为1，其余为0的方阵", "所有元素均为0的矩阵", "不可逆的矩阵"],
            "correct": 1,
            "difficulty": 1,
        },
        {
            "id": "la-q3",
            "question": "行列式的值为0代表什么？",
            "options": ["矩阵可逆", "矩阵不可逆", "矩阵是对角阵", "矩阵是正交阵"],
            "correct": 1,
            "difficulty": 2,
        },
    ],
    "statistics": [
        {
            "id": "stat-q1",
            "question": "以下哪项是衡量数据离散程度的指标？",
            "options": ["平均数", "中位数", "方差", "众数"],
            "correct": 2,
            "difficulty": 1,
        },
        {
            "id": "stat-q2",
            "question": "正态分布曲线的形状是？",
            "options": ["U型", "钟型", "直线型", "波浪型"],
            "correct": 1,
            "difficulty": 1,
        },
        {
            "id": "stat-q3",
            "question": "假设检验中的p值越小说明什么？",
            "options": ["越应该接受原假设", "拒绝原假设的理由越充分", "样本量不够", "检验方法错误"],
            "correct": 1,
            "difficulty": 2,
        },
    ],
    "probability": [
        {
            "id": "prob-q1",
            "question": "抛掷一枚均匀硬币，正面朝上的概率是？",
            "options": ["0", "0.5", "1", "0.25"],
            "correct": 1,
            "difficulty": 1,
        },
        {
            "id": "prob-q2",
            "question": "独立事件A和B同时发生的概率P(AB)等于？",
            "options": ["P(A) + P(B)", "P(A) - P(B)", "P(A) * P(B)", "P(A) / P(B)"],
            "correct": 2,
            "difficulty": 1,
        },
        {
            "id": "prob-q3",
            "question": "必然事件的概率是？",
            "options": ["0", "0.5", "1", "无穷大"],
            "correct": 2,
            "difficulty": 1,
        },
    ],
    "ai_literacy": [
        {
            "id": "ai-q1",
            "question": "人工智能（AI）主要研究什么？",
            "options": ["如何让计算机模拟人类智能", "如何制造更快的CPU", "如何编写更好的操作系统", "如何提高网络速度"],
            "correct": 0,
            "difficulty": 1,
        },
        {
            "id": "ai-q2",
            "question": "以下哪个是大语言模型（LLM）的代表？",
            "options": ["Windows", "ChatGPT", "Photoshop", "Excel"],
            "correct": 1,
            "difficulty": 1,
        },
        {
            "id": "ai-q3",
            "question": "深度学习是机器学习的一个分支吗？",
            "options": ["是", "不是", "它们没有关系", "机器学习是深度学习的分支"],
            "correct": 0,
            "difficulty": 2,
        },
    ],

}


# In-memory session storage (should use Redis in production)
_assessment_sessions: dict[str, dict] = {}


@router.post("/start", response_model=StartAssessmentResponse)
async def start_assessment(
    request: StartAssessmentRequest,
    db: AsyncSession = Depends(get_db),
):
    """Start a new assessment session for a subject"""
    # Get subject
    subject_result = await db.execute(
        select(Subject).where(Subject.id == request.subject_id)
    )
    subject = subject_result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Get or create user subject profile
    profile_result = await db.execute(
        select(UserSubjectProfile).where(
            UserSubjectProfile.user_id == request.user_id,
            UserSubjectProfile.subject_id == request.subject_id,
        )
    )
    profile = profile_result.scalar_one_or_none()

    if not profile:
        profile = UserSubjectProfile(
            user_id=request.user_id,
            subject_id=request.subject_id,
            onboarding_status="in_progress",
            level=request.self_reported_level,
        )
        db.add(profile)
    else:
        # Don't reset status if already completed — avoid forcing re-assessment
        if profile.onboarding_status != "completed":
            profile.onboarding_status = "in_progress"
        profile.level = request.self_reported_level

    await db.commit()
    await db.refresh(profile)

    # Get diagnostic questions for this subject
    questions = DIAGNOSTIC_QUESTIONS.get(subject.key, DIAGNOSTIC_QUESTIONS["python"])

    # Create session
    session_id = profile.id
    _assessment_sessions[str(session_id)] = {
        "user_id": str(request.user_id),
        "subject_id": str(request.subject_id),
        "subject_key": subject.key,
        "self_reported_level": request.self_reported_level,
        "questions": questions,
        "current_index": 0,
        "answers": [],
        "score": 0,
    }

    return StartAssessmentResponse(
        session_id=session_id,
        subject_name=subject.name,
        questions=sanitize_questions(questions),
    )


@router.post("/answer", response_model=SubmitAnswerResponse)
async def submit_answer(request: SubmitAnswerRequest):
    """Submit an answer for the current question"""
    session = _assessment_sessions.get(str(request.session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    questions = session["questions"]
    current_idx = session["current_index"]

    if current_idx >= len(questions):
        return SubmitAnswerResponse(
            is_correct=False, next_question=None, is_complete=True
        )

    current_question = questions[current_idx]

    # Prevent out-of-sync submissions (e.g. double-click)
    if request.question_id != current_question.get("id"):
        raise HTTPException(status_code=409, detail="Question out of sync")

    try:
        answer_idx = int(request.answer)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid answer format")

    options = current_question.get("options") or []
    if answer_idx < 0 or answer_idx >= len(options):
        raise HTTPException(status_code=400, detail="Answer index out of range")

    is_correct = current_question["correct"] == answer_idx

    session["answers"].append(
        {
            "question_id": request.question_id,
            "answer": request.answer,
            "is_correct": is_correct,
        }
    )
    if is_correct:
        session["score"] += 1

    session["current_index"] += 1

    # Check if complete
    if session["current_index"] >= len(questions):
        return SubmitAnswerResponse(
            is_correct=is_correct, next_question=None, is_complete=True
        )

    return SubmitAnswerResponse(
        is_correct=is_correct,
        next_question=sanitize_question(questions[session["current_index"]]),
        is_complete=False,
    )


@router.post("/complete", response_model=CompleteAssessmentResponse)
async def complete_assessment(
    request: CompleteAssessmentRequest,
    db: AsyncSession = Depends(get_db),
):
    """Complete assessment and generate learning path"""
    session = _assessment_sessions.get(str(request.session_id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Calculate assessed level based on score
    total_questions = len(session["questions"])
    score = session["score"]
    score_percent = (score / total_questions * 100) if total_questions > 0 else 0

    if score_percent >= 80:
        assessed_level = "advanced"
    elif score_percent >= 50:
        assessed_level = "intermediate"
    else:
        assessed_level = "beginner"

    # Update user subject profile
    await db.execute(
        update(UserSubjectProfile)
        .where(UserSubjectProfile.id == request.session_id)
        .values(
            onboarding_status="completed",
            level=assessed_level,
            goal=",".join(request.learning_goals),
            diagnostic_summary={
                "diagnostic_score": score_percent,
                "assessed_level": assessed_level,
                "learning_goals": request.learning_goals,
                "self_reported_level": session.get("self_reported_level"),
                "score": score,
                "total_questions": total_questions,
                "answers": session.get("answers", []),
            },
        )
    )
    await db.commit()

    # Generate learning path summary (simplified - would use AI in production)
    learning_path_summary = {
        "title": f"个性化学习路径",
        "level": assessed_level,
        "estimated_weeks": 4 if assessed_level == "beginner" else (3 if assessed_level == "intermediate" else 2),
        "total_nodes": 35,
        "first_chapter": "基础入门" if assessed_level == "beginner" else "进阶提升",
        "goals": request.learning_goals,
    }

    # Clean up session
    del _assessment_sessions[str(request.session_id)]

    return CompleteAssessmentResponse(
        success=True,
        assessed_level=assessed_level,
        learning_path_summary=learning_path_summary,
    )


@router.get("/status")
async def get_assessment_status(
    subject_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Check if user has completed onboarding for a subject"""
    profile_result = await db.execute(
        select(UserSubjectProfile).where(
            UserSubjectProfile.user_id == user_id,
            UserSubjectProfile.subject_id == subject_id,
        )
    )
    profile = profile_result.scalar_one_or_none()

    if not profile:
        return {"needs_onboarding": True, "status": "not_started"}

    return {
        "needs_onboarding": profile.onboarding_status != "completed",
        "status": profile.onboarding_status,
        "assessed_level": profile.diagnostic_summary.get("assessed_level") if profile.diagnostic_summary else None,
    }


@router.post("/skip", response_model=SkipAssessmentResponse)
async def skip_assessment(
    request: SkipAssessmentRequest,
    db: AsyncSession = Depends(get_db),
):
    """Skip assessment and mark onboarding as completed with default level"""
    # Get subject
    subject_result = await db.execute(
        select(Subject).where(Subject.id == request.subject_id)
    )
    subject = subject_result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Get or create user subject profile
    profile_result = await db.execute(
        select(UserSubjectProfile).where(
            UserSubjectProfile.user_id == request.user_id,
            UserSubjectProfile.subject_id == request.subject_id,
        )
    )
    profile = profile_result.scalar_one_or_none()

    if not profile:
        profile = UserSubjectProfile(
            user_id=request.user_id,
            subject_id=request.subject_id,
            onboarding_status="completed",
            level=request.self_reported_level,
            diagnostic_summary={
                "skipped": True,
                "assessed_level": request.self_reported_level,
                "learning_goals": [],
            },
        )
        db.add(profile)
    else:
        profile.onboarding_status = "completed"
        profile.level = request.self_reported_level
        profile.diagnostic_summary = {
            "skipped": True,
            "assessed_level": request.self_reported_level,
            "learning_goals": [],
        }

    await db.commit()

    return SkipAssessmentResponse(
        success=True,
        message=f"已跳过 {subject.name} 入门评估，您可以随时在设置中重新进行评估",
    )

