from typing import Dict, List
from uuid import UUID

from fastapi import APIRouter

from ..schemas.learning import KnowledgeNode, UserNodeState, LearningPathItem


router = APIRouter()

# ==================== Python 学习知识图谱 ====================
# 组织结构：基础语法 -> 控制流 -> 数据结构 -> 函数 -> 面向对象 -> 高级主题
# 每个节点包含：代码、标题、难度(1-5)、预计时长、前置知识、属性标签

_nodes = {
    # ==================== 基础语法 (difficulty: 1) ====================
    "basics.print": KnowledgeNode(
        code="basics.print",
        title="输出与打印",
        difficulty=1,
        duration_minutes=10,
        prerequisites=[],
        attributes={"track": "basics", "category": "基础语法"},
    ),
    "basics.variables": KnowledgeNode(
        code="basics.variables",
        title="变量与赋值",
        difficulty=1,
        duration_minutes=15,
        prerequisites=["basics.print"],
        attributes={"track": "basics", "category": "基础语法"},
    ),
    "basics.types": KnowledgeNode(
        code="basics.types",
        title="数据类型",
        difficulty=1,
        duration_minutes=20,
        prerequisites=["basics.variables"],
        attributes={"track": "basics", "category": "基础语法"},
    ),
    "basics.operators": KnowledgeNode(
        code="basics.operators",
        title="运算符",
        difficulty=1,
        duration_minutes=20,
        prerequisites=["basics.types"],
        attributes={"track": "basics", "category": "基础语法"},
    ),
    "basics.input": KnowledgeNode(
        code="basics.input",
        title="用户输入",
        difficulty=1,
        duration_minutes=15,
        prerequisites=["basics.variables"],
        attributes={"track": "basics", "category": "基础语法"},
    ),

    # ==================== 条件语句 (difficulty: 1-2) ====================
    "conditions.if": KnowledgeNode(
        code="conditions.if",
        title="if 条件语句",
        difficulty=1,
        duration_minutes=20,
        prerequisites=["basics.operators"],
        attributes={"track": "control_flow", "category": "条件语句"},
    ),
    "conditions.elif": KnowledgeNode(
        code="conditions.elif",
        title="elif 多分支",
        difficulty=2,
        duration_minutes=20,
        prerequisites=["conditions.if"],
        attributes={"track": "control_flow", "category": "条件语句"},
    ),
    "conditions.logic": KnowledgeNode(
        code="conditions.logic",
        title="逻辑运算符",
        difficulty=2,
        duration_minutes=25,
        prerequisites=["conditions.if"],
        attributes={"track": "control_flow", "category": "条件语句"},
    ),

    # ==================== 循环结构 (difficulty: 2) ====================
    "loops.for": KnowledgeNode(
        code="loops.for",
        title="for 循环",
        difficulty=2,
        duration_minutes=25,
        prerequisites=["conditions.if"],
        attributes={"track": "control_flow", "category": "循环结构"},
    ),
    "loops.while": KnowledgeNode(
        code="loops.while",
        title="while 循环",
        difficulty=2,
        duration_minutes=25,
        prerequisites=["conditions.if"],
        attributes={"track": "control_flow", "category": "循环结构"},
    ),
    "loops.nested": KnowledgeNode(
        code="loops.nested",
        title="嵌套循环",
        difficulty=2,
        duration_minutes=30,
        prerequisites=["loops.for", "loops.while"],
        attributes={"track": "control_flow", "category": "循环结构"},
    ),
    "loops.break": KnowledgeNode(
        code="loops.break",
        title="break与continue",
        difficulty=2,
        duration_minutes=20,
        prerequisites=["loops.for"],
        attributes={"track": "control_flow", "category": "循环结构"},
    ),

    # ==================== 列表与元组 (difficulty: 2-3) ====================
    "lists.create": KnowledgeNode(
        code="lists.create",
        title="列表创建与访问",
        difficulty=2,
        duration_minutes=25,
        prerequisites=["basics.types"],
        attributes={"track": "data_structures", "category": "列表与元组"},
    ),
    "lists.methods": KnowledgeNode(
        code="lists.methods",
        title="列表方法",
        difficulty=2,
        duration_minutes=30,
        prerequisites=["lists.create"],
        attributes={"track": "data_structures", "category": "列表与元组"},
    ),
    "lists.slice": KnowledgeNode(
        code="lists.slice",
        title="列表切片",
        difficulty=2,
        duration_minutes=25,
        prerequisites=["lists.create"],
        attributes={"track": "data_structures", "category": "列表与元组"},
    ),
    "lists.comprehension": KnowledgeNode(
        code="lists.comprehension",
        title="列表推导式",
        difficulty=3,
        duration_minutes=35,
        prerequisites=["lists.create", "loops.for"],
        attributes={"track": "data_structures", "category": "列表与元组"},
    ),

    # ==================== 字典与集合 (difficulty: 2-3) ====================
    "dicts.create": KnowledgeNode(
        code="dicts.create",
        title="字典创建与操作",
        difficulty=2,
        duration_minutes=30,
        prerequisites=["basics.types"],
        attributes={"track": "data_structures", "category": "字典与集合"},
    ),
    "dicts.methods": KnowledgeNode(
        code="dicts.methods",
        title="字典方法",
        difficulty=2,
        duration_minutes=25,
        prerequisites=["dicts.create"],
        attributes={"track": "data_structures", "category": "字典与集合"},
    ),
    "dicts.iterate": KnowledgeNode(
        code="dicts.iterate",
        title="字典遍历",
        difficulty=2,
        duration_minutes=25,
        prerequisites=["dicts.create", "loops.for"],
        attributes={"track": "data_structures", "category": "字典与集合"},
    ),
    "sets.create": KnowledgeNode(
        code="sets.create",
        title="集合创建与操作",
        difficulty=2,
        duration_minutes=25,
        prerequisites=["basics.types"],
        attributes={"track": "data_structures", "category": "字典与集合"},
    ),
    "sets.operations": KnowledgeNode(
        code="sets.operations",
        title="集合运算",
        difficulty=3,
        duration_minutes=30,
        prerequisites=["sets.create"],
        attributes={"track": "data_structures", "category": "字典与集合"},
    ),

    # ==================== 字符串处理 (difficulty: 2-3) ====================
    "strings.methods": KnowledgeNode(
        code="strings.methods",
        title="字符串方法",
        difficulty=2,
        duration_minutes=30,
        prerequisites=["basics.types"],
        attributes={"track": "data_structures", "category": "字符串处理"},
    ),
    "strings.format": KnowledgeNode(
        code="strings.format",
        title="字符串格式化",
        difficulty=2,
        duration_minutes=25,
        prerequisites=["strings.methods"],
        attributes={"track": "data_structures", "category": "字符串处理"},
    ),
    "strings.split": KnowledgeNode(
        code="strings.split",
        title="字符串分割与连接",
        difficulty=2,
        duration_minutes=25,
        prerequisites=["strings.methods", "lists.create"],
        attributes={"track": "data_structures", "category": "字符串处理"},
    ),

    # ==================== 函数 (difficulty: 2-4) ====================
    "functions.def": KnowledgeNode(
        code="functions.def",
        title="函数定义",
        difficulty=2,
        duration_minutes=30,
        prerequisites=["basics.variables"],
        attributes={"track": "core", "category": "函数"},
    ),
    "functions.params": KnowledgeNode(
        code="functions.params",
        title="函数参数",
        difficulty=2,
        duration_minutes=30,
        prerequisites=["functions.def"],
        attributes={"track": "core", "category": "函数"},
    ),
    "functions.return": KnowledgeNode(
        code="functions.return",
        title="返回值",
        difficulty=2,
        duration_minutes=25,
        prerequisites=["functions.def"],
        attributes={"track": "core", "category": "函数"},
    ),
    "functions.recursion": KnowledgeNode(
        code="functions.recursion",
        title="递归函数",
        difficulty=3,
        duration_minutes=40,
        prerequisites=["functions.def", "conditions.if"],
        attributes={"track": "core", "category": "函数"},
    ),
    "functions.lambda": KnowledgeNode(
        code="functions.lambda",
        title="Lambda表达式",
        difficulty=3,
        duration_minutes=30,
        prerequisites=["functions.def"],
        attributes={"track": "core", "category": "函数"},
    ),

    # ==================== 异常处理 (difficulty: 3) ====================
    "exceptions.try": KnowledgeNode(
        code="exceptions.try",
        title="try-except基础",
        difficulty=3,
        duration_minutes=30,
        prerequisites=["functions.def"],
        attributes={"track": "advanced", "category": "异常处理"},
    ),
    "exceptions.multiple": KnowledgeNode(
        code="exceptions.multiple",
        title="多异常处理",
        difficulty=3,
        duration_minutes=30,
        prerequisites=["exceptions.try"],
        attributes={"track": "advanced", "category": "异常处理"},
    ),

    # ==================== 文件操作 (difficulty: 3) ====================
    "files.read": KnowledgeNode(
        code="files.read",
        title="文件读取",
        difficulty=3,
        duration_minutes=30,
        prerequisites=["functions.def"],
        attributes={"track": "advanced", "category": "文件操作"},
    ),
    "files.write": KnowledgeNode(
        code="files.write",
        title="文件写入",
        difficulty=3,
        duration_minutes=30,
        prerequisites=["files.read"],
        attributes={"track": "advanced", "category": "文件操作"},
    ),

    # ==================== 面向对象基础 (difficulty: 4) ====================
    "oop.class": KnowledgeNode(
        code="oop.class",
        title="类与对象",
        difficulty=4,
        duration_minutes=45,
        prerequisites=["functions.def"],
        attributes={"track": "advanced", "category": "面向对象"},
    ),
    "oop.inheritance": KnowledgeNode(
        code="oop.inheritance",
        title="继承",
        difficulty=4,
        duration_minutes=40,
        prerequisites=["oop.class"],
        attributes={"track": "advanced", "category": "面向对象"},
    ),
}

_user_states: Dict[UUID, Dict[str, UserNodeState]] = {}


@router.get("/nodes", response_model=List[KnowledgeNode])
async def list_nodes() -> List[KnowledgeNode]:
    return list(_nodes.values())


@router.get("/user/{user_id}", response_model=List[LearningPathItem])
async def user_graph(user_id: UUID) -> List[LearningPathItem]:
    user_state = _user_states.setdefault(user_id, {})
    items: List[LearningPathItem] = []
    for code, node in _nodes.items():
        state = user_state.get(code, UserNodeState(node_code=code, status="not_started", mastery=0))
        items.append(LearningPathItem(node=node, status=state))
    return items


@router.post("/user/{user_id}/state", response_model=UserNodeState)
async def update_state(user_id: UUID, payload: UserNodeState) -> UserNodeState:
    _user_states.setdefault(user_id, {})[payload.node_code] = payload
    return payload
