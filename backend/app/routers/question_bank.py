"""
动态题库 API
支持 AI 动态生成题目和多题型
"""
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from openai import AsyncOpenAI

from ..core.database import get_db
from ..prompts import get_prompt_registry
from ..services.llm_service import LLMService, LLMServiceFactory
from ..services.encryption import decrypt_api_key
from ..services.ai_scoring_service import AIScoringService, ScoringResult
from ..services.practice_service import (
    get_group_items as get_group_items_service,
    get_question_groups as get_question_groups_service,
    get_user_progress_summary as get_user_progress_summary_service,
    submit_attempt as submit_attempt_service,
)
from ..services.wrong_answer_service import (
    get_wrong_questions as get_wrong_questions_service,
    resolve_wrong_question as resolve_wrong_question_service,
)
from ..services.achievement_service import (
    get_user_achievements as get_user_achievements_service,
    get_user_level_info as get_user_level_info_service,
)
from ..services.hint_service import get_hint as get_hint_service
from ..models.llm_config import UserLLMConfig
from ..models.subject import ExerciseItem, Chapter, Subject, QuestionGroup
from ..models.learning import KnowledgeNode
from ..core.config import settings
from ..models.base import utcnow_naive

logger = logging.getLogger(__name__)
router = APIRouter()


class GenerateQuestionRequest(BaseModel):
    """生成题目请求"""
    subject_key: str = "python"
    knowledge_node_id: Optional[str] = None
    chapter_id: Optional[str] = None
    topic: Optional[str] = None
    question_type: str = "mcq"  # mcq, fill_blank, short_answer, essay, coding
    difficulty: int = 2  # 1-5
    count: int = 1
    persist: bool = False
    group_title: Optional[str] = None
    group_source_type: str = "ai_generated"
    group_source_task_id: Optional[str] = None
    learning_path_id: Optional[str] = None
    learning_path_version: Optional[int] = None
    learning_path_version_name: Optional[str] = None
    source_day: Optional[int] = None
    source_chapter_id: Optional[str] = None
    source_chapter_title: Optional[str] = None
    source_task_title: Optional[str] = None
    source_scope_key: Optional[str] = None


class GeneratedQuestion(BaseModel):
    """生成的题目"""
    id: str
    question_type: str
    stem: str
    options: Optional[List[Dict[str, Any]]] = None  # 选择题选项
    answer_key: Optional[Any] = None  # 标准答案
    rubric: Optional[str] = None  # 评分标准
    difficulty: int
    source_annotation: str  # 来源标注，如 "第2章-定语从句"
    hints: Optional[List[str]] = None


class GenerateQuestionResponse(BaseModel):
    """生成题目响应"""
    success: bool
    message: str
    questions: List[GeneratedQuestion]
    source: str = "ai"  # "ai" | "database" | "template"
    group_id: Optional[str] = None


class ScoreAnswerRequest(BaseModel):
    """评分请求"""
    question_id: str
    question: str
    answer: str
    question_type: str = "short_answer"
    rubric: Optional[str] = None


class ScoreAnswerResponse(BaseModel):
    """评分响应"""
    success: bool
    result: Optional[ScoringResult] = None
    error: Optional[str] = None


# 题组和进度相关模型
class QuestionGroupProgress(BaseModel):
    """题组进度"""
    attempts_count: int
    correct_count: int
    wrong_count: int
    accuracy_rate: int
    completed_count: int
    total_count: int
    last_practiced_at: Optional[datetime] = None


class QuestionGroupInfo(BaseModel):
    """题组信息"""
    id: str
    subject_id: Optional[str] = None
    source_type: str
    source_task_id: str
    source_annotation: Optional[str] = None
    learning_path_id: Optional[str] = None
    learning_path_version: Optional[int] = None
    learning_path_version_name: Optional[str] = None
    source_day: Optional[int] = None
    source_chapter_id: Optional[str] = None
    source_chapter_title: Optional[str] = None
    source_task_title: Optional[str] = None
    source_scope_key: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    item_count: int
    progress: QuestionGroupProgress


class QuestionGroupListResponse(BaseModel):
    """题组列表响应"""
    success: bool
    groups: List[QuestionGroupInfo]


class ExerciseProgress(BaseModel):
    """单题进度"""
    status: str
    attempts_count: int
    correct_count: int
    wrong_count: int
    mastery_score: int
    last_attempt_at: Optional[datetime] = None
    last_correct_at: Optional[datetime] = None
    last_wrong_at: Optional[datetime] = None


class GroupExerciseItem(BaseModel):
    """题组内题目"""
    id: str
    question_type: str
    stem: str
    options: Optional[List[Dict[str, Any]]] = None
    answer_key: Optional[Any] = None
    rubric: Optional[Any] = None
    difficulty: int
    source_annotation: str
    hints: Optional[List[str]] = None
    initial_code: Optional[str] = None
    expected_output: Optional[str] = None
    test_cases: Optional[Any] = None
    progress: ExerciseProgress


