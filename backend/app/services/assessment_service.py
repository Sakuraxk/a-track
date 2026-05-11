"""
AI 水平评估服务
用于新用户的Python水平评估，生成初始能力画像
"""
import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..prompts import get_prompt_registry
from ..services.llm_service import LLMService, LLMServiceFactory, LLMServiceError
from ..services.encryption import decrypt_api_key
from ..models.llm_config import UserLLMConfig


class AssessmentQuestion(BaseModel):
    """评估问题"""
    id: int
    category: str
    difficulty: int
    question: str
    options: List[str]
    correct_answer: int  # 正确答案的索引 (0-3)
    explanation: str


class AssessmentResult(BaseModel):
    """评估结果"""
    total_score: int
    level: str
    ability_tags: Dict[str, int]
    recommendations: List[str]
    summary: str


# 预定义的评估题库（中文）
ASSESSMENT_QUESTIONS: List[AssessmentQuestion] = [
    # ==================== 基础语法 (难度 1) ====================
    AssessmentQuestion(
        id=1,
        category="基础语法",
        difficulty=1,
        question="下面哪个是正确的Python变量命名？",
        options=["2name", "my-name", "my_name", "class"],
        correct_answer=2,
        explanation="Python变量名可以包含字母、数字和下划线，但不能以数字开头，也不能使用保留字（如class）",
    ),
    AssessmentQuestion(
        id=2,
        category="基础语法",
        difficulty=1,
        question="print('Hello' + 'World') 的输出结果是？",
        options=["Hello World", "HelloWorld", "Hello+World", "错误"],
        correct_answer=1,
        explanation="字符串的 + 运算符会将两个字符串连接在一起，不会自动添加空格",
    ),
    AssessmentQuestion(
        id=3,
        category="基础语法",
        difficulty=1,
        question="int('42') 的结果是什么类型？",
        options=["字符串", "整数", "浮点数", "布尔值"],
        correct_answer=1,
        explanation="int() 函数将字符串转换为整数类型",
    ),

    # ==================== 条件与循环 (难度 2) ====================
    AssessmentQuestion(
        id=4,
        category="条件语句",
        difficulty=2,
        question="x = 5，下面哪个表达式的结果是 True？",
        options=["x == 4", "x > 5", "x >= 5", "x != 5"],
        correct_answer=2,
        explanation="x >= 5 表示 x 大于或等于 5，当 x = 5 时结果为 True",
    ),
    AssessmentQuestion(
        id=5,
        category="循环",
        difficulty=2,
        question="for i in range(3): print(i) 会输出什么？",
        options=["1 2 3", "0 1 2", "0 1 2 3", "1 2"],
        correct_answer=1,
        explanation="range(3) 生成 0, 1, 2 三个数字，不包含 3",
    ),
    AssessmentQuestion(
        id=6,
        category="循环",
        difficulty=2,
        question="while 循环中，break 语句的作用是？",
        options=["跳过本次循环", "终止整个循环", "继续下一次循环", "重新开始循环"],
        correct_answer=1,
        explanation="break 会立即终止整个循环，而 continue 只跳过本次循环",
    ),

    # ==================== 数据结构 (难度 2-3) ====================
    AssessmentQuestion(
        id=7,
        category="列表",
        difficulty=2,
        question="lst = [1, 2, 3]，lst.append(4) 后 lst 是？",
        options=["[1, 2, 3]", "[4, 1, 2, 3]", "[1, 2, 3, 4]", "[1, 2, 4, 3]"],
        correct_answer=2,
        explanation="append() 方法在列表末尾添加元素",
    ),
    AssessmentQuestion(
        id=8,
        category="列表",
        difficulty=2,
        question="lst = [10, 20, 30, 40]，lst[1:3] 的结果是？",
        options=["[10, 20]", "[20, 30]", "[20, 30, 40]", "[10, 20, 30]"],
        correct_answer=1,
        explanation="切片 [1:3] 获取索引 1 到 2（不含 3）的元素",
    ),
    AssessmentQuestion(
        id=9,
        category="字典",
        difficulty=2,
        question="d = {'a': 1, 'b': 2}，d['c'] 会发生什么？",
        options=["返回 None", "返回 0", "抛出 KeyError", "返回空字符串"],
        correct_answer=2,
        explanation="访问不存在的键会抛出 KeyError，可以用 get() 方法避免",
    ),
    AssessmentQuestion(
        id=10,
        category="字典",
        difficulty=3,
        question="d.get('key', 'default') 的作用是？",
        options=[
            "获取 key 的值，不存在则报错",
            "获取 key 的值，不存在则返回 'default'",
            "设置 key 的默认值",
            "删除 key"
        ],
        correct_answer=1,
        explanation="get() 方法在键不存在时返回默认值，而不会报错",
    ),

    # ==================== 函数 (难度 3) ====================
    AssessmentQuestion(
        id=11,
        category="函数",
        difficulty=3,
        question="下面哪个是正确的函数定义？",
        options=[
            "function add(a, b): return a + b",
            "def add(a, b) return a + b",
            "def add(a, b): return a + b",
            "func add(a, b): return a + b"
        ],
        correct_answer=2,
        explanation="Python 使用 def 关键字定义函数，冒号后是函数体",
    ),
    AssessmentQuestion(
        id=12,
        category="函数",
        difficulty=3,
        question="def greet(name='World'): 中 'World' 是什么？",
        options=["位置参数", "必需参数", "默认参数", "关键字参数"],
        correct_answer=2,
        explanation="name='World' 定义了一个默认参数，调用时可以不传该参数",
    ),
    AssessmentQuestion(
        id=13,
        category="函数",
        difficulty=3,
        question="函数中没有 return 语句，调用后返回什么？",
        options=["0", "空字符串", "None", "False"],
        correct_answer=2,
        explanation="Python 函数如果没有显式 return，默认返回 None",
    ),

    # ==================== 高级概念 (难度 4) ====================
    AssessmentQuestion(
        id=14,
        category="列表推导式",
        difficulty=4,
        question="[x**2 for x in range(5)] 的结果是？",
        options=["[1, 4, 9, 16, 25]", "[0, 1, 4, 9, 16]", "[0, 2, 4, 6, 8]", "[1, 2, 3, 4, 5]"],
        correct_answer=1,
        explanation="列表推导式对 range(5)（即 0,1,2,3,4）中的每个数求平方",
    ),
    AssessmentQuestion(
        id=15,
        category="异常处理",
        difficulty=4,
        question="try-except 中，哪个块一定会执行（无论是否异常）？",
        options=["try", "except", "else", "finally"],
        correct_answer=3,
        explanation="finally 块无论是否发生异常都会执行，常用于清理资源",
    ),
]


