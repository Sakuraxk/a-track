from typing import Any


def skill_node(
    node_id: str,
    label: str,
    description: str,
    tags: list[str],
    children: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "id": node_id,
        "label": label,
        "description": description,
        "tags": tags,
        "children": children or [],
    }


PYTHON_TREE = skill_node(
    "python",
    "Python 学习路线",
    "一条从零基础走向工程实践、自动化、数据处理与服务端开发的成长型 Python 技术树。",
    ["programming", "python", "growth"],
    [
        skill_node(
            "python.foundations",
            "编程入门",
            "建立 Python 学习最基础的语法、控制流与函数能力。",
            ["foundation"],
            [
                skill_node(
                    "python.syntax",
                    "变量、类型与输入输出",
                    "理解程序运行最基本的数据与交互方式。",
                    ["foundation", "syntax"],
                    [
                        skill_node("python.syntax.variables", "变量与数据类型", "掌握变量、整数、浮点数、字符串与布尔值。", ["foundation", "syntax"]),
                        skill_node("python.syntax.input-output", "输入与输出", "学会使用 input、print 以及格式化输出。", ["foundation", "syntax"]),
                        skill_node("python.syntax.type-conversion", "类型转换", "理解不同类型之间的转换与常见报错。", ["foundation", "syntax"]),
                    ],
                ),
                skill_node(
                    "python.operators",
                    "表达式与运算",
                    "建立表达式计算、比较与逻辑判断的直觉。",
                    ["foundation", "syntax"],
                    [
                        skill_node("python.operators.arithmetic", "算术运算", "掌握加减乘除、整除、取模与幂运算。", ["foundation", "syntax"]),
                        skill_node("python.operators.comparison", "比较运算", "使用比较运算判断数据关系。", ["foundation", "syntax"]),
                        skill_node("python.operators.logic", "逻辑运算", "通过 and、or、not 组合条件。", ["foundation", "syntax"]),
                    ],
                ),
                skill_node(
                    "python.control",
                    "条件与循环",
                    "建立流程控制能力，能写出基础程序逻辑。",
                    ["foundation", "control-flow"],
                    [
                        skill_node("python.control.conditions", "条件分支", "掌握 if / elif / else 的基本写法。", ["foundation", "control-flow"]),
                        skill_node("python.control.loops", "循环结构", "掌握 for / while 与循环变量。", ["foundation", "control-flow"]),
                        skill_node("python.control.loop-control", "循环控制", "学会 break、continue 与常见循环模式。", ["foundation", "control-flow"]),
                    ],
                ),
                skill_node(
                    "python.functions.entry",
                    "函数入门",
                    "从重复代码中抽象出函数，建立程序组织意识。",
                    ["foundation", "functions"],
                    [
                        skill_node("python.functions.entry.define-call", "定义与调用函数", "理解 def、函数名、调用关系与执行过程。", ["foundation", "functions"]),
                        skill_node("python.functions.entry.parameters", "参数与返回值", "学会向函数传值并接收结果。", ["foundation", "functions"]),
                        skill_node("python.functions.entry.scope", "作用域基础", "认识局部变量、全局变量与命名冲突。", ["foundation", "functions"]),
                    ],
                ),
            ],
        ),
        skill_node(
            "python.core",
            "Python 核心能力",
            "掌握数据结构、模块化、文件处理、异常与面向对象等核心能力。",
            ["core"],
            [
                skill_node(
                    "python.collections",
                    "常用数据结构",
                    "掌握日常编程最常用的数据结构与基本操作。",
                    ["core", "data-structure"],
                    [
                        skill_node("python.collections.list-tuple", "列表与元组", "掌握增删改查、切片与遍历。", ["core", "data-structure"]),
                        skill_node("python.collections.dict-set", "字典与集合", "掌握键值映射、集合运算与查找。", ["core", "data-structure"]),
                        skill_node("python.collections.string", "字符串处理", "掌握切片、拼接、查找与常用字符串方法。", ["core", "text"]),
                    ],
                ),
                skill_node(
                    "python.modules",
                    "模块与包",
                    "学会复用代码、组织文件并理解导入机制。",
                    ["core", "module"],
                    [
                        skill_node("python.modules.import", "import 机制", "理解 import、from import 与命名空间。", ["core", "module"]),
                        skill_node("python.modules.package", "包结构", "学会使用目录与 __init__ 管理模块。", ["core", "module"]),
                        skill_node("python.modules.reuse", "代码复用", "用模块化思维拆分重复逻辑。", ["core", "module"]),
                    ],
                ),
                skill_node(
                    "python.files",
                    "文件与数据读写",
                    "掌握文本文件、路径与常见结构化数据的处理方式。",
                    ["core", "io"],
                    [
                        skill_node("python.files.text", "文本文件读写", "掌握 open、read、write 与 with。", ["core", "io"]),
                        skill_node("python.files.pathlib", "路径处理", "学会使用 pathlib 与文件路径拼接。", ["core", "io"]),
                        skill_node("python.files.serialization", "JSON 与序列化", "处理 JSON、字典与结构化配置。", ["core", "io"]),
                    ],
                ),
                skill_node(
                    "python.exceptions",
                    "异常处理",
                    "学会面对错误、定位问题并安全恢复程序流程。",
                    ["core", "error-handling"],
                    [
                        skill_node("python.exceptions.try-except", "try / except", "处理运行时异常并避免程序崩溃。", ["core", "error-handling"]),
                        skill_node("python.exceptions.raise", "主动抛出异常", "在输入非法或状态异常时主动报错。", ["core", "error-handling"]),
                        skill_node("python.exceptions.finally", "finally 与资源清理", "确保文件、连接等资源正确关闭。", ["core", "error-handling"]),
                    ],
                ),
                skill_node(
                    "python.oop",
                    "面向对象基础",
                    "理解类、实例、方法与对象协作的思路。",
                    ["core", "oop"],
                    [
                        skill_node("python.oop.class-object", "类与对象", "掌握 class、实例属性与方法调用。", ["core", "oop"]),
                        skill_node("python.oop.inheritance", "继承与组合", "理解复用逻辑与对象之间的组织关系。", ["core", "oop"]),
                        skill_node("python.oop.dataclass", "dataclass 基础", "用 dataclass 简化数据对象定义。", ["core", "oop"]),
                    ],
                ),
            ],
        ),
        skill_node(
            "python.engineering",
            "工程与调试",
            "从会写代码走向能维护、能定位问题、能协作的工程实践。",
            ["engineering"],
            [
                skill_node(
                    "python.env",
                    "环境与依赖管理",
                    "学会隔离依赖、安装包与管理项目环境。",
                    ["engineering", "environment"],
                    [
                        skill_node("python.env.python-runner", "运行方式与解释器", "理解脚本执行、解释器版本与 shebang。", ["engineering", "environment"]),
                        skill_node("python.env.virtualenv", "虚拟环境", "学会 venv 与项目级隔离。", ["engineering", "environment"]),
                        skill_node("python.env.dependencies", "依赖管理", "管理 requirements、pip 与常见依赖冲突。", ["engineering", "environment"]),
                    ],
                ),
                skill_node(
                    "python.debugging",
                    "调试方法",
                    "建立读报错、定位问题、验证修复的调试能力。",
                    ["engineering", "debugging"],
                    [
                        skill_node("python.debugging.traceback", "读 traceback", "学会通过报错栈定位真实问题位置。", ["engineering", "debugging"]),
                        skill_node("python.debugging.pdb", "pdb 与断点调试", "使用断点、变量观察与单步执行。", ["engineering", "debugging"]),
                        skill_node("python.debugging.repro", "复现与排查", "学会缩小问题范围并设计最小复现。", ["engineering", "debugging"]),
                    ],
                ),
                skill_node(
                    "python.logging",
                    "日志与可观测性",
                    "为脚本和服务加上足够可排查的信息。",
                    ["engineering", "logging"],
                    [
                        skill_node("python.logging.basics", "logging 基础", "使用 logging 输出等级化日志。", ["engineering", "logging"]),
                        skill_node("python.logging.context", "上下文日志", "为日志加上任务、用户、请求等上下文。", ["engineering", "logging"]),
                        skill_node("python.logging.analysis", "日志分析", "利用日志定位失败流程与异常行为。", ["engineering", "logging"]),
                    ],
                ),
                skill_node(
                    "python.testing",
                    "测试与质量保障",
                    "建立最基础的测试习惯和回归保护能力。",
                    ["engineering", "testing"],
                    [
                        skill_node("python.testing.pytest", "pytest 入门", "掌握测试函数、断言与基础执行方式。", ["engineering", "testing"]),
                        skill_node("python.testing.fixtures", "fixtures 与参数化", "用 fixtures 与参数化减少重复测试。", ["engineering", "testing"]),
                        skill_node("python.testing.mocking", "mock 与依赖隔离", "隔离外部依赖并聚焦核心逻辑测试。", ["engineering", "testing"]),
                    ],
                ),
                skill_node(
                    "python.project",
                    "项目结构与协作",
                    "让代码更可维护，也能更顺畅地与他人协作。",
                    ["engineering", "project"],
                    [
                        skill_node("python.project.layout", "目录结构", "组织 src、tests、scripts、configs 等目录。", ["engineering", "project"]),
                        skill_node("python.project.style", "代码规范", "掌握命名、格式化、注释与代码整洁。", ["engineering", "project"]),
                        skill_node("python.project.git", "Git 协作基础", "用分支、提交和回滚管理代码演进。", ["engineering", "project"]),
                    ],
                ),
            ],
        ),
        skill_node(
            "python.automation",
            "自动化与脚本",
            "把 Python 用到真实任务里，提升个人与团队效率。",
            ["automation"],
            [
                skill_node(
                    "python.cli",
                    "命令行脚本",
                    "学会把脚本做成可以重复使用的小工具。",
                    ["automation", "cli"],
                    [
                        skill_node("python.cli.argparse", "命令行参数", "通过 argparse 接收用户输入参数。", ["automation", "cli"]),
                        skill_node("python.cli.subcommands", "子命令设计", "为一个工具提供多个独立操作入口。", ["automation", "cli"]),
                        skill_node("python.cli.output", "终端输出体验", "优化脚本输出、进度提示与错误提示。", ["automation", "cli"]),
                    ],
                ),
                skill_node(
                    "python.filesystem",
                    "文件系统自动化",
                    "批量处理目录、文件、路径和格式转换任务。",
                    ["automation", "filesystem"],
                    [
                        skill_node("python.filesystem.batch", "批量文件处理", "批量重命名、移动、复制与整理文件。", ["automation", "filesystem"]),
                        skill_node("python.filesystem.glob", "glob 与筛选", "按模式定位目标文件并过滤处理范围。", ["automation", "filesystem"]),
                        skill_node("python.filesystem.reports", "批量报告生成", "从文件数据中汇总并输出结果。", ["automation", "filesystem"]),
                    ],
                ),
                skill_node(
                    "python.network-automation",
                    "接口与网络自动化",
                    "通过 HTTP 请求和 API 集成完成自动化流程。",
                    ["automation", "network"],
                    [
                        skill_node("python.network-automation.requests", "requests 基础", "发送 GET、POST 请求并解析响应。", ["automation", "network"]),
                        skill_node("python.network-automation.auth", "认证与鉴权", "处理 token、headers 与会话认证。", ["automation", "network"]),
                        skill_node("python.network-automation.retry", "重试与健壮性", "为不稳定请求增加超时、重试和错误处理。", ["automation", "network"]),
                    ],
                ),
                skill_node(
                    "python.office-automation",
                    "办公与数据自动化",
                    "面向表格、报表和日常办公流程的自动化任务。",
                    ["automation", "office"],
                    [
                        skill_node("python.office-automation.csv", "CSV 自动化", "批量读取、清洗、输出 CSV 文件。", ["automation", "office"]),
                        skill_node("python.office-automation.excel", "Excel 基础自动化", "处理表格读取、写入与基础格式。", ["automation", "office"]),
                        skill_node("python.office-automation.mail", "邮件与通知脚本", "自动发送通知、日报和任务提醒。", ["automation", "office"]),
                    ],
                ),
                skill_node(
                    "python.scheduler",
                    "任务调度与运行",
                    "让脚本从一次性执行进化为可持续运行的任务。",
                    ["automation", "scheduler"],
                    [
                        skill_node("python.scheduler.cron", "定时任务", "使用 cron 或系统计划任务定期执行脚本。", ["automation", "scheduler"]),
                        skill_node("python.scheduler.subprocess", "子进程与外部命令", "调用 shell 命令并处理输出结果。", ["automation", "scheduler"]),
                        skill_node("python.scheduler.monitoring", "任务监控", "监控任务成功率、失败重试与运行日志。", ["automation", "scheduler"]),
                    ],
                ),
            ],
        ),
        skill_node(
            "python.data",
            "数据处理与分析",
            "用 Python 处理结构化数据、做基础分析并产出结果。",
            ["data"],
            [
                skill_node(
                    "python.data.formats",
                    "常见数据格式",
                    "掌握文本、CSV、JSON 等常见格式的处理方式。",
                    ["data", "format"],
                    [
                        skill_node("python.data.formats.csv", "CSV 处理", "读取、写入和清洗 CSV 数据。", ["data", "format"]),
                        skill_node("python.data.formats.json", "JSON 处理", "解析、转换和输出 JSON 数据。", ["data", "format"]),
                        skill_node("python.data.formats.text", "文本预处理", "进行文本清洗、提取和格式转换。", ["data", "format"]),
                    ],
                ),
                skill_node(
                    "python.data.pandas",
                    "Pandas 入门",
                    "使用 DataFrame 进行基础的数据整理与分析。",
                    ["data", "pandas"],
                    [
                        skill_node("python.data.pandas.series-dataframe", "Series 与 DataFrame", "理解 Pandas 的核心数据结构。", ["data", "pandas"]),
                        skill_node("python.data.pandas.cleaning", "数据清洗", "处理缺失值、重复值和列转换。", ["data", "pandas"]),
                        skill_node("python.data.pandas.grouping", "筛选与分组", "使用筛选、排序、分组与聚合分析数据。", ["data", "pandas"]),
                    ],
                ),
                skill_node(
                    "python.data.analysis",
                    "分析与表达",
                    "把处理好的数据转成结论、图表和报告。",
                    ["data", "analysis"],
                    [
                        skill_node("python.data.analysis.summary", "描述性分析", "统计均值、分布、最大最小值等基本指标。", ["data", "analysis"]),
                        skill_node("python.data.analysis.visualization", "可视化基础", "使用图表表达数据变化与差异。", ["data", "analysis"]),
                        skill_node("python.data.analysis.reporting", "分析报告输出", "把结论整理成表格、文本或脚本结果。", ["data", "analysis"]),
                    ],
                ),
                skill_node(
                    "python.data.workflow",
                    "数据脚本工作流",
                    "让数据处理过程可复用、可调试、可持续运行。",
                    ["data", "workflow"],
                    [
                        skill_node("python.data.workflow.pipeline", "处理流程拆分", "把提取、清洗、输出拆成明确阶段。", ["data", "workflow"]),
                        skill_node("python.data.workflow.notebook", "Notebook 与脚本协同", "区分探索分析与正式脚本产物。", ["data", "workflow"]),
                        skill_node("python.data.workflow.validation", "数据校验", "在处理流程中增加数据质量检查。", ["data", "workflow"]),
                    ],
                ),
            ],
        ),
        skill_node(
            "python.web",
            "Web 与服务端基础",
            "为 API 服务、后端开发和工程协作打基础。",
            ["web", "backend"],
            [
                skill_node(
                    "python.web.http",
                    "HTTP 基础",
                    "理解请求、响应、状态码和常见 API 交互模式。",
                    ["web", "backend"],
                    [
                        skill_node("python.web.http.methods", "请求方法", "理解 GET、POST、PUT、DELETE 的职责。", ["web", "backend"]),
                        skill_node("python.web.http.status", "状态码", "理解成功、失败与重定向的状态码含义。", ["web", "backend"]),
                        skill_node("python.web.http.rest", "REST 风格", "理解资源、路径设计与接口语义。", ["web", "backend"]),
                    ],
                ),
                skill_node(
                    "python.web.fastapi",
                    "FastAPI 入门",
                    "掌握 Python 服务端开发的入门框架能力。",
                    ["web", "backend", "fastapi"],
                    [
                        skill_node("python.web.fastapi.routes", "路由与处理函数", "编写最基础的 API 路由。", ["web", "backend", "fastapi"]),
                        skill_node("python.web.fastapi.validation", "请求校验", "使用 Pydantic 校验输入与输出。", ["web", "backend", "fastapi"]),
                        skill_node("python.web.fastapi.dependency", "依赖注入", "使用依赖注入组织服务与资源。", ["web", "backend", "fastapi"]),
                    ],
                ),
                skill_node(
                    "python.web.database",
                    "数据库基础",
                    "建立服务端与数据存储之间的连接能力。",
                    ["web", "backend", "database"],
                    [
                        skill_node("python.web.database.sqlite", "SQLite 与基础 SQL", "理解最基础的数据表与查询。", ["web", "backend", "database"]),
                        skill_node("python.web.database.orm", "ORM 入门", "用 ORM 组织模型与数据库交互。", ["web", "backend", "database"]),
                        skill_node("python.web.database.migration", "迁移与演进", "理解表结构变更与迁移流程。", ["web", "backend", "database"]),
                    ],
                ),
                skill_node(
                    "python.web.auth",
                    "认证与部署基础",
                    "了解后端服务的用户认证与最基础发布流程。",
                    ["web", "backend", "auth"],
                    [
                        skill_node("python.web.auth.sessions", "会话与令牌", "理解 session、token 与基础认证流程。", ["web", "backend", "auth"]),
                        skill_node("python.web.auth.permissions", "权限控制", "区分身份认证与权限判断。", ["web", "backend", "auth"]),
                        skill_node("python.web.auth.deploy", "部署基础", "理解环境变量、启动命令与基础部署。", ["web", "backend", "auth"]),
                    ],
                ),
            ],
        ),
        skill_node(
            "python.advanced",
            "进阶能力",
            "从会用 Python 走向能写出更灵活、更高性能、更可维护的代码。",
            ["advanced"],
            [
                skill_node(
                    "python.iteration",
                    "迭代器与生成器",
                    "理解 Python 的惰性求值与迭代协议。",
                    ["advanced", "iteration"],
                    [
                        skill_node("python.iteration.iterables", "可迭代对象", "理解 iterable、iterator 与遍历机制。", ["advanced", "iteration"]),
                        skill_node("python.iteration.generator", "生成器", "掌握 yield 与生成器函数。", ["advanced", "iteration"]),
                        skill_node("python.iteration.comprehension", "推导式", "用推导式提高表达能力与代码简洁度。", ["advanced", "iteration"]),
                    ],
                ),
                skill_node(
                    "python.advanced-tools",
                    "高级语言工具",
                    "掌握让代码更灵活的高级语法工具。",
                    ["advanced", "language-tooling"],
                    [
                        skill_node("python.advanced-tools.decorators", "装饰器", "理解装饰器如何包装函数行为。", ["advanced", "language-tooling"]),
                        skill_node("python.advanced-tools.context", "上下文管理器", "掌握 with 与上下文资源管理。", ["advanced", "language-tooling"]),
                        skill_node("python.advanced-tools.typing", "类型提示", "使用类型标注提升可维护性与提示体验。", ["advanced", "language-tooling"]),
                    ],
                ),
                skill_node(
                    "python.asyncio",
                    "异步与并发",
                    "处理 IO 密集任务与高并发场景的基础能力。",
                    ["advanced", "async"],
                    [
                        skill_node("python.asyncio.basics", "异步编程基础", "理解 async / await、协程与事件循环。", ["advanced", "async"]),
                        skill_node("python.asyncio.tasks", "任务并发", "掌握任务调度、并发等待与取消。", ["advanced", "async"]),
                        skill_node("python.asyncio.io", "异步 IO", "处理异步请求、文件与网络 IO。", ["advanced", "async"]),
                    ],
                ),
                skill_node(
                    "python.performance",
                    "性能与优化",
                    "知道什么时候该优化，以及如何找到性能瓶颈。",
                    ["advanced", "performance"],
                    [
                        skill_node("python.performance.profiling", "性能分析", "用 profiling 找到热点函数和瓶颈。", ["advanced", "performance"]),
                        skill_node("python.performance.caching", "缓存策略", "理解本地缓存与结果复用。", ["advanced", "performance"]),
                        skill_node("python.performance.memory", "内存与数据量意识", "避免无谓的数据复制和内存浪费。", ["advanced", "performance"]),
                    ],
                ),
            ],
        ),
        skill_node(
            "python.projects",
            "综合实战",
            "把前面能力真正组合起来，做出可用、可讲、可展示的项目。",
            ["project"],
            [
                skill_node(
                    "python.projects.automation",
                    "自动化工具项目",
                    "把脚本能力落成真实可用的小工具。",
                    ["project", "automation"],
                    [
                        skill_node("python.projects.automation.file-organizer", "文件整理工具", "用 Python 批量整理下载目录与文件结构。", ["project", "automation"]),
                        skill_node("python.projects.automation.log-tool", "日志分析工具", "读取日志并输出问题统计与摘要。", ["project", "automation"]),
                        skill_node("python.projects.automation.backup", "备份与同步脚本", "实现文件备份、校验和定时运行。", ["project", "automation"]),
                    ],
                ),
                skill_node(
                    "python.projects.data",
                    "数据脚本项目",
                    "把数据处理、清洗与分析串成完整流程。",
                    ["project", "data"],
                    [
                        skill_node("python.projects.data.report", "自动报表脚本", "从 CSV/JSON 生成周期性分析报表。", ["project", "data"]),
                        skill_node("python.projects.data.etl", "轻量 ETL 流程", "实现抽取、转换、输出的迷你数据管道。", ["project", "data"]),
                        skill_node("python.projects.data.monitor", "数据监控脚本", "监控数据异常并发出提醒。", ["project", "data"]),
                    ],
                ),
                skill_node(
                    "python.projects.api",
                    "API 服务项目",
                    "通过真实服务端项目串起接口、数据库与测试。",
                    ["project", "backend"],
                    [
                        skill_node("python.projects.api.todo", "任务管理 API", "实现一个可增删改查的 API 服务。", ["project", "backend"]),
                        skill_node("python.projects.api.auth", "带认证的 API", "在服务中加入登录、权限与保护路由。", ["project", "backend"]),
                        skill_node("python.projects.api.observability", "可观测服务", "为 API 加日志、错误处理和测试。", ["project", "backend"]),
                    ],
                ),
                skill_node(
                    "python.projects.quality",
                    "质量与交付项目",
                    "学会让项目不仅能跑，还更稳定、可维护、可迭代。",
                    ["project", "engineering"],
                    [
                        skill_node("python.projects.quality.pytest-suite", "项目测试套件", "为已有项目建立 pytest 回归保护。", ["project", "engineering"]),
                        skill_node("python.projects.quality.ci", "持续集成基础", "让测试、格式检查和构建自动化执行。", ["project", "engineering"]),
                        skill_node("python.projects.quality.refactor", "重构与版本演进", "在不破坏行为的前提下逐步改进项目结构。", ["project", "engineering"]),
                    ],
                ),
            ],
        ),
    ],
)