class GroupItemsResponse(BaseModel):
    """题组题目响应"""
    success: bool
    items: List[GroupExerciseItem]


class SubmitAttemptRequest(BaseModel):
    """提交答题请求"""
    exercise_item_id: str
    response: Any


class SubmitAttemptResponse(BaseModel):
    """提交答题响应"""
    success: bool
    is_correct: Optional[bool] = None
    score: Optional[int] = None
    scoring_method: Optional[str] = None
    feedback: Optional[str] = None
    grading_detail: Optional[Dict[str, Any]] = None
    grading_trace: List[str] = []
    progress: ExerciseProgress
    group_progress: Optional[QuestionGroupProgress] = None
    xp_gained: int = 0
    leveled_up: bool = False
    new_badges: List[Dict[str, Any]] = []


class UserProgressSummaryResponse(BaseModel):
    """用户进度汇总响应"""
    success: bool
    total_groups: int
    total_items: int
    completed_items: int
    attempts_count: int
    correct_count: int
    wrong_count: int
    accuracy_rate: int


class WrongQuestionItem(BaseModel):
    """错题条目"""
    id: str
    exercise_item_id: str
    wrong_count: int
    last_wrong_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    last_attempt_id: Optional[str] = None
    subject_id: Optional[str] = None
    question_type: Optional[str] = None
    stem: Optional[str] = None
    options: Optional[List[Dict[str, Any]]] = None
    answer_key: Optional[Any] = None
    rubric: Optional[Any] = None
    difficulty: Optional[int] = None
    source_annotation: Optional[str] = None
    hints: Optional[List[str]] = None


class WrongQuestionsResponse(BaseModel):
    """错题列表响应"""
    success: bool
    items: List[WrongQuestionItem]


class WrongQuestionResolveResponse(BaseModel):
    """错题解决响应"""
    success: bool
    wrong_question_id: str
    resolved_at: Optional[datetime] = None


def _build_source_scope_key(
    *,
    source_type: str,
    source_task_id: str,
    learning_path_id: Optional[str] = None,
    learning_path_version: Optional[int] = None,
    source_chapter_id: Optional[str] = None,
    source_day: Optional[int] = None,
    source_scope_key: Optional[str] = None,
) -> str:
    if source_scope_key:
        return source_scope_key
    if learning_path_id and learning_path_version is not None:
        chapter_scope = source_chapter_id or (f"day-{source_day}" if source_day is not None else "chapter")
        return f"{source_type}:{learning_path_id}:v{learning_path_version}:{chapter_scope}:{source_task_id}"
    return f"{source_type}:legacy:{source_task_id}"


class AchievementBadgeItem(BaseModel):
    """用户徽章信息"""
    badge_id: str
    code: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    awarded_at: Optional[datetime] = None
    meta: Optional[Dict[str, Any]] = None


class AchievementsResponse(BaseModel):
    """成就徽章响应"""
    success: bool
    badges: List[AchievementBadgeItem]


class LevelInfoResponse(BaseModel):
    """等级信息响应"""
    success: bool
    level: int
    xp: int
    next_level_xp: int
    xp_to_next_level: int
    total_points: int
    progress_percent: float


class HintRequest(BaseModel):
    """提示请求"""
    exercise_item_id: str
    hint_level: int = 1


class HintResponse(BaseModel):
    """提示响应"""
    success: bool
    hint_text: str
    hint_level: int
    cached: bool = False
    model: Optional[str] = None


# 题型配置
QUESTION_TYPE_PROMPTS = {
    "mcq": """生成一道选择题，包含4个选项，只有一个正确答案。
【极度重要警告】`stem`（题干）中只能包含题目本身的内容，绝不能包含任何选项（A/B/C/D等）的文本！所有选项的实际文字必须且只能放在 `options` 里的 `text` 字段下。

输出格式示例：
{{
    "stem": "题目内容（不可包含选项内容）",
    "options": [
        {{"label": "A", "text": "这是独立的选项A的内容", "is_correct": false}},
        {{"label": "B", "text": "这是独立的选项B的内容", "is_correct": true}},
        {{"label": "C", "text": "这是独立的选项C的内容", "is_correct": false}},
        {{"label": "D", "text": "这是独立的选项D的内容", "is_correct": false}}
    ],
    "answer_key": "B",
    "hints": ["提示1"]
}}""",
    "fill_blank": """生成一道填空题，用 ___ 表示空白处。
输出格式：
{{
    "stem": "题目内容，其中 ___ 是需要填写的部分",
    "answer_key": ["答案1", "答案2"],
    "hints": ["提示1"]
}}""",
    "short_answer": """生成一道简答题。
输出格式：
{{
    "stem": "题目内容",
    "rubric": "评分标准：要点1...要点2...",
    "answer_key": "参考答案",
    "hints": ["提示1"]
}}""",
    "essay": """生成一道论述题/作文题。
输出格式：
{{
    "stem": "题目内容",
    "rubric": "评分标准：内容(40分)、结构(30分)、语言(30分)",
    "hints": ["写作提示1"]
}}""",
    "coding": """生成一道编程题。
输出格式：
{{
    "stem": "题目描述，包含输入输出要求",
    "initial_code": "# 初始代码模板",
    "expected_output": "预期输出",
    "hints": ["提示1"]
}}""",
}


