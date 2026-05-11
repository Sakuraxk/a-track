"""
学习路线数据模型与学科配置常量

从 ai_learning_path_service.py 拆分而来，包含所有 Pydantic 数据模型、
学科配置字典 SUBJECT_CONFIGS，以及模块级别的澄清流程常量。
"""
from typing import List, Dict, Optional
from pydantic import BaseModel


# ── 澄清流程常量 ───────────────────────────────────────

_MAX_PROACTIVE_CLARIFICATION_TURNS = 5
_OPEN_SUPPLEMENT_MODE = "open_supplement"
_CONFIRMATION_HINTS = (
    "没问题",
    "没有异议",
    "可以开始",
    "开始生成",
    "直接生成",
    "确认",
    "按这个理解",
    "继续规划",
    "是的",
    "好的",
    "就按这个",
    "就这样",
)
_CURRENT_LEVEL_HINTS = (
    "当前",
    "目前",
    "基础",
    "熟悉",
    "经验",
    "水平",
    "薄弱",
    "初学者",
    "新手",
    "零基础",
    "入门",
)
_TARGET_SCOPE_HINTS = (
    "重点",
    "范围",
    "想学",
    "补强",
    "加入",
    "纳入",
    "补充",
    "方向",
    "围绕",
    "优先",
)
_TIME_BUDGET_HINTS = (
    "每天",
    "每周",
    "工作日",
    "周末",
    "晚间",
    "节奏",
)


# ── 学科配置 ────────────────────────────────────────────

class SubjectConfig(BaseModel):
    """学科配置"""
    name: str
    context: str
    distribution: str
    default_themes: List[tuple]
    # 注入到 prompt 中的学科范围约束（非编程学科需要明确禁止编程术语）
    scope_constraints: str = ""
    # 注入到 prompt 中的任务表达示例
    task_examples: str = ""


_NON_PROGRAMMING_CONSTRAINTS = (
    "本学科不是编程课程，严禁出现任何编程相关内容。\n"
    "禁止词：代码、编程、程序、变量、函数、类、对象、循环(loop)、条件语句、if/else、"
    "列表(list)、字典(dict)、数组、算法实现、调试、框架、API、项目开发、import、print。\n"
    "project 类型任务指'综合应用任务'（如写作、报告、实践练习），不是编程项目。"
)