MACHINE_LEARNING_TREE = skill_node(
    "machine_learning",
    "机器学习学习路线",
    "一条从问题建模、数据处理、经典算法到评估、部署与项目实践的成长型机器学习技能树。",
    ["machine-learning", "data", "modeling"],
    [
        skill_node(
            "machine_learning.foundations",
            "机器学习基础认知",
            "先建立任务类型、基本概念和通用工作流认知，知道机器学习到底在解决什么问题。",
            ["foundation"],
            [
                skill_node(
                    "machine_learning.foundations.problem-types",
                    "任务类型与学习范式",
                    "理解监督学习、无监督学习、半监督学习和强化学习的边界与典型场景。",
                    ["foundation", "paradigm"],
                    [
                        skill_node("machine_learning.foundations.problem-types.supervised", "监督学习", "理解带标签数据、回归与分类任务的基本形式。", ["foundation", "supervised"]),
                        skill_node("machine_learning.foundations.problem-types.unsupervised", "无监督学习", "理解聚类、降维和结构发现任务。", ["foundation", "unsupervised"]),
                        skill_node("machine_learning.foundations.problem-types.transfer", "迁移与自监督概念", "对迁移学习、自监督学习和预训练形成初步认识。", ["foundation", "modern-ml"]),
                    ],
                ),
                skill_node(
                    "machine_learning.foundations.dataset-basics",
                    "数据集与样本视角",
                    "知道样本、特征、标签、分布和数据泄漏这些概念为什么重要。",
                    ["foundation", "data"],
                    [
                        skill_node("machine_learning.foundations.dataset-basics.samples-features", "样本与特征", "理解行、列、特征维度与标签之间的关系。", ["foundation", "data"]),
                        skill_node("machine_learning.foundations.dataset-basics.split", "训练/验证/测试集", "掌握为什么要拆分数据集以及各自职责。", ["foundation", "evaluation"]),
                        skill_node("machine_learning.foundations.dataset-basics.leakage", "数据泄漏意识", "识别不合理特征、时间穿越和信息泄漏问题。", ["foundation", "data-quality"]),
                    ],
                ),
                skill_node(
                    "machine_learning.foundations.generalization",
                    "泛化与学习目标",
                    "理解模型不是记忆数据，而是学习可迁移规律。",
                    ["foundation", "generalization"],
                    [
                        skill_node("machine_learning.foundations.generalization.overfit-underfit", "过拟合与欠拟合", "理解模型复杂度不足或过强时的典型表现。", ["foundation", "generalization"]),
                        skill_node("machine_learning.foundations.generalization.bias-variance", "偏差-方差权衡", "建立模型误差来源的分析框架。", ["foundation", "generalization"]),
                        skill_node("machine_learning.foundations.generalization.baseline", "基线与业务目标", "先定义业务目标、可比较基线和上线标准。", ["foundation", "workflow"]),
                    ],
                ),
            ],
        ),
        skill_node(
            "machine_learning.math-data",
            "数学与数据准备",
            "机器学习的很多效果差异都来自数学直觉和数据准备质量。",
            ["math", "data"],
            [
                skill_node(
                    "machine_learning.math-data.linear-algebra",
                    "线性代数基础",
                    "理解向量、矩阵和空间变换在模型中的意义。",
                    ["math", "linear-algebra"],
                    [
                        skill_node("machine_learning.math-data.linear-algebra.vectors", "向量与矩阵", "掌握向量表示样本、矩阵表示数据集的思路。", ["math", "linear-algebra"]),
                        skill_node("machine_learning.math-data.linear-algebra.dot", "点积与矩阵乘法", "理解线性模型和神经网络中的核心计算。", ["math", "linear-algebra"]),
                        skill_node("machine_learning.math-data.linear-algebra.eigen", "特征值与特征向量直觉", "为 PCA 和降维方法打基础。", ["math", "linear-algebra"]),
                    ],
                ),
                skill_node(
                    "machine_learning.math-data.probability-stats",
                    "概率统计基础",
                    "从不确定性、分布和统计估计角度理解模型行为。",
                    ["math", "statistics"],
                    [
                        skill_node("machine_learning.math-data.probability-stats.distribution", "常见分布", "理解正态分布、伯努利分布等常见数据分布。", ["math", "statistics"]),
                        skill_node("machine_learning.math-data.probability-stats.expectation", "期望、方差与协方差", "掌握分布描述和特征关系分析的基础量。", ["math", "statistics"]),
                        skill_node("machine_learning.math-data.probability-stats.hypothesis", "抽样与置信区间", "形成实验对比和结果波动的统计意识。", ["math", "statistics"]),
                    ],
                ),
                skill_node(
                    "machine_learning.math-data.preprocessing",
                    "数据预处理与特征工程",
                    "高质量的数据准备通常比盲目换模型更重要。",
                    ["data", "feature-engineering"],
                    [
                        skill_node("machine_learning.math-data.preprocessing.cleaning", "缺失值与异常值处理", "掌握缺失值填补、异常样本检查与数据一致性处理。", ["data", "cleaning"]),
                        skill_node("machine_learning.math-data.preprocessing.encoding", "类别编码与标准化", "掌握 one-hot、label encoding、标准化和归一化。", ["data", "feature-engineering"]),
                        skill_node("machine_learning.math-data.preprocessing.features", "特征构造与选择", "学会构造交叉特征、筛选无效特征并减少噪声。", ["data", "feature-engineering"]),
                    ],
                ),
            ],
        ),
        skill_node(
            "machine_learning.supervised",
            "经典监督学习",
            "先把回归和分类两条主线打牢，再理解不同算法的适用边界。",
            ["supervised"],
            [
                skill_node(
                    "machine_learning.supervised.regression",
                    "回归建模",
                    "用连续数值预测任务理解损失函数、拟合能力与正则化。",
                    ["supervised", "regression"],
                    [
                        skill_node("machine_learning.supervised.regression.linear", "线性回归", "理解最小二乘、线性关系和可解释性。", ["supervised", "regression"]),
                        skill_node("machine_learning.supervised.regression.regularization", "岭回归与 Lasso", "通过正则化控制复杂度并缓解过拟合。", ["supervised", "regression"]),
                        skill_node("machine_learning.supervised.regression.polynomial", "多项式与非线性拟合", "理解线性模型如何通过特征变换表达非线性关系。", ["supervised", "regression"]),
                    ],
                ),
                skill_node(
                    "machine_learning.supervised.classification",
                    "线性分类与邻近方法",
                    "掌握基础分类模型的决策边界和使用场景。",
                    ["supervised", "classification"],
                    [
                        skill_node("machine_learning.supervised.classification.logistic", "逻辑回归", "掌握概率输出、sigmoid 和线性分类边界。", ["supervised", "classification"]),
                        skill_node("machine_learning.supervised.classification.knn", "KNN", "理解基于邻域相似度的分类与回归。", ["supervised", "classification"]),
                        skill_node("machine_learning.supervised.classification.naive-bayes", "朴素贝叶斯", "建立生成式分类器和条件独立假设直觉。", ["supervised", "classification"]),
                    ],
                ),
                skill_node(
                    "machine_learning.supervised.margin-kernel",
                    "间隔最大化与核方法",
                    "理解线性不可分问题如何通过间隔与核技巧处理。",
                    ["supervised", "kernel"],
                    [
                        skill_node("machine_learning.supervised.margin-kernel.svm", "支持向量机", "掌握超平面、间隔最大化和支持向量概念。", ["supervised", "svm"]),
                        skill_node("machine_learning.supervised.margin-kernel.kernel", "核函数直觉", "理解核技巧如何把样本映射到更高维空间。", ["supervised", "kernel"]),
                        skill_node("machine_learning.supervised.margin-kernel.multiclass", "多分类策略", "了解 one-vs-rest、one-vs-one 等多分类组织方式。", ["supervised", "classification"]),
                    ],
                ),
            ],
        ),
        skill_node(
            "machine_learning.ensemble",
            "树模型与集成方法",
            "树模型是经典机器学习里非常高价值的一条主线，实战中也很常见。",
            ["tree", "ensemble"],
            [
                skill_node(
                    "machine_learning.ensemble.trees",
                    "决策树基础",
                    "从树的划分规则出发理解非线性模型表达能力。",
                    ["tree"],
                    [
                        skill_node("machine_learning.ensemble.trees.split", "特征划分与信息增益", "理解 Gini、熵和节点划分逻辑。", ["tree"]),
                        skill_node("machine_learning.ensemble.trees.pruning", "剪枝与深度控制", "掌握防止树模型过拟合的常见手段。", ["tree", "generalization"]),
                        skill_node("machine_learning.ensemble.trees.interpretability", "树模型可解释性", "用规则路径和特征重要性解释模型判断。", ["tree", "interpretability"]),
                    ],
                ),
                skill_node(
                    "machine_learning.ensemble.bagging",
                    "Bagging 系列",
                    "通过样本重采样和模型集成提高稳定性。",
                    ["ensemble", "bagging"],
                    [
                        skill_node("machine_learning.ensemble.bagging.random-forest", "随机森林", "掌握多棵树投票和特征随机采样机制。", ["ensemble", "bagging"]),
                        skill_node("machine_learning.ensemble.bagging.oob", "袋外评估", "理解 OOB 评估如何近似验证模型效果。", ["ensemble", "evaluation"]),
                        skill_node("machine_learning.ensemble.bagging.feature-importance", "特征重要性", "利用随机森林分析关键变量与业务影响。", ["ensemble", "interpretability"]),
                    ],
                ),
                skill_node(
                    "machine_learning.ensemble.boosting",
                    "Boosting 系列",
                    "通过逐步纠错构建更强预测能力的集成模型。",
                    ["ensemble", "boosting"],
                    [
                        skill_node("machine_learning.ensemble.boosting.adaboost", "AdaBoost", "理解加权样本和弱学习器迭代思想。", ["ensemble", "boosting"]),
                        skill_node("machine_learning.ensemble.boosting.gbdt", "GBDT", "掌握梯度提升树的残差拟合思路。", ["ensemble", "boosting"]),
                        skill_node("machine_learning.ensemble.boosting.xgboost", "XGBoost / LightGBM 概念", "了解工业界常用提升树框架的优势与差异。", ["ensemble", "boosting", "industry"]),
                    ],
                ),
            ],
        ),
        skill_node(
            "machine_learning.unsupervised",
            "无监督学习",
            "在没有标签的情况下发现结构、压缩信息和识别异常。",
            ["unsupervised"],
            [
                skill_node(
                    "machine_learning.unsupervised.clustering",
                    "聚类方法",
                    "理解不同聚类方法如何发现样本之间的结构。",
                    ["unsupervised", "clustering"],
                    [
                        skill_node("machine_learning.unsupervised.clustering.kmeans", "K-Means", "掌握簇中心、初始化和迭代优化过程。", ["unsupervised", "clustering"]),
                        skill_node("machine_learning.unsupervised.clustering.hierarchical", "层次聚类", "理解自底向上和树状图分析方法。", ["unsupervised", "clustering"]),
                        skill_node("machine_learning.unsupervised.clustering.dbscan", "DBSCAN", "理解基于密度的聚类思想与噪声点识别。", ["unsupervised", "clustering"]),
                    ],
                ),
                skill_node(
                    "machine_learning.unsupervised.dimensionality-reduction",
                    "降维与表示学习",
                    "降低特征维度、去噪并帮助可视化与建模。",
                    ["unsupervised", "dimensionality-reduction"],
                    [
                        skill_node("machine_learning.unsupervised.dimensionality-reduction.pca", "PCA", "掌握主成分分析的目标和线性降维直觉。", ["unsupervised", "pca"]),
                        skill_node("machine_learning.unsupervised.dimensionality-reduction.tsne-umap", "t-SNE / UMAP 概念", "理解高维数据可视化与局部结构保持。", ["unsupervised", "visualization"]),
                        skill_node("machine_learning.unsupervised.dimensionality-reduction.feature-learning", "表示学习直觉", "理解特征表示为什么会影响下游模型效果。", ["unsupervised", "representation"]),
                    ],
                ),
                skill_node(
                    "machine_learning.unsupervised.anomaly-topic",
                    "异常检测与主题发现",
                    "把无监督方法用于监控、文本和推荐等场景。",
                    ["unsupervised", "application"],
                    [
                        skill_node("machine_learning.unsupervised.anomaly-topic.isolation-forest", "异常检测基础", "了解 Isolation Forest、LOF 等异常检测思路。", ["unsupervised", "anomaly-detection"]),
                        skill_node("machine_learning.unsupervised.anomaly-topic.topic-model", "主题模型概念", "理解文本主题发现和聚类式分析方法。", ["unsupervised", "nlp"]),
                        skill_node("machine_learning.unsupervised.anomaly-topic.recommendation", "相似度与召回直觉", "理解无监督表示在召回和推荐中的价值。", ["unsupervised", "recommendation"]),
                    ],
                ),
            ],
        ),
        skill_node(
            "machine_learning.evaluation",
            "评估、调参与实验",
            "机器学习不只是训练模型，更关键的是知道结果靠不靠谱、怎么比较和迭代。",
            ["evaluation", "experimentation"],
            [
                skill_node(
                    "machine_learning.evaluation.metrics",
                    "指标体系",
                    "根据任务目标选择对的指标，而不是只看一个分数。",
                    ["evaluation", "metrics"],
                    [
                        skill_node("machine_learning.evaluation.metrics.classification", "分类指标", "掌握准确率、精确率、召回率、F1、ROC-AUC。", ["evaluation", "classification"]),
                        skill_node("machine_learning.evaluation.metrics.regression", "回归指标", "掌握 MAE、MSE、RMSE、R2 等回归指标。", ["evaluation", "regression"]),
                        skill_node("machine_learning.evaluation.metrics.ranking", "排序与业务指标", "理解排序类任务和业务转化指标的关系。", ["evaluation", "business"]),
                    ],
                ),
                skill_node(
                    "machine_learning.evaluation.validation",
                    "验证方法与实验设计",
                    "减少偶然性，让离线实验结果更可信。",
                    ["evaluation", "validation"],
                    [
                        skill_node("machine_learning.evaluation.validation.cross-validation", "交叉验证", "掌握 K 折交叉验证与时间序列切分。", ["evaluation", "validation"]),
                        skill_node("machine_learning.evaluation.validation.imbalance", "类别不平衡处理", "面对长尾样本时合理采样和评估。", ["evaluation", "data-quality"]),
                        skill_node("machine_learning.evaluation.validation.error-analysis", "误差分析", "从错误样本中回看特征、标签和模型短板。", ["evaluation", "analysis"]),
                    ],
                ),
                skill_node(
                    "machine_learning.evaluation.tuning",
                    "调参与模型比较",
                    "学会高效比较模型而不是随机碰运气。",
                    ["evaluation", "tuning"],
                    [
                        skill_node("machine_learning.evaluation.tuning.grid-random", "Grid / Random Search", "理解系统化超参数搜索和代价权衡。", ["evaluation", "tuning"]),
                        skill_node("machine_learning.evaluation.tuning.pipeline", "Pipeline 与防泄漏", "把预处理和模型放进统一流程避免验证污染。", ["evaluation", "pipeline"]),
                        skill_node("machine_learning.evaluation.tuning.ensemble-selection", "模型对比与融合", "比较不同模型并理解简单融合策略。", ["evaluation", "ensemble"]),
                    ],
                ),
            ],
        ),
        skill_node(
            "machine_learning.deep-learning",
            "深度学习入门",
            "在打好经典机器学习基础后，建立神经网络与现代深度学习的入门理解。",
            ["deep-learning"],
            [
                skill_node(
                    "machine_learning.deep-learning.network-basics",
                    "神经网络基础",
                    "从感知机到多层网络建立计算图和参数学习直觉。",
                    ["deep-learning", "neural-network"],
                    [
                        skill_node("machine_learning.deep-learning.network-basics.perceptron", "感知机与多层感知机", "理解线性可分、层叠结构与表示能力。", ["deep-learning", "neural-network"]),
                        skill_node("machine_learning.deep-learning.network-basics.activation", "激活函数", "掌握 ReLU、Sigmoid、Tanh 的作用和区别。", ["deep-learning", "neural-network"]),
                        skill_node("machine_learning.deep-learning.network-basics.loss", "损失函数", "理解交叉熵、MSE 等损失如何驱动训练。", ["deep-learning", "optimization"]),
                    ],
                ),
                skill_node(
                    "machine_learning.deep-learning.training",
                    "训练与正则化",
                    "理解梯度下降、反向传播和防止过拟合的方法。",
                    ["deep-learning", "training"],
                    [
                        skill_node("machine_learning.deep-learning.training.backprop", "反向传播", "理解梯度如何从输出层传回参数。", ["deep-learning", "training"]),
                        skill_node("machine_learning.deep-learning.training.optimizers", "优化器", "掌握 SGD、Momentum、Adam 等优化器区别。", ["deep-learning", "optimization"]),
                        skill_node("machine_learning.deep-learning.training.regularization", "Dropout 与 BatchNorm", "了解正则化和训练稳定性的常见手段。", ["deep-learning", "regularization"]),
                    ],
                ),
                skill_node(
                    "machine_learning.deep-learning.frameworks",
                    "框架与典型结构",
                    "形成对现代深度学习工程的第一层认知。",
                    ["deep-learning", "framework"],
                    [
                        skill_node("machine_learning.deep-learning.frameworks.pytorch", "PyTorch 基础", "掌握 tensor、autograd 和训练循环骨架。", ["deep-learning", "framework"]),
                        skill_node("machine_learning.deep-learning.frameworks.cnn", "CNN 入门", "理解卷积网络在图像任务中的基本结构。", ["deep-learning", "cv"]),
                        skill_node("machine_learning.deep-learning.frameworks.transformer", "Transformer 概念", "建立注意力机制和大模型架构的初步认知。", ["deep-learning", "nlp"]),
                    ],
                ),
            ],
        ),
        skill_node(
            "machine_learning.projects",
            "项目与部署实践",
            "把机器学习能力真正落地成一个可复现、可部署、可迭代的项目。",
            ["project", "mlops"],
            [
                skill_node(
                    "machine_learning.projects.workflow",
                    "项目工作流",
                    "学会把 notebook、脚本、特征处理和实验管理串起来。",
                    ["project", "workflow"],
                    [
                        skill_node("machine_learning.projects.workflow.notebook-to-pipeline", "Notebook 到 Pipeline", "把探索性分析整理成可重复执行流程。", ["project", "workflow"]),
                        skill_node("machine_learning.projects.workflow.experiment-tracking", "实验记录", "记录参数、指标、数据版本和实验结论。", ["project", "experimentation"]),
                        skill_node("machine_learning.projects.workflow.reproducibility", "可复现性", "通过随机种子、依赖版本和数据快照保证复现。", ["project", "engineering"]),
                    ],
                ),
                skill_node(
                    "machine_learning.projects.deployment",
                    "部署与服务化",
                    "让模型从离线分析走向可调用服务。",
                    ["project", "deployment"],
                    [
                        skill_node("machine_learning.projects.deployment.api", "模型 API 服务", "把模型包装成预测接口供前后端调用。", ["project", "deployment"]),
                        skill_node("machine_learning.projects.deployment.batch", "批处理推理", "在离线批量场景中组织稳定的推理任务。", ["project", "deployment"]),
                        skill_node("machine_learning.projects.deployment.monitoring", "监控与漂移", "关注线上延迟、数据漂移和效果退化。", ["project", "mlops"]),
                    ],
                ),
                skill_node(
                    "machine_learning.projects.capstone",
                    "综合实战项目",
                    "通过完整项目把数据、模型、评估和交付串成闭环。",
                    ["project", "capstone"],
                    [
                        skill_node("machine_learning.projects.capstone.tabular", "结构化数据竞赛项目", "围绕表格数据做完整建模、调参与误差分析。", ["project", "capstone"]),
                        skill_node("machine_learning.projects.capstone.recommendation", "推荐或召回项目", "体验相似度、召回、排序和业务指标的结合。", ["project", "capstone"]),
                        skill_node("machine_learning.projects.capstone.vision-nlp", "CV / NLP 入门项目", "选择图像或文本方向完成一个端到端小项目。", ["project", "capstone"]),
                    ],
                ),
            ],
        ),
    ],
)
ADVANCED_MATH_TREE = skill_node(
    "advanced_math",
    "高等数学学习路线",
    "从极限与连续到多元函数微积分与级数，建立坚实的数学基础。",
    ["math", "calculus"],
    [
        skill_node(
            "advanced_math.limits",
            "极限与连续",
            "理解数列与函数的极限，以及连续性的概念。",
            ["limits"],
            [
                skill_node("advanced_math.limits.sequences", "数列极限", "掌握数列极限的定义与计算。", ["limits"]),
                skill_node("advanced_math.limits.functions", "函数极限", "掌握函数极限、左极限与右极限。", ["limits"]),
                skill_node("advanced_math.limits.continuity", "连续性", "理解函数在一点及区间的连续性。", ["limits"]),
            ]
        ),
        skill_node(
            "advanced_math.derivatives",
            "导数与微分",
            "掌握导数概念、求导法则与微分应用。",
            ["derivatives"],
            [
                skill_node("advanced_math.derivatives.rules", "求导法则", "熟练掌握复合函数、隐函数求导法则。", ["derivatives"]),
                skill_node("advanced_math.derivatives.applications", "导数应用", "应用导数求极值、最值、判断单调性。", ["derivatives"]),
            ]
        ),
        skill_node(
            "advanced_math.integrals",
            "积分学",
            "理解不定积分与定积分概念及计算方法。",
            ["integrals"],
            [
                skill_node("advanced_math.integrals.indefinite", "不定积分", "掌握基本积分公式与换元、分部积分法。", ["integrals"]),
                skill_node("advanced_math.integrals.definite", "定积分", "理解定积分概念，掌握牛顿-莱布尼茨公式。", ["integrals"]),
            ]
        ),
    ]
)