async def _get_llm_service(db: AsyncSession, user_id: UUID) -> Optional[LLMService]:
    """获取用户配置的 LLM 服务"""
    result = await db.execute(
        select(UserLLMConfig)
        .where(UserLLMConfig.user_id == user_id, UserLLMConfig.is_active == True)
        .order_by(UserLLMConfig.updated_at.desc())
    )
    config = result.scalar_one_or_none()

    if config:
        try:
            decrypted_key = decrypt_api_key(config.api_key_encrypted)
            return LLMServiceFactory.create(
                api_base_url=config.api_base_url,
                api_key=decrypted_key,
                model_name=config.model_name,
                max_tokens=config.max_tokens,
                temperature=config.temperature / 100,
            )
        except Exception as e:
            logger.warning(f"[Question Bank] 用户 LLM 配置解密失败: {e}")

    if settings.use_system_llm and settings.deepseek_api_key:
        return LLMServiceFactory.create(
            api_base_url=settings.deepseek_base_url,
            api_key=settings.deepseek_api_key,
            model_name=settings.deepseek_model,
        )

    return None


@router.post("/generate", response_model=GenerateQuestionResponse, summary="AI 动态生成题目")
async def generate_questions(
    user_id: UUID,
    request: GenerateQuestionRequest,
    db: AsyncSession = Depends(get_db),
) -> GenerateQuestionResponse:
    """
    使用 AI 动态生成题目

    支持题型：
    - mcq: 选择题
    - fill_blank: 填空题
    - short_answer: 简答题
    - essay: 论述题/作文
    - coding: 编程题
    """
    # 获取学科信息
    subject_result = await db.execute(
        select(Subject).where(Subject.key == request.subject_key)
    )
    subject = subject_result.scalar_one_or_none()
    subject_name = subject.name if subject else request.subject_key

    # 获取知识点信息（用于来源标注）
    source_annotation = f"{subject_name}"
    if request.knowledge_node_id:
        node_result = await db.execute(
            select(KnowledgeNode).where(KnowledgeNode.id == request.knowledge_node_id)
        )
        node = node_result.scalar_one_or_none()
        if node:
            source_annotation = f"{subject_name} - {node.title}"

    topic = request.topic.strip() if request.topic else None
    if request.source_chapter_title:
        source_annotation = request.source_chapter_title
    elif topic:
        source_annotation = f"{source_annotation} - {topic}"

    # 尝试从数据库获取现有题目（有 topic 时跳过，DB 无 topic 过滤能力）
    if not topic:
        db_questions = await _get_questions_from_db(
            db, request.subject_key, request.question_type,
            request.difficulty, request.count, request.knowledge_node_id
        )

        if db_questions:
            return GenerateQuestionResponse(
                success=True,
                message=f"从题库获取了 {len(db_questions)} 道题目",
                questions=db_questions,
                source="database"
            )

    # 尝试 AI 生成
    llm_service = await _get_llm_service(db, user_id)
    if not llm_service:
        # 返回模板题目
        template_questions = _generate_template_questions(
            request.question_type, request.difficulty, request.count, source_annotation
        )
        result_questions = template_questions
        result_source = "template"
        result_message = "使用模板生成题目（建议配置 LLM 获取个性化题目）"
    else:
        try:
            questions = await _generate_with_ai(
                llm_service, subject_name, request.question_type,
                request.difficulty, request.count, source_annotation, topic
            )
            result_questions = questions
            result_source = "ai"
            result_message = f"AI 生成了 {len(questions)} 道题目"
        except Exception as e:
            logger.error(f"[Question Bank] AI 生成失败: {e}")
            template_questions = _generate_template_questions(
                request.question_type, request.difficulty, request.count, source_annotation
            )
            result_questions = template_questions
            result_source = "template"
            result_message = "AI 生成失败，使用模板题目"

    # 持久化为题组（可选）
    group_id = None
    if request.persist and result_questions and subject:
        group_id = await _persist_as_group(
            db, user_id, subject, request, result_questions, source_annotation
        )

    return GenerateQuestionResponse(
        success=True,
        message=result_message,
        questions=result_questions,
        source=result_source,
        group_id=group_id,
    )