def get_assessment_questions(count: int = 10) -> List[AssessmentQuestion]:
    """
    获取评估题目
    按难度分布获取题目，确保覆盖各个难度级别
    """
    questions = []

    # 按难度分组
    by_difficulty = {1: [], 2: [], 3: [], 4: []}
    for q in ASSESSMENT_QUESTIONS:
        by_difficulty[q.difficulty].append(q)

    # 分配题目数量：难度1取2题，难度2取3题，难度3取3题，难度4取2题
    distribution = {1: 2, 2: 3, 3: 3, 4: 2}

    for diff, num in distribution.items():
        available = by_difficulty.get(diff, [])
        questions.extend(available[:num])

    return questions[:count]


def evaluate_assessment(answers: Dict[int, int]) -> AssessmentResult:
    """
    评估用户答案，生成能力画像

    Args:
        answers: {题目ID: 用户选择的答案索引}

    Returns:
        AssessmentResult 包含分数、等级、能力标签等
    """
    # 创建题目索引
    questions_by_id = {q.id: q for q in ASSESSMENT_QUESTIONS}

    # 统计各类别得分
    category_scores: Dict[str, Dict[str, int]] = {}
    total_correct = 0
    total_questions = len(answers)

    for q_id, user_answer in answers.items():
        if q_id not in questions_by_id:
            continue

        question = questions_by_id[q_id]
        category = question.category

        if category not in category_scores:
            category_scores[category] = {"correct": 0, "total": 0, "difficulty_sum": 0}

        category_scores[category]["total"] += 1
        category_scores[category]["difficulty_sum"] += question.difficulty

        if user_answer == question.correct_answer:
            total_correct += 1
            category_scores[category]["correct"] += 1

    # 计算总分 (0-100)
    total_score = int(total_correct / max(total_questions, 1) * 100)

    # 计算各能力标签分数
    ability_tags: Dict[str, int] = {}
    for category, scores in category_scores.items():
        if scores["total"] > 0:
            # 基础分 + 难度加成
            base_score = scores["correct"] / scores["total"] * 70
            avg_difficulty = scores["difficulty_sum"] / scores["total"]
            difficulty_bonus = (avg_difficulty - 1) * 10 * (scores["correct"] / scores["total"])
            ability_tags[category] = int(min(100, base_score + difficulty_bonus))

    # 确定用户等级
    if total_score >= 80:
        level = "进阶"
    elif total_score >= 60:
        level = "中级"
    elif total_score >= 40:
        level = "初级"
    else:
        level = "入门"

    # 生成学习建议
    recommendations = []
    weak_categories = [cat for cat, score in ability_tags.items() if score < 60]
    strong_categories = [cat for cat, score in ability_tags.items() if score >= 80]

    if weak_categories:
        recommendations.append(f"建议重点学习：{', '.join(weak_categories)}")
    if strong_categories:
        recommendations.append(f"您在以下方面表现不错：{', '.join(strong_categories)}")

    # 根据等级给出建议
    if level == "入门":
        recommendations.append("建议从 Python 基础语法开始学习，打好基础")
    elif level == "初级":
        recommendations.append("建议加强条件语句和循环的练习")
    elif level == "中级":
        recommendations.append("建议学习函数和数据结构的进阶用法")
    else:
        recommendations.append("您基础扎实，可以挑战面向对象和高级特性")

    # 生成总结
    summary = f"您的 Python 水平评估结果为【{level}】，总分 {total_score} 分。"

    return AssessmentResult(
        total_score=total_score,
        level=level,
        ability_tags=ability_tags,
        recommendations=recommendations,
        summary=summary
    )