AI_LITERACY_TREE = skill_node(
    "ai_literacy",
    "AI通识与AI素养学习路线",
    "一条从全面认知AI到掌握AI智能体全流程落地能力、构建完整AI素养体系的成长型学习路线。",
    ["ai-literacy", "ai-agent", "general-education"],
    [
        # ──────────────────────────────────────────────────
        # 第一大部分：AI 通识（7 个单元）
        # ──────────────────────────────────────────────────
        skill_node(
            "ai_literacy.general",
            "AI 通识",
            "认识AI、了解AI的基础需求，零基础无公式，建立对AI的全局认知。",
            ["ai-general", "foundation"],
            [
                skill_node(
                    "ai_literacy.general.intro",
                    "课程导论与AI时代的认知重构",
                    "打破对AI的技术畏惧，明确AI智能体的核心价值。",
                    ["foundation", "intro"],
                    [
                        skill_node("ai_literacy.general.intro.landscape", "全球AI普及度洞察", "了解AI仍处发展初期，全行业全专业的机遇与挑战。", ["foundation", "intro"]),
                        skill_node("ai_literacy.general.intro.value", "大一学生学习AI的核心价值", "破除技术畏惧感，理解AI不是程序员专属。", ["foundation", "intro"]),
                        skill_node("ai_literacy.general.intro.concepts", "核心概念区分", "区分AI大模型、AI聊天机器人、AI智能体的本质。", ["foundation", "intro"]),
                    ],
                ),
                skill_node(
                    "ai_literacy.general.history",
                    "人工智能发展历程与核心里程碑",
                    "理解AI发展的历史脉络，看懂当前AI技术所处阶段。",
                    ["foundation", "history"],
                    [
                        skill_node("ai_literacy.general.history.waves", "AI三次发展浪潮", "从起源到三次浪潮的关键技术演进。", ["foundation", "history"]),
                        skill_node("ai_literacy.general.history.milestones", "关键技术节点", "图灵测试、深度学习、Transformer到大模型时代。", ["foundation", "history"]),
                        skill_node("ai_literacy.general.history.agi", "从专用AI到通用AI", "理解AGI的核心变革与中国AI发展格局。", ["foundation", "history"]),
                    ],
                ),
                skill_node(
                    "ai_literacy.general.llm",
                    "大模型核心原理通俗解读",
                    "零基础看懂AI底层逻辑，清晰认知AI能做什么、不能做什么。",
                    ["foundation", "llm"],
                    [
                        skill_node("ai_literacy.general.llm.how-it-thinks", "大模型如何思考", "通俗讲解LLM的底层逻辑与工作方式。", ["foundation", "llm"]),
                        skill_node("ai_literacy.general.llm.core-concepts", "核心概念解读", "Tokens、上下文窗口、预训练、涌现能力、多模态。", ["foundation", "llm"]),
                        skill_node("ai_literacy.general.llm.limitations", "能力边界与局限", "大模型的核心局限与AI智能体的关系。", ["foundation", "llm"]),
                    ],
                ),
                skill_node(
                    "ai_literacy.general.ecosystem",
                    "全球主流AI工具与智能体生态全景",
                    "全面掌握当前AI工具与智能体生态。",
                    ["foundation", "ecosystem"],
                    [
                        skill_node("ai_literacy.general.ecosystem.models", "顶级通用大模型盘点", "GPT系列、Claude、Gemini及国产主流模型对比。", ["foundation", "ecosystem"]),
                        skill_node("ai_literacy.general.ecosystem.tools", "AI工具生态全景", "办公提效、内容创作、设计、科研等垂直场景工具。", ["foundation", "ecosystem"]),
                        skill_node("ai_literacy.general.ecosystem.agents", "AI智能体核心分类与生态", "智能体核心价值、主流分类与开源生态。", ["foundation", "ecosystem"]),
                    ],
                ),
                skill_node(
                    "ai_literacy.general.applications",
                    "AI在全学科与全场景的应用落地",
                    "找到AI与自身专业、学习生活的结合点。",
                    ["foundation", "applications"],
                    [
                        skill_node("ai_literacy.general.applications.academic", "全学科AI应用", "AI在文、理、工、农、医、商、艺的学习与科研应用。", ["foundation", "applications"]),
                        skill_node("ai_literacy.general.applications.campus", "大学生核心AI应用场景", "课程学习、论文写作、学科竞赛、求职升学。", ["foundation", "applications"]),
                        skill_node("ai_literacy.general.applications.cases", "全专业AI落地案例", "真实案例拆解，具象化理解AI个人赋能价值。", ["foundation", "applications"]),
                    ],
                ),
                skill_node(
                    "ai_literacy.general.ethics",
                    "AI的伦理、安全与合规边界",
                    "建立AI使用的合规意识与伦理底线。",
                    ["foundation", "ethics"],
                    [
                        skill_node("ai_literacy.general.ethics.issues", "AI伦理核心议题", "偏见与歧视、隐私保护、学术诚信、知识产权。", ["foundation", "ethics"]),
                        skill_node("ai_literacy.general.ethics.compliance", "AI使用合规红线", "生成内容版权、数据安全、API Key管理、禁止滥用。", ["foundation", "ethics"]),
                        skill_node("ai_literacy.general.ethics.academic", "大学生AI学术规范", "作业论文中AI的正确使用方式，规避学术不端。", ["foundation", "ethics"]),
                    ],
                ),
                skill_node(
                    "ai_literacy.general.future",
                    "AI未来发展趋势与个人成长路径",
                    "建立AI时代的长期视角，明确个人成长方向。",
                    ["foundation", "future"],
                    [
                        skill_node("ai_literacy.general.future.trends", "AI技术演进方向", "从通用大模型到AI智能体、具身智能、数字生命。", ["foundation", "future"]),
                        skill_node("ai_literacy.general.future.career", "AI对未来职业的重塑", "可被替代的能力与不可替代的核心素养。", ["foundation", "future"]),
                        skill_node("ai_literacy.general.future.growth", "大一学生AI时代成长路径", "从入学开始构建AI核心竞争力。", ["foundation", "future"]),
                    ],
                ),
            ],
        ),
        # ──────────────────────────────────────────────────
        # 第二大部分：AI 素养 - 模块一：AI智能体必备工具与技术基础
        # ──────────────────────────────────────────────────
        skill_node(
            "ai_literacy.agent-tools",
            "AI智能体必备工具与技术基础",
            "零基础友好，全程非编程教学，从入门到实战循序渐进掌握AI智能体全流程落地。",
            ["agent-tools", "practical"],
            [
                skill_node(
                    "ai_literacy.agent-tools.markdown",
                    "AI交互核心语言：Markdown全掌握",
                    "用Markdown完成高质量Prompt编写和AI智能体指令文档撰写。",
                    ["practical", "markdown"],
                    [
                        skill_node("ai_literacy.agent-tools.markdown.syntax", "Markdown核心语法", "标题、列表、加粗斜体、代码块、表格、引用、链接。", ["practical", "markdown"]),
                        skill_node("ai_literacy.agent-tools.markdown.prompt", "结构化Prompt编写", "用Markdown编写结构化Prompt，精准控制AI输出质量。", ["practical", "markdown"]),
                        skill_node("ai_literacy.agent-tools.markdown.agent-doc", "AI智能体指令文档", "用Markdown编写AI智能体角色设定、任务指令文档。", ["practical", "markdown"]),
                    ],
                ),
                skill_node(
                    "ai_literacy.agent-tools.json",
                    "AI智能体核心数据格式：JSON与结构化数据",
                    "能独立看懂AI相关JSON文件，修改智能体核心配置参数。",
                    ["practical", "json"],
                    [
                        skill_node("ai_literacy.agent-tools.json.syntax", "JSON核心语法", "键值对、字符串、数字、布尔值、数组、对象。", ["practical", "json"]),
                        skill_node("ai_literacy.agent-tools.json.config", "智能体配置文件修改", "看懂并修改AI智能体的JSON配置文件。", ["practical", "json"]),
                        skill_node("ai_literacy.agent-tools.json.debug", "JSON格式排查", "常见报错（逗号、引号、括号问题）与快速排查。", ["practical", "json"]),
                    ],
                ),
                skill_node(
                    "ai_literacy.agent-tools.cli",
                    "终端/CLI命令行基础",
                    "消除对终端的畏惧感，能独立完成AI智能体运行所需的终端操作。",
                    ["practical", "cli"],
                    [
                        skill_node("ai_literacy.agent-tools.cli.basics", "终端界面与基础操作", "Windows/Mac/Linux终端认知与基础操作逻辑。", ["practical", "cli"]),
                        skill_node("ai_literacy.agent-tools.cli.commands", "AI场景必备命令", "目录切换、文件查看、进程启停、权限基础。", ["practical", "cli"]),
                        skill_node("ai_literacy.agent-tools.cli.troubleshoot", "终端常见报错排查", "路径错误、权限不足、命令不存在的解决方法。", ["practical", "cli"]),
                    ],
                ),
                skill_node(
                    "ai_literacy.agent-tools.runtime",
                    "AI智能体运行环境核心：Node.js与Python基础",
                    "能独立完成AI智能体所需的运行环境配置。",
                    ["practical", "runtime"],
                    [
                        skill_node("ai_literacy.agent-tools.runtime.nodejs", "Node.js零基础实操", "安装、版本查看、NPM核心命令。", ["practical", "runtime"]),
                        skill_node("ai_literacy.agent-tools.runtime.python", "Python零基础实操", "安装、版本查看、PIP核心命令与虚拟环境。", ["practical", "runtime"]),
                        skill_node("ai_literacy.agent-tools.runtime.env-vars", "环境变量与路径配置", "解决「命令不存在」的高频报错。", ["practical", "runtime"]),
                    ],
                ),
                skill_node(
                    "ai_literacy.agent-tools.git",
                    "Git与GitHub基础：开源AI智能体生态入门",
                    "能独立在GitHub上搜索、筛选、下载优质开源AI智能体项目。",
                    ["practical", "git"],
                    [
                        skill_node("ai_literacy.agent-tools.git.concepts", "Git/GitHub核心概念", "仓库、Fork、Clone、Release、README通俗解读。", ["practical", "git"]),
                        skill_node("ai_literacy.agent-tools.git.operations", "Git零基础实操", "安装、配置、clone、pull等AI项目下载必备操作。", ["practical", "git"]),
                        skill_node("ai_literacy.agent-tools.git.discovery", "GitHub项目搜索与甄别", "优质AI智能体的搜索、筛选、README阅读技巧。", ["practical", "git"]),
                    ],
                ),
                skill_node(
                    "ai_literacy.agent-tools.yaml",
                    "AI智能体配置核心：YAML/TOML与自动化脚本",
                    "能独立看懂、修改AI智能体的YAML/TOML配置文件。",
                    ["practical", "yaml"],
                    [
                        skill_node("ai_literacy.agent-tools.yaml.syntax", "YAML核心语法", "缩进规则、键值对、数组、注释与格式规范。", ["practical", "yaml"]),
                        skill_node("ai_literacy.agent-tools.yaml.config", "智能体YAML配置修改", "修改模型配置、插件规则、自动化触发条件。", ["practical", "yaml"]),
                        skill_node("ai_literacy.agent-tools.yaml.automation", "自动化脚本基础", "批处理/Shell脚本认知，一键启动与定时运行。", ["practical", "yaml"]),
                    ],
                ),
                skill_node(
                    "ai_literacy.agent-tools.api-docker",
                    "API与Docker基础：AI智能体进阶使用",
                    "能独立完成大模型API调用与Docker一键运行AI智能体。",
                    ["practical", "api", "docker"],
                    [
                        skill_node("ai_literacy.agent-tools.api-docker.api-basics", "API与API Key基础", "API通俗解读、密钥申请、安全管理与额度控制。", ["practical", "api"]),
                        skill_node("ai_literacy.agent-tools.api-docker.api-call", "大模型API调用实操", "API文档阅读、GET/POST请求、调用测试。", ["practical", "api"]),
                        skill_node("ai_literacy.agent-tools.api-docker.docker", "Docker容器零基础实操", "安装、pull、run、stop、logs等AI项目运行命令。", ["practical", "docker"]),
                    ],
                ),
                skill_node(
                    "ai_literacy.agent-tools.fullstack",
                    "AI智能体全流程落地综合实战",
                    "完全打通AI智能体使用的全流程，能独立完成落地运行与个性化定制。",
                    ["practical", "capstone"],
                    [
                        skill_node("ai_literacy.agent-tools.fullstack.workflow", "全流程闭环", "从选型、下载、环境配置、启动运行到功能测试的完整流程。", ["practical", "capstone"]),
                        skill_node("ai_literacy.agent-tools.fullstack.troubleshoot", "一站式问题排查", "环境、配置、网络、权限、API调用的排查思路。", ["practical", "capstone"]),
                        skill_node("ai_literacy.agent-tools.fullstack.customization", "个性化定制", "修改AI智能体角色、功能、自动化规则，打造专属智能体。", ["practical", "capstone"]),
                    ],
                ),
            ],
        ),
        # ──────────────────────────────────────────────────
        # 第二大部分：AI 素养 - 模块二：核心思维与价值认知
        # ──────────────────────────────────────────────────
        skill_node(
            "ai_literacy.mindset",
            "AI素养核心思维与价值认知",
            "建立AI时代正确的思维模式与价值认知，让技术能力有清晰的使用方向。",
            ["mindset", "values"],
            [
                skill_node(
                    "ai_literacy.mindset.tool-thinking",
                    "工具选择与AI原生思维",
                    "建立从搜索思维到AI原生思维的底层转变。",
                    ["mindset", "thinking"],
                    [
                        skill_node("ai_literacy.mindset.tool-thinking.selection", "工具选择思维", "顶级模型的价值认知，付费与免费工具的选择逻辑。", ["mindset", "thinking"]),
                        skill_node("ai_literacy.mindset.tool-thinking.native", "AI原生思维", "从搜索思维到实习生思维，培养「AI能帮我吗」的本能反应。", ["mindset", "thinking"]),
                        skill_node("ai_literacy.mindset.tool-thinking.automation", "自动化提效思维", "每周自动化一个重复任务的终身习惯培养。", ["mindset", "thinking"]),
                    ],
                ),
                skill_node(
                    "ai_literacy.mindset.critical",
                    "批判性思维与行动思维",
                    "警惕AI幻觉，建立行动优先的AI成长路径。",
                    ["mindset", "critical"],
                    [
                        skill_node("ai_literacy.mindset.critical.hallucination", "批判性思维", "警惕AI幻觉与虚假正反馈，AI内容的事实核查方法。", ["mindset", "critical"]),
                        skill_node("ai_literacy.mindset.critical.action", "行动优先思维", "拒绝完美主义，建立边做边学、在实践中迭代的成长路径。", ["mindset", "critical"]),
                        skill_node("ai_literacy.mindset.critical.creation", "AI创造思维", "AI时代创造门槛的降低，用小创造构建个人竞争力。", ["mindset", "critical"]),
                    ],
                ),
                skill_node(
                    "ai_literacy.mindset.moat",
                    "核心护城河与人文向善",
                    "构建不被AI替代的核心竞争力，坚守AI时代的人文底色。",
                    ["mindset", "values"],
                    [
                        skill_node("ai_literacy.mindset.moat.taste", "核心护城河思维", "AI无法替代的品味、审美与判断力。", ["mindset", "values"]),
                        skill_node("ai_literacy.mindset.moat.humanity", "人文向善思维", "技术的终极意义，把AI省下来的时间还给真实生活。", ["mindset", "values"]),
                        skill_node("ai_literacy.mindset.moat.competitiveness", "AI时代核心竞争力", "大学生如何用AI赋能个人长期成长。", ["mindset", "values"]),
                    ],
                ),
            ],
        ),
    ],
)