async def _persist_as_group(
    db: AsyncSession,
    user_id: UUID,
    subject: Subject,
    request: GenerateQuestionRequest,
    questions: List[GeneratedQuestion],
    source_annotation: str,
) -> Optional[str]:
    """将生成的题目持久化为题组 + ExerciseItem（upsert 模式）"""
    source_type = request.group_source_type or "ai_generated"
    source_task_id = request.group_source_task_id or str(uuid.uuid4())
    source_scope_key = _build_source_scope_key(
        source_type=source_type,
        source_task_id=source_task_id,
        learning_path_id=request.learning_path_id,
        learning_path_version=request.learning_path_version,
        source_chapter_id=request.source_chapter_id,
        source_day=request.source_day,
        source_scope_key=request.source_scope_key,
    )

    try:
        # upsert QuestionGroup
        group_result = await db.execute(
            select(QuestionGroup).where(
                QuestionGroup.user_id == user_id,
                QuestionGroup.source_type == source_type,
                QuestionGroup.source_scope_key == source_scope_key,
            )
        )
        group = group_result.scalar_one_or_none()
        if group:
            # 已有题组且有题目 → 保留现有数据，仅更新元信息
            existing_items = await db.execute(
                select(ExerciseItem.id).where(
                    ExerciseItem.question_group_id == group.id
                ).limit(1)
            )
            if existing_items.scalar_one_or_none() is not None:
                group.title = request.group_title or group.title
                group.source_annotation = source_annotation
                group.learning_path_id = request.learning_path_id
                group.learning_path_version = request.learning_path_version
                group.learning_path_version_name = request.learning_path_version_name
                group.source_day = request.source_day
                group.source_chapter_id = request.source_chapter_id
                group.source_chapter_title = request.source_chapter_title
                group.source_task_title = request.source_task_title or request.topic
                group.source_scope_key = source_scope_key
                await db.commit()
                return str(group.id)

            # 已有题组但无题目 → 更新元信息并插入新题目
            group.title = request.group_title or group.title
            group.source_annotation = source_annotation
            group.learning_path_id = request.learning_path_id
            group.learning_path_version = request.learning_path_version
            group.learning_path_version_name = request.learning_path_version_name
            group.source_day = request.source_day
            group.source_chapter_id = request.source_chapter_id
            group.source_chapter_title = request.source_chapter_title
            group.source_task_title = request.source_task_title or request.topic
            group.source_scope_key = source_scope_key
            group.item_count = len(questions)
            group.last_synced_at = datetime.now(timezone.utc)
        else:
            group = QuestionGroup(
                user_id=user_id,
                source_type=source_type,
                source_task_id=source_task_id,
                source_annotation=source_annotation,
                learning_path_id=request.learning_path_id,
                learning_path_version=request.learning_path_version,
                learning_path_version_name=request.learning_path_version_name,
                source_day=request.source_day,
                source_chapter_id=request.source_chapter_id,
                source_chapter_title=request.source_chapter_title,
                source_task_title=request.source_task_title or request.topic,
                source_scope_key=source_scope_key,
                subject_id=subject.id,
                title=request.group_title or request.topic or "AI 生成练习",
                status="active",
                item_count=len(questions),
                last_synced_at=utcnow_naive(),
            )
            db.add(group)
            await db.flush()

        # 删除旧题目
        await db.execute(
            delete(ExerciseItem).where(
                ExerciseItem.question_group_id == group.id
            )
        )

        # 插入新题目
        for q in questions:
            answer_key = q.answer_key
            options = q.options
            if q.question_type == "mcq" and options and answer_key:
                options = [
                    {**opt, "is_correct": opt.get("label") == answer_key}
                    for opt in options
                ]
            item = ExerciseItem(
                subject_id=subject.id,
                source_annotation=source_annotation,
                question_group_id=group.id,
                source_type=source_type,
                source_task_id=source_task_id,
                item_type=q.question_type,
                stem=q.stem,
                answer_key=answer_key,
                options=options,
                hints=q.hints,
                difficulty=q.difficulty,
                tags=["ai_generated"],
            )
            db.add(item)

        await db.commit()
        return str(group.id)
    except Exception as e:
        logger.error(f"[Question Bank] 持久化题组失败: {e}")
        await db.rollback()
        return None