async def generate_ai_assessment(
    llm_service: Any,
    user_context: Optional[Dict] = None
) -> List[Dict[str, Any]]:
    """
    使用 AI 动态生成评估题目（可选功能）

    当需要更个性化的评估时，可以调用 LLM 生成题目
    """
    try:
        messages = get_prompt_registry().render_messages("assessment.generate_questions")
        response = await llm_service.chat(
            messages=messages,
            role="explainer"
        )

        content = response.get("content", "")

        # 尝试解析JSON
        content = content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            json_lines = []
            in_json = False
            for line in lines:
                if line.startswith("```"):
                    in_json = not in_json
                    continue
                if in_json:
                    json_lines.append(line)
            content = "\n".join(json_lines)

        questions = json.loads(content)

        # 转换为 AssessmentQuestion 对象
        result = []
        for q in questions:
            result.append(AssessmentQuestion(
                id=q.get("id", len(result) + 1),
                category=q.get("category", "综合"),
                difficulty=q.get("difficulty", 2),
                question=q.get("question", ""),
                options=q.get("options", []),
                correct_answer=q.get("correct_answer", 0),
                explanation=q.get("explanation", "")
            ))

        return result

    except (json.JSONDecodeError, LLMServiceError, Exception) as e:
        print(f"[AI Assessment] 生成题目失败: {e}")
        # 回退到预定义题库
        return []