PROBABILITY_TREE = skill_node(
    "probability",
    "概率论学习路线",
    "从随机事件与概率空间到大数定律与中心极限定理，建立概率思维与随机分析能力。",
    ["math", "probability"],
    [
        skill_node(
            "probability.basics",
            "概率基础与随机事件",
            "理解样本空间、事件运算与概率公理。",
            ["foundation"],
            [
                skill_node("probability.basics.sample-space", "样本空间与事件", "掌握随机试验、样本空间和事件的概念。", ["foundation"]),
                skill_node("probability.basics.axioms", "概率公理与性质", "理解概率的三条公理与基本性质。", ["foundation"]),
                skill_node("probability.basics.classical", "古典概型与几何概型", "掌握等可能概型的计算方法。", ["foundation"]),
            ]
        ),
        skill_node(
            "probability.conditional",
            "条件概率与独立性",
            "掌握条件概率、全概率公式和贝叶斯公式。",
            ["conditional"],
            [
                skill_node("probability.conditional.definition", "条件概率", "理解条件概率的定义与乘法公式。", ["conditional"]),
                skill_node("probability.conditional.total-bayes", "全概率与贝叶斯公式", "掌握全概率公式与贝叶斯定理的应用。", ["conditional"]),
                skill_node("probability.conditional.independence", "事件独立性", "理解事件的独立性与相互独立性。", ["conditional"]),
            ]
        ),
        skill_node(
            "probability.random-variables",
            "随机变量与分布",
            "掌握离散与连续随机变量及其分布。",
            ["distribution"],
            [
                skill_node("probability.random-variables.discrete", "离散随机变量", "掌握二项分布、泊松分布等常见离散分布。", ["distribution"]),
                skill_node("probability.random-variables.continuous", "连续随机变量", "掌握均匀分布、指数分布、正态分布。", ["distribution"]),
                skill_node("probability.random-variables.cdf", "分布函数与密度函数", "理解 CDF 与 PDF 的关系与性质。", ["distribution"]),
            ]
        ),
        skill_node(
            "probability.characteristics",
            "数字特征",
            "掌握期望、方差、协方差与相关系数。",
            ["characteristics"],
            [
                skill_node("probability.characteristics.expectation", "数学期望", "掌握期望的计算与线性性质。", ["characteristics"]),
                skill_node("probability.characteristics.variance", "方差与标准差", "理解方差的计算与切比雪夫不等式。", ["characteristics"]),
                skill_node("probability.characteristics.covariance", "协方差与相关系数", "掌握随机变量间的相关性度量。", ["characteristics"]),
            ]
        ),
        skill_node(
            "probability.limit-theorems",
            "大数定律与中心极限定理",
            "理解概率论的两大极限定理及其应用。",
            ["limit-theorems"],
            [
                skill_node("probability.limit-theorems.lln", "大数定律", "掌握切比雪夫大数定律与辛钦大数定律。", ["limit-theorems"]),
                skill_node("probability.limit-theorems.clt", "中心极限定理", "理解独立同分布中心极限定理。", ["limit-theorems"]),
                skill_node("probability.limit-theorems.applications", "极限定理应用", "运用极限定理进行近似计算。", ["limit-theorems"]),
            ]
        ),
        skill_node(
            "probability.multivariate",
            "多维随机变量",
            "掌握多维随机变量的联合分布与边际分布。",
            ["multivariate"],
            [
                skill_node("probability.multivariate.joint", "联合分布", "掌握二维随机变量的联合分布。", ["multivariate"]),
                skill_node("probability.multivariate.marginal", "边际分布与条件分布", "理解边际分布与条件分布的关系。", ["multivariate"]),
                skill_node("probability.multivariate.functions", "随机变量函数的分布", "掌握随机变量函数分布的求法。", ["multivariate"]),
            ]
        ),
    ]
)