async def _get_questions_from_db(
    db: AsyncSession,
    subject_key: str,
    question_type: str,
    difficulty: int,
    count: int,
    knowledge_node_id: Optional[str] = None,
) -> List[GeneratedQuestion]:
    """从数据库获取题目"""
    query = select(ExerciseItem).join(Subject).where(
        Subject.key == subject_key,
        ExerciseItem.item_type == question_type,
        ExerciseItem.difficulty == difficulty,
    )

    if knowledge_node_id:
        query = query.where(ExerciseItem.knowledge_node_id == knowledge_node_id)

    query = query.limit(count)
    result = await db.execute(query)
    items = result.scalars().all()

    questions = []
    for item in items:
        questions.append(GeneratedQuestion(
            id=str(item.id),
            question_type=item.item_type,
            stem=item.stem,
            options=item.options,
            answer_key=item.answer_key,
            rubric=item.rubric,
            difficulty=item.difficulty,
            source_annotation=item.source_annotation or "",
            hints=item.hints,
        ))

    return questions


async def _generate_with_ai(
    llm_service: LLMService,
    subject_name: str,
    question_type: str,
    difficulty: int,
    count: int,
    source_annotation: str,
    topic: Optional[str] = None,
) -> List[GeneratedQuestion]:
    """使用 AI 生成题目"""
    prompt_registry = get_prompt_registry()
    prompt_definition = prompt_registry.get_definition("question_bank.generate")
    type_prompt = QUESTION_TYPE_PROMPTS.get(question_type, QUESTION_TYPE_PROMPTS["mcq"])
    difficulty_desc = ["入门", "基础", "中等", "进阶", "挑战"][min(difficulty - 1, 4)]
    topic_clause = f"，主题为\u201c{topic}\u201d" if topic else ""
    topic_requirement = f"\n4. 题目应紧扣\u201c{topic}\u201d主题，避免偏题" if topic else ""
    messages = prompt_registry.render_messages(
        "question_bank.generate",
        {
            "subject_name": subject_name,
            "count": count,
            "difficulty_desc": difficulty_desc,
            "difficulty": difficulty,
            "type_prompt": type_prompt,
            "topic_clause": topic_clause,
            "topic_requirement": topic_requirement,
        },
    )

    tmp_client = AsyncOpenAI(
        base_url=llm_service.api_base_url,
        api_key=llm_service.api_key,
        timeout=60,
    )

    response = await tmp_client.chat.completions.create(
        model=llm_service.model_name,
        messages=messages,
        temperature=prompt_definition.temperature,
        max_tokens=prompt_definition.max_tokens,
    )

    content = response.choices[0].message.content or ""
    content = content.strip()

    # 处理 markdown 代码块
    if content.startswith("```"):
        lines = content.split("\n")
        json_lines = [l for l in lines if not l.startswith("```")]
        content = "\n".join(json_lines)

    data = json.loads(content)

    # 统一处理为列表
    if isinstance(data, dict):
        data = [data]

    questions = []
    for i, item in enumerate(data[:count]):
        questions.append(GeneratedQuestion(
            id=str(uuid.uuid4()),
            question_type=question_type,
            stem=item.get("stem", ""),
            options=item.get("options"),
            answer_key=item.get("answer_key"),
            rubric=item.get("rubric"),
            difficulty=difficulty,
            source_annotation=source_annotation,
            hints=item.get("hints"),
        ))

    return questions


def _generate_template_questions(
    question_type: str,
    difficulty: int,
    count: int,
    source_annotation: str,
) -> List[GeneratedQuestion]:
    """生成模板题目"""
    templates = {
        "mcq": GeneratedQuestion(
            id=str(uuid.uuid4()),
            question_type="mcq",
            stem="以下哪个选项是正确的？",
            options=[
                {"label": "A", "text": "选项 A", "is_correct": False},
                {"label": "B", "text": "选项 B", "is_correct": True},
                {"label": "C", "text": "选项 C", "is_correct": False},
                {"label": "D", "text": "选项 D", "is_correct": False},
            ],
            answer_key="B",
            difficulty=difficulty,
            source_annotation=source_annotation,
            hints=["仔细阅读每个选项"],
        ),
        "fill_blank": GeneratedQuestion(
            id=str(uuid.uuid4()),
            question_type="fill_blank",
            stem="请填写空白处：___",
            answer_key=["答案"],
            difficulty=difficulty,
            source_annotation=source_annotation,
            hints=["根据上下文推断"],
        ),
        "short_answer": GeneratedQuestion(
            id=str(uuid.uuid4()),
            question_type="short_answer",
            stem="请简要回答以下问题。",
            rubric="评分标准：内容完整性、表达清晰度",
            difficulty=difficulty,
            source_annotation=source_annotation,
            hints=["注意要点完整"],
        ),
        "essay": GeneratedQuestion(
            id=str(uuid.uuid4()),
            question_type="essay",
            stem="请就以下主题展开论述。",
            rubric="评分标准：观点明确、论证充分、结构清晰、语言规范",
            difficulty=difficulty,
            source_annotation=source_annotation,
            hints=["注意文章结构"],
        ),
        "coding": GeneratedQuestion(
            id=str(uuid.uuid4()),
            question_type="coding",
            stem="请编写代码实现以下功能。",
            answer_key={"initial_code": "# 在此编写代码\n", "expected_output": ""},
            difficulty=difficulty,
            source_annotation=source_annotation,
            hints=["注意代码规范"],
        ),
    }

    template = templates.get(question_type, templates["mcq"])
    # Generate unique instances with different IDs
    return [
        GeneratedQuestion(
            id=str(uuid.uuid4()),
            question_type=template.question_type,
            stem=template.stem,
            options=template.options,
            answer_key=template.answer_key,
            rubric=template.rubric,
            difficulty=template.difficulty,
            source_annotation=template.source_annotation,
            hints=template.hints,
        )
        for _ in range(min(count, 5))
    ]