async def analyze_assessment_with_ai(
    db: AsyncSession,
    user_id: str,
    questions: List[AssessmentQuestion],
    answers: Dict[int, int]
) -> Optional[AssessmentResult]:
    """
    使用 AI 分析评估结果，生成个性化学习建议

    Args:
        db: 数据库会话
        user_id: 用户ID
        questions: 评估题目列表
        answers: 用户答案 {题目ID: 答案索引}

    Returns:
        AI增强的评估结果，或None（降级到静态评估）
    """
    # 尝试获取用户的LLM配置
    llm_service = await _get_llm_service(db, user_id)

    if not llm_service:
        return None

    try:
        # 构建评估数据供AI分析
        questions_by_id = {q.id: q for q in questions}
        assessment_data = []

        for q_id, user_answer in answers.items():
            if q_id not in questions_by_id:
                continue
            q = questions_by_id[q_id]
            is_correct = user_answer == q.correct_answer

            assessment_data.append({
                "category": q.category,
                "difficulty": q.difficulty,
                "question": q.question,
                "user_answer": q.options[user_answer] if 0 <= user_answer < len(q.options) else "未作答",
                "correct_answer": q.options[q.correct_answer],
                "is_correct": is_correct
            })

        messages = get_prompt_registry().render_messages(
            "assessment.analyze_results",
            {
                "assessment_data": json.dumps(
                    assessment_data,
                    ensure_ascii=False,
                    indent=2,
                ),
            },
        )
        response = await llm_service.chat(
            messages=messages,
            role="explainer"
        )

        content = response.get("content", "").strip()

        # 处理markdown代码块
        if content.startswith("```"):
            lines = content.split("\n")
            json_lines = []
            in_json = False
            for line in lines:
                if line.startswith("```"):
                    in_json = not in_json
                    continue
                if in_json:
                    json_lines.append(line)
            content = "\n".join(json_lines)

        data = json.loads(content)

        # 计算基础分数
        correct_count = sum(1 for q_id, ans in answers.items()
                           if q_id in questions_by_id and ans == questions_by_id[q_id].correct_answer)
        total_score = int(correct_count / max(len(answers), 1) * 100)

        return AssessmentResult(
            total_score=total_score,
            level=data.get("level", "初级"),
            ability_tags=data.get("ability_tags", {}),
            recommendations=data.get("recommendations", []),
            summary=data.get("summary", f"您的评估总分为 {total_score} 分")
        )

    except (json.JSONDecodeError, LLMServiceError, Exception) as e:
        print(f"[AI Assessment] AI分析失败: {e}")
        return None


async def _get_llm_service(db: AsyncSession, user_id: str) -> Optional[LLMService]:
    """获取用户的LLM服务实例"""
    try:
        result = await db.execute(
            select(UserLLMConfig).where(
                UserLLMConfig.user_id == user_id,
                UserLLMConfig.is_active == True
            )
        )
        config = result.scalar_one_or_none()

        if not config:
            return None

        # 解密API密钥
        decrypted_key = decrypt_api_key(config.api_key_encrypted)

        # 创建LLM服务
        return LLMServiceFactory.create_from_db_config(config, decrypted_key)

    except Exception as e:
        print(f"[AI Assessment] 获取LLM配置失败: {e}")
        return None


class AIAssessmentService:
    """AI评估服务封装类"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_questions(self, user_id: str, count: int = 10) -> List[AssessmentQuestion]:
        """
        获取评估题目（优先使用AI生成）

        Args:
            user_id: 用户ID
            count: 题目数量

        Returns:
            评估题目列表
        """
        llm_service = await _get_llm_service(self.db, user_id)

        if llm_service:
            # 尝试AI生成
            ai_questions = await generate_ai_assessment(llm_service)
            if ai_questions:
                return ai_questions[:count]

        # 降级到预定义题库
        return get_assessment_questions(count)

    async def evaluate(
        self,
        user_id: str,
        answers: Dict[int, int],
        questions: Optional[List[AssessmentQuestion]] = None
    ) -> AssessmentResult:
        """
        评估用户答案

        Args:
            user_id: 用户ID
            answers: 用户答案
            questions: 题目列表（如果未提供则使用预定义题库）

        Returns:
            评估结果
        """
        if questions is None:
            questions = ASSESSMENT_QUESTIONS

        # 尝试AI分析
        ai_result = await analyze_assessment_with_ai(
            self.db, user_id, questions, answers
        )

        if ai_result:
            return ai_result

        # 降级到静态评估
        return evaluate_assessment(answers)