LINEAR_ALGEBRA_TREE = skill_node(
    "linear_algebra",
    "线性代数学习路线",
    "从行列式、矩阵到向量空间与特征值理论，建立线性思维与抽象代数能力。",
    ["math", "linear-algebra"],
    [
        skill_node(
            "linear_algebra.determinants",
            "行列式",
            "掌握行列式的定义、性质与计算方法。",
            ["determinants"],
            [
                skill_node("linear_algebra.determinants.definition", "行列式定义", "理解行列式的递归定义与展开。", ["determinants"]),
                skill_node("linear_algebra.determinants.properties", "行列式性质", "掌握行列式的行变换性质。", ["determinants"]),
                skill_node("linear_algebra.determinants.cramer", "克拉默法则", "运用行列式求解线性方程组。", ["determinants"]),
            ]
        ),
        skill_node(
            "linear_algebra.matrices",
            "矩阵及其运算",
            "掌握矩阵的基本运算与特殊矩阵。",
            ["matrices"],
            [
                skill_node("linear_algebra.matrices.operations", "矩阵运算", "掌握矩阵加法、乘法与转置。", ["matrices"]),
                skill_node("linear_algebra.matrices.inverse", "逆矩阵", "理解逆矩阵的求法与性质。", ["matrices"]),
                skill_node("linear_algebra.matrices.elementary", "初等变换与初等矩阵", "掌握初等行变换与矩阵的秩。", ["matrices"]),
            ]
        ),
        skill_node(
            "linear_algebra.linear-equations",
            "线性方程组",
            "掌握线性方程组的求解理论与方法。",
            ["equations"],
            [
                skill_node("linear_algebra.linear-equations.gauss", "高斯消元法", "掌握矩阵行变换求解方程组。", ["equations"]),
                skill_node("linear_algebra.linear-equations.solutions", "解的结构", "理解齐次与非齐次方程组的解结构。", ["equations"]),
                skill_node("linear_algebra.linear-equations.rank", "秩与可解性", "掌握秩判定方程组解的存在性与唯一性。", ["equations"]),
            ]
        ),
        skill_node(
            "linear_algebra.vector-spaces",
            "向量空间与线性变换",
            "掌握向量空间的基本理论与线性变换。",
            ["vector-spaces"],
            [
                skill_node("linear_algebra.vector-spaces.subspace", "向量空间与子空间", "理解向量空间的定义与子空间。", ["vector-spaces"]),
                skill_node("linear_algebra.vector-spaces.basis", "基与维数", "掌握基、维数与坐标变换。", ["vector-spaces"]),
                skill_node("linear_algebra.vector-spaces.transform", "线性变换", "理解线性变换与矩阵的对应关系。", ["vector-spaces"]),
            ]
        ),
        skill_node(
            "linear_algebra.eigenvalues",
            "特征值与特征向量",
            "掌握特征值问题与矩阵对角化。",
            ["eigenvalues"],
            [
                skill_node("linear_algebra.eigenvalues.computation", "特征值计算", "掌握特征方程与特征值的求法。", ["eigenvalues"]),
                skill_node("linear_algebra.eigenvalues.diagonalization", "矩阵对角化", "理解矩阵对角化的条件与方法。", ["eigenvalues"]),
                skill_node("linear_algebra.eigenvalues.applications", "特征值应用", "掌握特征值在矩阵幂与微分方程中的应用。", ["eigenvalues"]),
            ]
        ),
        skill_node(
            "linear_algebra.quadratic-forms",
            "二次型",
            "掌握二次型的标准化与正定性判定。",
            ["quadratic-forms"],
            [
                skill_node("linear_algebra.quadratic-forms.standard", "化标准形", "掌握配方法与正交变换化标准形。", ["quadratic-forms"]),
                skill_node("linear_algebra.quadratic-forms.positive-definite", "正定二次型", "理解正定矩阵的判定与性质。", ["quadratic-forms"]),
                skill_node("linear_algebra.quadratic-forms.applications", "二次型应用", "了解二次型在优化与几何中的应用。", ["quadratic-forms"]),
            ]
        ),
    ]
)