@router.post("/score", response_model=ScoreAnswerResponse, summary="AI 评分主观题")
async def score_answer(
    user_id: UUID,
    request: ScoreAnswerRequest,
    db: AsyncSession = Depends(get_db),
) -> ScoreAnswerResponse:
    """
    使用 AI 对主观题答案进行评分

    支持题型：short_answer, essay
    """
    service = AIScoringService(db)
    result = await service.score_answer(
        user_id=str(user_id),
        question=request.question,
        answer=request.answer,
        question_type=request.question_type,
        rubric=request.rubric,
    )

    if result:
        return ScoreAnswerResponse(success=True, result=result)
    else:
        return ScoreAnswerResponse(
            success=False,
            error=service.last_error or "评分失败"
        )


@router.get("/types", summary="获取支持的题型列表")
async def list_question_types() -> Dict[str, Any]:
    """获取支持的题型及其说明"""
    return {
        "types": [
            {"key": "mcq", "name": "选择题", "description": "单选题，4个选项"},
            {"key": "fill_blank", "name": "填空题", "description": "填写空白处"},
            {"key": "short_answer", "name": "简答题", "description": "简要回答问题"},
            {"key": "essay", "name": "论述题", "description": "展开论述或写作"},
            {"key": "coding", "name": "编程题", "description": "编写代码实现功能"},
        ]
    }


class ListExercisesRequest(BaseModel):
    """列出题目请求"""
    subject_key: str = "python"
    source_filter: Optional[str] = None  # "concept_learning" | "ai_generated" | None
    question_type: Optional[str] = None
    page: int = 1
    page_size: int = 10


class ListExercisesResponse(BaseModel):
    """列出题目响应"""
    success: bool
    total: int
    page: int
    page_size: int
    questions: List[GeneratedQuestion]


@router.post("/list", response_model=ListExercisesResponse, summary="列出已有题目")
async def list_exercises(
    request: ListExercisesRequest,
    db: AsyncSession = Depends(get_db),
) -> ListExercisesResponse:
    """列出数据库中已有的题目"""
    from sqlalchemy import func
    
    # 基础查询
    query = select(ExerciseItem).join(Subject).where(
        Subject.key == request.subject_key
    )
    
    # 来源过滤
    if request.source_filter:
        query = query.where(
            ExerciseItem.source_annotation.like(f"{request.source_filter}:%")
        )
    
    # 题型过滤
    if request.question_type:
        query = query.where(ExerciseItem.item_type == request.question_type)
    
    # 计算总数
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    # 分页
    offset = (request.page - 1) * request.page_size
    query = query.offset(offset).limit(request.page_size)
    query = query.order_by(ExerciseItem.created_at.desc())
    
    result = await db.execute(query)
    items = result.scalars().all()
    
    questions = []
    for item in items:
        questions.append(GeneratedQuestion(
            id=str(item.id),
            question_type=item.item_type,
            stem=item.stem,
            options=item.options,
            answer_key=item.answer_key,
            rubric=item.rubric,
            difficulty=item.difficulty,
            source_annotation=item.source_annotation or "",
            hints=item.hints,
        ))
    
    return ListExercisesResponse(
        success=True,
        total=total,
        page=request.page,
        page_size=request.page_size,
        questions=questions
    )


class ExplainRequest(BaseModel):
    """AI讲解请求"""
    question_id: str
    question: str
    user_answer: str
    correct_answer: Optional[str] = None
    question_type: str = "short_answer"


class ExplainResponse(BaseModel):
    """AI讲解响应"""
    success: bool
    explanation: Optional[str] = None
    key_points: Optional[List[str]] = None
    similar_examples: Optional[List[str]] = None
    error: Optional[str] = None