SUBJECT_CONFIGS: Dict[str, SubjectConfig] = {
    "python": SubjectConfig(
        name="Python",
        context="Focus on Python syntax, data structures, algorithms, and coding best practices.",
        distribution="Coding 70%, MCQ 30%",
        default_themes=[
            ("Python基础语法", ["变量与数据类型", "输入输出", "运算符"]),
            ("条件语句", ["if-else", "多条件判断", "逻辑运算"]),
            ("循环结构", ["for循环", "while循环", "循环控制"]),
            ("列表基础", ["列表创建", "列表操作", "列表切片"]),
            ("字典与集合", ["字典操作", "集合操作", "实践练习"]),
            ("函数入门", ["函数定义", "参数传递", "返回值"]),
            ("函数进阶", ["默认参数", "可变参数", "lambda"]),
            ("字符串处理", ["字符串方法", "格式化", "正则初步"]),
            ("文件操作", ["读写文件", "路径处理", "异常处理"]),
            ("综合练习", ["项目实战", "代码优化", "复习总结"]),
        ]
    ),
    "machine_learning": SubjectConfig(
        name="机器学习",
        context="Focus on ML concepts, algorithms (regression, classification, clustering), and practical application.",
        distribution="MCQ 50%, Short Answer 30%, Coding 20%",
        default_themes=[
            ("机器学习基础认知", ["监督学习与非监督学习", "训练/验证/测试集", "偏差-方差权衡"]),
            ("数学与数据准备", ["线性代数基础", "概率统计基础", "数据清洗与特征工程"]),
            ("经典监督学习", ["线性回归与正则化", "逻辑回归与KNN", "SVM"]),
            ("树模型与集成方法", ["决策树", "随机森林", "Boosting"]),
            ("无监督学习", ["K-Means", "层次聚类与DBSCAN", "PCA"]),
            ("评估与调参", ["交叉验证", "分类/回归指标", "超参数搜索"]),
            ("深度学习入门", ["感知机与多层神经网络", "反向传播", "PyTorch 基础"]),
            ("项目与部署", ["scikit-learn Pipeline", "模型部署", "监控与迭代"]),
        ],
        scope_constraints=(
            "本学科是机器学习课程，所有任务必须紧密围绕机器学习概念、算法和应用展开。\n"
            "禁止出现与机器学习无关的基础编程练习，例如：练习 Python 字典和循环、列表操作练习、"
            "基础语法练习、变量赋值练习等纯编程入门内容。\n"
            "exercise 类型的任务必须聚焦于机器学习算法实践（如使用 scikit-learn 训练模型、"
            "分析混淆矩阵、绘制学习曲线、做特征重要性分析等），而不是 Python 基础语法练习。\n"
            "数学相关任务应聚焦于机器学习所需的数学（线性代数、概率统计、优化），"
            "不能退化为通用数学课或编程入门课。"
        ),
        task_examples=(
            "- concept: 理解监督学习与无监督学习的区别，以及逻辑回归适合解决什么问题\n"
            "- exercise: 使用 scikit-learn 完成逻辑回归训练，并分析准确率、召回率和混淆矩阵\n"
            "- review: 复盘交叉验证、过拟合和正则化之间的关系，整理常见误区\n"
            "- project: 完成一个从数据清洗、特征工程、模型训练到结果汇报的机器学习小实验"
        ),
    ),
    "advanced_math": SubjectConfig(
        name="高等数学",
        context="Focus on calculus, limits, derivatives, integrals, and mathematical proofs.",
        distribution="Fill-in-blank 40%, Essay 60%",
        default_themes=[
            ("极限与连续", ["数列极限", "函数极限", "连续性"]),
            ("导数与微分", ["导数定义", "求导法则", "高阶导数"]),
            ("积分学", ["不定积分", "定积分", "换元法"]),
            ("级数", ["数项级数", "幂级数", "傅里叶级数"]),
            ("多元函数", ["偏导数", "重积分", "曲线积分"]),
        ],
        scope_constraints=_NON_PROGRAMMING_CONSTRAINTS,
        task_examples=(
            "- concept: 学习极限的定义与ε-δ语言\n"
            "- exercise: 求导练习（复合函数、隐函数求导）\n"
            "- review: 不定积分公式与换元法复盘\n"
            "- project: 综合应用题（曲线面积、旋转体体积计算）"
        ),
    ),
}


# ── 学习路线数据模型 ──────────────────────────────────────

class LearningTask(BaseModel):
    """单个学习任务"""
    id: str
    title: str
    description: str
    type: str  # "concept", "exercise", "project", "review"
    duration_minutes: int
    resources: List[str] = []
    completed: bool = False


class LearningDay(BaseModel):
    """一天的学习计划"""
    day: int
    date: str
    theme: str
    tasks: List[LearningTask]
    total_minutes: int
    milestone: Optional[str] = None


class LearningPath(BaseModel):
    """完整的学习路线"""
    id: str
    user_id: str
    goal: str
    total_days: int
    daily_minutes: int
    # 生成学习路线时用户选择的水平（用于后续续写保持一致）
    level: str = "初级"
    created_at: str
    days: List[LearningDay]
    # 已经生成/解锁的天数（分阶段生成时用于展示与判断）
    generated_days: int = 0
    # 每阶段默认生成天数（用于"解锁续写"）
    phase_size: int = 7
    progress_percent: float = 0.0
    current_day: int = 1
    source: str = "ai"
    # 版本管理字段（可选，从数据库附加）
    version: Optional[int] = None
    version_name: Optional[str] = None
    is_active: Optional[bool] = None
    archived_at: Optional[str] = None