STATISTICS_TREE = skill_node(
    "statistics",
    "统计学学习路线",
    "从描述统计到推断统计与回归分析，建立数据分析与统计推断能力。",
    ["math", "statistics"],
    [
        skill_node(
            "statistics.descriptive",
            "描述统计",
            "掌握数据的收集、整理与描述方法。",
            ["descriptive"],
            [
                skill_node("statistics.descriptive.measures", "集中趋势与离散程度", "掌握均值、中位数、方差、标准差。", ["descriptive"]),
                skill_node("statistics.descriptive.visualization", "数据可视化", "理解直方图、箱线图与散点图。", ["descriptive"]),
                skill_node("statistics.descriptive.distribution", "数据分布形态", "掌握偏度、峰度与分布特征。", ["descriptive"]),
            ]
        ),
        skill_node(
            "statistics.sampling",
            "抽样分布",
            "掌握常见的抽样分布理论。",
            ["sampling"],
            [
                skill_node("statistics.sampling.methods", "抽样方法", "掌握简单随机抽样、分层抽样等方法。", ["sampling"]),
                skill_node("statistics.sampling.distributions", "三大抽样分布", "理解卡方分布、t分布与F分布。", ["sampling"]),
                skill_node("statistics.sampling.mean", "样本均值分布", "掌握样本均值的抽样分布理论。", ["sampling"]),
            ]
        ),
        skill_node(
            "statistics.estimation",
            "参数估计",
            "掌握点估计与区间估计方法。",
            ["estimation"],
            [
                skill_node("statistics.estimation.point", "点估计", "掌握矩估计与最大似然估计。", ["estimation"]),
                skill_node("statistics.estimation.interval", "区间估计", "理解置信区间的构造与含义。", ["estimation"]),
                skill_node("statistics.estimation.properties", "估计量性质", "掌握无偏性、有效性与一致性。", ["estimation"]),
            ]
        ),
        skill_node(
            "statistics.hypothesis",
            "假设检验",
            "掌握假设检验的基本思想与方法。",
            ["hypothesis"],
            [
                skill_node("statistics.hypothesis.concepts", "检验基本概念", "理解原假设、备择假设与两类错误。", ["hypothesis"]),
                skill_node("statistics.hypothesis.z-t-test", "Z检验与t检验", "掌握均值的假设检验方法。", ["hypothesis"]),
                skill_node("statistics.hypothesis.chi-square", "卡方检验", "掌握拟合优度检验与独立性检验。", ["hypothesis"]),
            ]
        ),
        skill_node(
            "statistics.regression",
            "回归分析",
            "掌握线性回归模型的建立与检验。",
            ["regression"],
            [
                skill_node("statistics.regression.simple", "一元线性回归", "掌握最小二乘法与回归系数检验。", ["regression"]),
                skill_node("statistics.regression.multiple", "多元线性回归", "理解多元回归模型与多重共线性。", ["regression"]),
                skill_node("statistics.regression.diagnostics", "回归诊断", "掌握残差分析与模型评价。", ["regression"]),
            ]
        ),
        skill_node(
            "statistics.anova",
            "方差分析",
            "掌握方差分析的原理与应用。",
            ["anova"],
            [
                skill_node("statistics.anova.one-way", "单因素方差分析", "掌握单因素 ANOVA 的计算与判断。", ["anova"]),
                skill_node("statistics.anova.two-way", "双因素方差分析", "理解交互效应与双因素模型。", ["anova"]),
                skill_node("statistics.anova.post-hoc", "多重比较", "掌握事后检验方法。", ["anova"]),
            ]
        ),
    ]
)


DEFAULT_SUBJECT_SKILL_MAPS: dict[str, dict[str, Any]] = {
    "python": PYTHON_TREE,
    "machine_learning": MACHINE_LEARNING_TREE,
    "advanced_math": ADVANCED_MATH_TREE,
    "probability": PROBABILITY_TREE,
    "linear_algebra": LINEAR_ALGEBRA_TREE,
    "statistics": STATISTICS_TREE,
    "ai_literacy": AI_LITERACY_TREE,
}

DEFAULT_SUBJECT_SKILL_MAP_VERSIONS: dict[str, int] = {
    "python": 2,
    "machine_learning": 2,
    "advanced_math": 1,
    "probability": 1,
    "linear_algebra": 1,
    "statistics": 1,
    "ai_literacy": 1,
}