@router.post("/explain", response_model=ExplainResponse, summary="AI题目讲解")
async def explain_question(
    user_id: UUID,
    request: ExplainRequest,
    db: AsyncSession = Depends(get_db),
) -> ExplainResponse:
    """
    AI 对题目进行讲解
    
    返回：解题思路、关键知识点、类似例题
    """
    llm_service = await _get_llm_service(db, str(user_id))
    
    if not llm_service:
        return ExplainResponse(
            success=False,
            error="未配置 AI 服务，请在个人设置中配置 LLM"
        )
    
    try:
        prompt_registry = get_prompt_registry()
        prompt_definition = prompt_registry.get_definition("question_bank.explain")
        messages = prompt_registry.render_messages(
            "question_bank.explain",
            {
                "question": request.question,
                "user_answer": request.user_answer,
                "reference_answer_section": (
                    f"参考答案：{request.correct_answer}"
                    if request.correct_answer else ""
                ),
            },
        )
        tmp_client = AsyncOpenAI(
            base_url=llm_service.api_base_url,
            api_key=llm_service.api_key,
            timeout=60,
            max_retries=3,
        )
        
        response = await tmp_client.chat.completions.create(
            model=llm_service.model_name,
            messages=messages,
            temperature=prompt_definition.temperature,
            max_tokens=prompt_definition.max_tokens,
        )
        
        content = response.choices[0].message.content or ""
        content = content.strip()
        
        # 处理 markdown 代码块
        if content.startswith("```"):
            lines = content.split("\n")
            json_lines = [l for l in lines if not l.startswith("```")]
            content = "\n".join(json_lines)
        
        data = json.loads(content)
        
        return ExplainResponse(
            success=True,
            explanation=data.get("explanation", ""),
            key_points=data.get("key_points", []),
            similar_examples=data.get("similar_examples", [])
        )
        
    except Exception as e:
        logger.error(f"[Question Bank] AI 讲解失败: {e}")
        return ExplainResponse(
            success=False,
            error=f"讲解失败，请稍后重试 ({str(e)})"
        )


# 题组和进度 API
@router.get("/groups", response_model=QuestionGroupListResponse, summary="获取题组列表")
async def list_question_groups(
    user_id: UUID,
    subject_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> QuestionGroupListResponse:
    """获取用户的题组列表（含进度）"""
    groups = await get_question_groups_service(
        db,
        user_id=str(user_id),
        subject_id=str(subject_id) if subject_id else None,
    )
    return QuestionGroupListResponse(success=True, groups=groups)


@router.get("/groups/{group_id}/items", response_model=GroupItemsResponse, summary="获取题组题目")
async def get_question_group_items(
    group_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> GroupItemsResponse:
    """获取题组内的题目（含用户进度）"""
    items = await get_group_items_service(
        db,
        group_id=str(group_id),
        user_id=str(user_id),
    )
    return GroupItemsResponse(success=True, items=items)


@router.delete("/groups/{group_id}", summary="删除题组")
async def delete_question_group(
    group_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """删除题组及其关联的所有题目和进度数据"""
    group = await db.get(QuestionGroup, group_id)
    if not group or str(group.user_id) != str(user_id):
        raise HTTPException(status_code=404, detail="题组不存在或无权限")

    # 显式删除 ExerciseItem（FK 是 SET NULL，不会级联）
    # ExerciseItem 的子表（Attempt/Progress/WrongQuestion）有 CASCADE，会自动清理
    await db.execute(
        delete(ExerciseItem).where(ExerciseItem.question_group_id == group_id)
    )
    # 删除题组本身（UserQuestionGroupStats 有 CASCADE，自动清理）
    await db.delete(group)
    await db.commit()

    return {"success": True}


@router.post("/attempts", response_model=SubmitAttemptResponse, summary="提交答题")
async def submit_question_attempt(
    user_id: UUID,
    request: SubmitAttemptRequest,
    db: AsyncSession = Depends(get_db),
) -> SubmitAttemptResponse:
    """提交答题并更新进度"""
    result = await submit_attempt_service(
        db,
        user_id=str(user_id),
        exercise_item_id=request.exercise_item_id,
        response=request.response,
    )
    if not result:
        raise HTTPException(status_code=404, detail="练习题不存在")
    return SubmitAttemptResponse(
        success=True,
        is_correct=result.get("is_correct"),
        score=result.get("score"),
        scoring_method=result.get("scoring_method"),
        feedback=result.get("feedback"),
        grading_detail=result.get("grading_detail"),
        grading_trace=result.get("grading_trace", []),
        progress=result["progress"],
        group_progress=result.get("group_progress"),
        xp_gained=result.get("xp_gained", 0),
        leveled_up=result.get("leveled_up", False),
        new_badges=result.get("new_badges", []),
    )


@router.post("/attempts/stream", summary="流式提交答题并返回评分过程摘要")
async def submit_question_attempt_stream(
    user_id: UUID,
    request: SubmitAttemptRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """流式返回可展示的评分过程摘要；不暴露隐藏思维链。"""

    async def event_stream():
        try:
            yield f"data: {json.dumps({'type': 'start', 'content': '已提交答案，准备判题。'}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0)
            yield f"data: {json.dumps({'type': 'grading_step', 'content': '正在读取题干与参考答案。'}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0)
            yield f"data: {json.dumps({'type': 'grading_step', 'content': '正在对照参考答案评估用户回答。'}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0)
            result = await submit_attempt_service(
                db,
                user_id=str(user_id),
                exercise_item_id=request.exercise_item_id,
                response=request.response,
            )
            if not result:
                yield f"data: {json.dumps({'type': 'error', 'content': '练习题不存在'}, ensure_ascii=False)}\n\n"
                return

            for step in result.get("grading_trace", []):
                yield f"data: {json.dumps({'type': 'grading_step', 'content': step}, ensure_ascii=False)}\n\n"

            payload = SubmitAttemptResponse(
                success=True,
                is_correct=result.get("is_correct"),
                score=result.get("score"),
                scoring_method=result.get("scoring_method"),
                feedback=result.get("feedback"),
                grading_detail=result.get("grading_detail"),
                grading_trace=result.get("grading_trace", []),
                progress=result["progress"],
                group_progress=result.get("group_progress"),
                xp_gained=result.get("xp_gained", 0),
                leveled_up=result.get("leveled_up", False),
                new_badges=result.get("new_badges", []),
            )
            response_payload = (
                payload.model_dump(mode="json")
                if hasattr(payload, "model_dump")
                else json.loads(payload.json())
            )
            yield f"data: {json.dumps({'type': 'result', 'result': response_payload}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            logger.error(f"[Question Bank] 流式提交判题失败: {exc}")
            yield f"data: {json.dumps({'type': 'error', 'content': '判题失败，请稍后重试'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/progress/summary", response_model=UserProgressSummaryResponse, summary="用户练习进度汇总")
async def get_progress_summary(
    user_id: UUID,
    subject_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> UserProgressSummaryResponse:
    """获取用户练习进度汇总"""
    summary = await get_user_progress_summary_service(
        db,
        user_id=str(user_id),
        subject_id=str(subject_id) if subject_id else None,
    )
    return UserProgressSummaryResponse(success=True, **summary)


@router.get("/wrong-answers", response_model=WrongQuestionsResponse, summary="获取错题本")
async def list_wrong_questions(
    user_id: UUID,
    subject_id: Optional[UUID] = Query(None),
    resolved: bool = Query(False),
    db: AsyncSession = Depends(get_db),
) -> WrongQuestionsResponse:
    """获取用户错题列表"""
    items = await get_wrong_questions_service(
        db,
        user_id=str(user_id),
        subject_id=str(subject_id) if subject_id else None,
        resolved=resolved,
    )
    return WrongQuestionsResponse(success=True, items=items)


@router.post("/wrong-answers/{wrong_question_id}/resolve", response_model=WrongQuestionResolveResponse, summary="标记错题为已解决")
async def resolve_wrong_question(
    wrong_question_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> WrongQuestionResolveResponse:
    """标记错题为已解决"""
    wrong_question = await resolve_wrong_question_service(
        db,
        user_id=str(user_id),
        wrong_question_id=str(wrong_question_id),
    )
    if not wrong_question:
        raise HTTPException(status_code=404, detail="错题记录不存在")
    await db.commit()
    return WrongQuestionResolveResponse(
        success=True,
        wrong_question_id=str(wrong_question.id),
        resolved_at=wrong_question.resolved_at,
    )


@router.get("/achievements", response_model=AchievementsResponse, summary="获取用户成就徽章")
async def get_user_achievements(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> AchievementsResponse:
    """获取用户已获徽章"""
    badges = await get_user_achievements_service(db, user_id=str(user_id))
    return AchievementsResponse(success=True, badges=badges)


@router.get("/levels", response_model=LevelInfoResponse, summary="获取用户等级信息")
async def get_user_level_info(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> LevelInfoResponse:
    """获取用户等级与经验信息"""
    info = await get_user_level_info_service(db, user_id=str(user_id))
    return LevelInfoResponse(success=True, **info)


@router.post("/hints", response_model=HintResponse, summary="获取题目提示")
async def get_question_hint(
    user_id: UUID,
    request: HintRequest,
    db: AsyncSession = Depends(get_db),
) -> HintResponse:
    """获取题目提示（AI生成并缓存）"""
    try:
        result = await get_hint_service(
            db,
            user_id=str(user_id),
            exercise_item_id=request.exercise_item_id,
            hint_level=request.hint_level,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not result:
        raise HTTPException(status_code=404, detail="题目不存在")
    await db.commit()
    return HintResponse(success=True, **result)
