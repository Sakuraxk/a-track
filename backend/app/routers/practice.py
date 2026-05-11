from typing import Dict, List
import uuid
from uuid import UUID
import time

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, distinct, desc

from ..schemas.practice import (
    Exercise,
    ExerciseRecommendationResponse,
    ExerciseResultSubmission,
    ExerciseSubmissionResponse,
    Weakness,
    CodeExecutionRequest,
    CodeExecutionResponse,
)

from app.models.practice import ExerciseResult as ExerciseResultModel
from app.models.practice import Weakness as WeaknessModel
from ..services.recommendation_service import get_recommended_exercises, get_exercises_by_node
from ..services.ai_recommendation_service import AIRecommendationService
from ..core.database import get_db
from ..services.sandbox_service import sandbox

from app.models.subject import Attempt, UserExerciseProgress, ExerciseItem
from app.services.user_memory_service import UserMemoryService
from datetime import datetime, timezone
from app.models.base import utcnow_naive


router = APIRouter()


# ==================== 中文题库 ====================
# 分类：基础语法、变量与数据类型、条件语句、循环结构、列表与元组、字典与集合、函数、字符串处理、文件操作、异常处理

_EXERCISES: List[Exercise] = [
    # ==================== 基础语法 (difficulty: 1) ====================
    Exercise(
        id=uuid.UUID("10000001-0001-0001-0001-000000000001"),
        title="第一个Python程序",
        exercise_type="coding",
        difficulty=1,
        linked_nodes=["basics.print", "basics.syntax"],
        content={
            "prompt": """编写一个程序，输出以下内容：
Hello, Python!
我开始学习编程了！

要求：使用 print() 函数输出上述两行内容。""",
            "initial_code": "# 在这里编写你的代码\n\n",
            "expected_output": "Hello, Python!\n我开始学习编程了！\n",
            "hints": ["使用 print() 函数可以输出文本", "字符串需要用引号括起来"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000001-0001-0001-0001-000000000002"),
        title="变量的定义与使用",
        exercise_type="coding",
        difficulty=1,
        linked_nodes=["basics.variables", "basics.print"],
        content={
            "prompt": """创建一个变量 name，存储你的名字（用字符串表示），
然后创建一个变量 age，存储你的年龄（用整数表示），
最后输出格式如下：
我叫[名字]，今年[年龄]岁。

示例输出（假设名字是小明，年龄是18）：
我叫小明，今年18岁。""",
            "initial_code": "# 定义变量\nname = \nage = \n\n# 输出结果\nprint()",
            "hints": ["字符串用引号括起来，如 name = \"小明\"", "整数不需要引号，如 age = 18", "可以使用 f-string 格式化输出：f\"我叫{name}\""],
        },
    ),
    Exercise(
        id=uuid.UUID("10000001-0001-0001-0001-000000000003"),
        title="数据类型转换",
        exercise_type="coding",
        difficulty=1,
        linked_nodes=["basics.types", "basics.conversion"],
        content={
            "prompt": """给定一个字符串形式的数字 num_str = "42"，
请将其转换为整数，然后加上 8，
最后输出结果。

预期输出：50""",
            "initial_code": 'num_str = "42"\n\n# 将字符串转换为整数并计算\nresult = \n\n# 输出结果\nprint(result)',
            "expected_output": "50\n",
            "hints": ["使用 int() 函数可以将字符串转换为整数", "int(num_str) 会返回整数 42"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000001-0001-0001-0001-000000000004"),
        title="算术运算练习",
        exercise_type="coding",
        difficulty=1,
        linked_nodes=["basics.operators", "basics.arithmetic"],
        content={
            "prompt": """计算以下表达式的值并分别输出：
1. 17 除以 5 的商（整数除法）
2. 17 除以 5 的余数
3. 2 的 10 次方

每个结果占一行。

预期输出：
3
2
1024""",
            "initial_code": "# 整数除法使用 //\nprint()\n\n# 取余数使用 %\nprint()\n\n# 幂运算使用 **\nprint()",
            "expected_output": "3\n2\n1024\n",
            "hints": ["整数除法用 //，如 17 // 5 = 3", "取余数用 %，如 17 % 5 = 2", "幂运算用 **，如 2 ** 10 = 1024"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000001-0001-0001-0001-000000000005"),
        title="输入与输出",
        exercise_type="coding",
        difficulty=1,
        linked_nodes=["basics.input", "basics.print"],
        content={
            "prompt": """编写一个程序，完成以下任务：
1. 提示用户输入他们的城市名
2. 输出欢迎消息：欢迎来自[城市名]的朋友！

注意：由于自动测试，我们用固定输入模拟。
假设输入的城市是：北京

预期输出：
欢迎来自北京的朋友！""",
            "initial_code": '# 模拟用户输入\ncity = "北京"  # 实际应用中使用: city = input("请输入你的城市：")\n\n# 输出欢迎消息\nprint()',
            "expected_output": "欢迎来自北京的朋友！\n",
            "hints": ["使用 f-string 可以方便地在字符串中插入变量", "格式：f\"欢迎来自{city}的朋友！\""],
        },
    ),

    # ==================== 条件语句 (difficulty: 1-2) ====================
    Exercise(
        id=uuid.UUID("10000002-0002-0002-0002-000000000001"),
        title="判断奇偶数",
        exercise_type="coding",
        difficulty=1,
        linked_nodes=["conditions.if", "basics.operators"],
        content={
            "prompt": """编写一个程序，判断给定的数字是奇数还是偶数。

给定 number = 7，输出相应的判断结果。

预期输出：7是奇数""",
            "initial_code": "number = 7\n\n# 判断奇偶\nif :\n    print()\nelse:\n    print()",
            "expected_output": "7是奇数\n",
            "hints": ["偶数能被2整除，即 number % 2 == 0", "奇数除以2余数为1，即 number % 2 == 1"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000002-0002-0002-0002-000000000002"),
        title="成绩等级判断",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["conditions.if", "conditions.elif", "conditions.else"],
        content={
            "prompt": """根据分数判断成绩等级：
- 90分及以上：优秀
- 80-89分：良好
- 70-79分：中等
- 60-69分：及格
- 60分以下：不及格

给定 score = 85，输出对应的等级。

预期输出：良好""",
            "initial_code": "score = 85\n\n# 判断成绩等级\nif score >= 90:\n    print(\"优秀\")\nelif :\n    print()\n# 继续补充其他条件...",
            "expected_output": "良好\n",
            "hints": ["使用 elif 处理多个条件分支", "条件判断从高到低依次检查", "最后用 else 处理所有其他情况"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000002-0002-0002-0002-000000000003"),
        title="闰年判断",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["conditions.if", "conditions.logic"],
        content={
            "prompt": """判断给定年份是否为闰年。

闰年规则：
1. 能被4整除但不能被100整除的年份是闰年
2. 能被400整除的年份也是闰年

给定 year = 2024，判断是否为闰年。

预期输出：2024年是闰年""",
            "initial_code": "year = 2024\n\n# 判断闰年\nif :\n    print(f\"{year}年是闰年\")\nelse:\n    print(f\"{year}年不是闰年\")",
            "expected_output": "2024年是闰年\n",
            "hints": ["使用逻辑运算符 and 和 or 组合条件", "条件：(year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000002-0002-0002-0002-000000000004"),
        title="三角形判断",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["conditions.if", "conditions.logic"],
        content={
            "prompt": """给定三条边的长度，判断能否构成三角形。

三角形成立条件：任意两边之和大于第三边。

给定 a = 3, b = 4, c = 5

预期输出：可以构成三角形""",
            "initial_code": "a = 3\nb = 4\nc = 5\n\n# 判断是否能构成三角形\nif :\n    print(\"可以构成三角形\")\nelse:\n    print(\"不能构成三角形\")",
            "expected_output": "可以构成三角形\n",
            "hints": ["需要检查三个条件：a+b>c, a+c>b, b+c>a", "使用 and 连接三个条件"],
        },
    ),

    # ==================== 循环结构 (difficulty: 2-3) ====================
    Exercise(
        id=uuid.UUID("10000003-0003-0003-0003-000000000001"),
        title="for循环基础 - 数字求和",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["loops.for", "basics.range"],
        content={
            "prompt": """使用 for 循环计算 1 到 100 的整数之和。

预期输出：5050""",
            "initial_code": "total = 0\n\n# 使用 for 循环\nfor i in range():\n    total += i\n\nprint(total)",
            "expected_output": "5050\n",
            "hints": ["range(1, 101) 生成 1 到 100 的数字", "注意 range 的结束值是不包含的"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000003-0003-0003-0003-000000000002"),
        title="while循环 - 猜数字逻辑",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["loops.while", "conditions.if"],
        content={
            "prompt": """模拟一个简化的猜数字游戏逻辑：
目标数字是 7，从 1 开始猜，每次加 1，直到猜中为止。
输出猜了多少次。

预期输出：猜了7次""",
            "initial_code": "target = 7\nguess = 1\ncount = 0\n\nwhile guess != target:\n    count += 1\n    guess += 1\n\n# 最后猜中时也要计数\ncount += 1\n\nprint(f\"猜了{count}次\")",
            "expected_output": "猜了7次\n",
            "hints": ["while 循环在条件为 True 时持续执行", "不要忘记最后猜中的那一次"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000003-0003-0003-0003-000000000003"),
        title="九九乘法表",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["loops.for", "loops.nested"],
        content={
            "prompt": """使用嵌套循环打印九九乘法表的前三行。

预期输出：
1x1=1
1x2=2 2x2=4
1x3=3 2x3=6 3x3=9""",
            "initial_code": "for i in range(1, 4):  # 只打印前3行\n    for j in range(1, i + 1):\n        # 打印每个乘法表达式，用空格分隔\n        print(f\"{j}x{i}={i*j}\", end=\" \")\n    print()  # 换行",
            "expected_output": "1x1=1 \n1x2=2 2x2=4 \n1x3=3 2x3=6 3x3=9 \n",
            "hints": ["外层循环控制行数", "内层循环控制每行打印的个数", "end=\" \" 让 print 不换行"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000003-0003-0003-0003-000000000004"),
        title="找出质数",
        exercise_type="coding",
        difficulty=3,
        linked_nodes=["loops.for", "loops.break", "conditions.if"],
        content={
            "prompt": """找出 2 到 20 之间的所有质数，并用逗号分隔输出。

质数：只能被 1 和它自身整除的大于 1 的自然数。

预期输出：2, 3, 5, 7, 11, 13, 17, 19""",
            "initial_code": "primes = []\n\nfor num in range(2, 21):\n    is_prime = True\n    for i in range(2, num):\n        if num % i == 0:\n            is_prime = False\n            break\n    if is_prime:\n        primes.append(num)\n\nprint(\", \".join(map(str, primes)))",
            "expected_output": "2, 3, 5, 7, 11, 13, 17, 19\n",
            "hints": ["对每个数，检查是否能被比它小的数整除", "如果找到一个因子，就不是质数", "使用 break 提前退出循环"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000003-0003-0003-0003-000000000005"),
        title="斐波那契数列",
        exercise_type="coding",
        difficulty=3,
        linked_nodes=["loops.for", "basics.variables"],
        content={
            "prompt": """输出斐波那契数列的前 10 个数字，用空格分隔。

斐波那契数列：每个数是前两个数之和，起始为 0, 1。

预期输出：0 1 1 2 3 5 8 13 21 34""",
            "initial_code": "a, b = 0, 1\nresult = []\n\nfor _ in range(10):\n    result.append(a)\n    a, b = b, a + b\n\nprint(\" \".join(map(str, result)))",
            "expected_output": "0 1 1 2 3 5 8 13 21 34\n",
            "hints": ["使用两个变量存储前两个数", "Python 支持同时赋值：a, b = b, a + b"],
        },
    ),

    # ==================== 列表与元组 (difficulty: 2-3) ====================
    Exercise(
        id=uuid.UUID("10000004-0004-0004-0004-000000000001"),
        title="列表基本操作",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["lists.create", "lists.methods"],
        content={
            "prompt": """创建一个包含 1, 2, 3 的列表，然后：
1. 在末尾添加数字 4
2. 在开头插入数字 0
3. 输出最终列表

预期输出：[0, 1, 2, 3, 4]""",
            "initial_code": "# 创建列表\nnumbers = [1, 2, 3]\n\n# 在末尾添加 4\n\n# 在开头插入 0\n\n# 输出列表\nprint(numbers)",
            "expected_output": "[0, 1, 2, 3, 4]\n",
            "hints": ["append() 在末尾添加元素", "insert(0, 元素) 在指定位置插入"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000004-0004-0004-0004-000000000002"),
        title="列表切片",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["lists.slice", "lists.index"],
        content={
            "prompt": """给定列表 numbers = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

分别输出：
1. 前三个元素
2. 最后三个元素
3. 索引 2 到 6（不含）的元素

每个结果占一行。""",
            "initial_code": "numbers = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]\n\n# 前三个元素\nprint(numbers[:3])\n\n# 最后三个元素\nprint()\n\n# 索引 2 到 6（不含）\nprint()",
            "expected_output": "[10, 20, 30]\n[80, 90, 100]\n[30, 40, 50, 60]\n",
            "hints": ["切片语法：list[start:end]", "负数索引从末尾开始：list[-3:]"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000004-0004-0004-0004-000000000003"),
        title="列表推导式",
        exercise_type="coding",
        difficulty=3,
        linked_nodes=["lists.comprehension", "loops.for"],
        content={
            "prompt": """使用列表推导式完成以下任务：
1. 创建一个包含 1 到 10 的平方的列表
2. 输出该列表

预期输出：[1, 4, 9, 16, 25, 36, 49, 64, 81, 100]""",
            "initial_code": "# 使用列表推导式创建平方列表\nsquares = []\n\nprint(squares)",
            "expected_output": "[1, 4, 9, 16, 25, 36, 49, 64, 81, 100]\n",
            "hints": ["列表推导式格式：[表达式 for 变量 in 序列]", "示例：[x**2 for x in range(1, 11)]"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000004-0004-0004-0004-000000000004"),
        title="列表排序与统计",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["lists.sort", "lists.methods"],
        content={
            "prompt": """给定列表 scores = [85, 92, 78, 90, 88, 76, 95, 89]

依次输出：
1. 最高分
2. 最低分
3. 平均分（保留一位小数）
4. 排序后的列表（从高到低）""",
            "initial_code": "scores = [85, 92, 78, 90, 88, 76, 95, 89]\n\n# 最高分\nprint(max(scores))\n\n# 最低分\nprint()\n\n# 平均分\nprint()\n\n# 从高到低排序\nprint()",
            "expected_output": "95\n76\n86.6\n[95, 92, 90, 89, 88, 85, 78, 76]\n",
            "hints": ["max() 和 min() 获取最大最小值", "sum()/len() 计算平均值", "sorted(list, reverse=True) 降序排序"],
        },
    ),

    # ==================== 字典与集合 (difficulty: 2-3) ====================
    Exercise(
        id=uuid.UUID("10000005-0005-0005-0005-000000000001"),
        title="字典基本操作",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["dicts.create", "dicts.methods"],
        content={
            "prompt": """创建一个存储学生信息的字典，包含：
- name: "小明"
- age: 18
- grade: "高三"

然后：
1. 添加一个新键 score，值为 95
2. 输出完整字典""",
            "initial_code": "# 创建字典\nstudent = {\n    \"name\": \"小明\",\n    \"age\": 18,\n    \"grade\": \"高三\"\n}\n\n# 添加 score\n\n# 输出\nprint(student)",
            "expected_output": "{'name': '小明', 'age': 18, 'grade': '高三', 'score': 95}\n",
            "hints": ["添加键值对：dict[key] = value", "字典的键需要用引号括起来（如果是字符串）"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000005-0005-0005-0005-000000000002"),
        title="遍历字典",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["dicts.iterate", "loops.for"],
        content={
            "prompt": """给定字典 fruit_prices = {"苹果": 5.5, "香蕉": 3.0, "橙子": 4.5}

遍历字典，输出格式如下：
苹果: 5.5元
香蕉: 3.0元
橙子: 4.5元""",
            "initial_code": 'fruit_prices = {"苹果": 5.5, "香蕉": 3.0, "橙子": 4.5}\n\n# 遍历字典\nfor fruit, price in fruit_prices.items():\n    print(f"{fruit}: {price}元")',
            "expected_output": "苹果: 5.5元\n香蕉: 3.0元\n橙子: 4.5元\n",
            "hints": [".items() 返回键值对", "可以同时解包为两个变量"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000005-0005-0005-0005-000000000003"),
        title="集合操作",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["sets.create", "sets.operations"],
        content={
            "prompt": """给定两个集合：
set_a = {1, 2, 3, 4, 5}
set_b = {4, 5, 6, 7, 8}

依次输出：
1. 并集
2. 交集
3. set_a 中有但 set_b 中没有的元素（差集）""",
            "initial_code": "set_a = {1, 2, 3, 4, 5}\nset_b = {4, 5, 6, 7, 8}\n\n# 并集\nprint(set_a | set_b)\n\n# 交集\nprint()\n\n# 差集\nprint()",
            "expected_output": "{1, 2, 3, 4, 5, 6, 7, 8}\n{4, 5}\n{1, 2, 3}\n",
            "hints": ["并集用 | 或 union()", "交集用 & 或 intersection()", "差集用 - 或 difference()"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000005-0005-0005-0005-000000000004"),
        title="词频统计",
        exercise_type="coding",
        difficulty=3,
        linked_nodes=["dicts.create", "loops.for", "strings.split"],
        content={
            "prompt": """统计字符串中每个单词出现的次数。

给定：text = "apple banana apple orange banana apple"

输出每个单词的出现次数，格式如下：
apple: 3
banana: 2
orange: 1""",
            "initial_code": 'text = "apple banana apple orange banana apple"\n\n# 统计词频\nword_count = {}\nwords = text.split()\n\nfor word in words:\n    if word in word_count:\n        word_count[word] += 1\n    else:\n        word_count[word] = 1\n\n# 输出结果\nfor word, count in word_count.items():\n    print(f"{word}: {count}")',
            "expected_output": "apple: 3\nbanana: 2\norange: 1\n",
            "hints": ["split() 将字符串按空格分割成列表", "使用字典统计每个单词的出现次数"],
        },
    ),

    # ==================== 函数 (difficulty: 2-4) ====================
    Exercise(
        id=uuid.UUID("10000006-0006-0006-0006-000000000001"),
        title="定义简单函数",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["functions.def", "functions.return"],
        content={
            "prompt": """定义一个函数 greet(name)，接收一个名字参数，返回问候语。

示例：greet("小明") 应返回 "你好，小明！"

然后调用函数并输出结果。""",
            "initial_code": "def greet(name):\n    # 返回问候语\n    pass\n\n# 调用函数\nresult = greet(\"小明\")\nprint(result)",
            "expected_output": "你好，小明！\n",
            "hints": ["使用 return 返回值", "字符串拼接可用 f-string"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000006-0006-0006-0006-000000000002"),
        title="带默认参数的函数",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["functions.def", "functions.params"],
        content={
            "prompt": """定义一个计算商品价格的函数 calculate_price(price, discount=1.0)
- price: 原价
- discount: 折扣（默认为1.0，即不打折）
- 返回：折后价格

然后调用：
1. calculate_price(100) - 不打折
2. calculate_price(100, 0.8) - 八折

分别输出结果。""",
            "initial_code": "def calculate_price(price, discount=1.0):\n    # 计算折后价格\n    pass\n\n# 不打折\nprint(calculate_price(100))\n\n# 八折\nprint(calculate_price(100, 0.8))",
            "expected_output": "100.0\n80.0\n",
            "hints": ["默认参数在参数名后加 =默认值", "折后价 = 原价 × 折扣"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000006-0006-0006-0006-000000000003"),
        title="递归函数 - 阶乘",
        exercise_type="coding",
        difficulty=3,
        linked_nodes=["functions.recursion", "functions.def"],
        content={
            "prompt": """使用递归实现阶乘函数 factorial(n)。

阶乘定义：n! = n × (n-1) × ... × 2 × 1
特殊情况：0! = 1

输出 5 的阶乘结果。

预期输出：120""",
            "initial_code": "def factorial(n):\n    # 基本情况\n    if n <= 1:\n        return 1\n    # 递归情况\n    return n * factorial(n - 1)\n\nprint(factorial(5))",
            "expected_output": "120\n",
            "hints": ["递归函数必须有基本情况（终止条件）", "5! = 5 × 4! = 5 × 4 × 3! = ..."],
        },
    ),
    Exercise(
        id=uuid.UUID("10000006-0006-0006-0006-000000000004"),
        title="返回多个值",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["functions.return", "basics.tuple"],
        content={
            "prompt": """定义函数 get_stats(numbers)，接收一个数字列表，返回最大值、最小值和平均值。

给定 [10, 20, 30, 40, 50]，输出三个统计值。

预期输出：
最大值: 50
最小值: 10
平均值: 30.0""",
            "initial_code": "def get_stats(numbers):\n    max_val = max(numbers)\n    min_val = min(numbers)\n    avg_val = sum(numbers) / len(numbers)\n    return max_val, min_val, avg_val\n\nmax_v, min_v, avg_v = get_stats([10, 20, 30, 40, 50])\nprint(f\"最大值: {max_v}\")\nprint(f\"最小值: {min_v}\")\nprint(f\"平均值: {avg_v}\")",
            "expected_output": "最大值: 50\n最小值: 10\n平均值: 30.0\n",
            "hints": ["函数可以返回多个值，用逗号分隔", "调用时可以用多个变量接收"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000006-0006-0006-0006-000000000005"),
        title="Lambda表达式",
        exercise_type="coding",
        difficulty=3,
        linked_nodes=["functions.lambda", "lists.sort"],
        content={
            "prompt": """给定学生列表：
students = [("小明", 85), ("小红", 92), ("小刚", 78)]

使用 lambda 表达式按成绩从高到低排序，并输出排序后的列表。

预期输出：[('小红', 92), ('小明', 85), ('小刚', 78)]""",
            "initial_code": 'students = [("小明", 85), ("小红", 92), ("小刚", 78)]\n\n# 按成绩排序\nsorted_students = sorted(students, key=lambda x: x[1], reverse=True)\n\nprint(sorted_students)',
            "expected_output": "[('小红', 92), ('小明', 85), ('小刚', 78)]\n",
            "hints": ["lambda x: x[1] 获取元组的第二个元素", "reverse=True 表示降序"],
        },
    ),

    # ==================== 字符串处理 (difficulty: 2-3) ====================
    Exercise(
        id=uuid.UUID("10000007-0007-0007-0007-000000000001"),
        title="字符串方法",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["strings.methods", "strings.format"],
        content={
            "prompt": """给定字符串 text = "  Hello, Python World!  "

依次输出：
1. 去除首尾空格后的字符串
2. 全部转为小写
3. 全部转为大写
4. 将 "Python" 替换为 "Java" """,
            "initial_code": 'text = "  Hello, Python World!  "\n\n# 去除空格\nprint(text.strip())\n\n# 转小写\nprint(text.strip().lower())\n\n# 转大写\nprint(text.strip().upper())\n\n# 替换\nprint(text.strip().replace("Python", "Java"))',
            "expected_output": "Hello, Python World!\nhello, python world!\nHELLO, PYTHON WORLD!\nHello, Java World!\n",
            "hints": ["strip() 去除首尾空格", "lower() 转小写，upper() 转大写", "replace(old, new) 替换子串"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000007-0007-0007-0007-000000000002"),
        title="字符串分割与连接",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["strings.split", "strings.join"],
        content={
            "prompt": """给定字符串 path = "home/user/documents/file.txt"

1. 按 "/" 分割成列表并输出
2. 将分割后的列表用 " -> " 连接并输出""",
            "initial_code": 'path = "home/user/documents/file.txt"\n\n# 分割\nparts = path.split("/")\nprint(parts)\n\n# 连接\nprint(" -> ".join(parts))',
            "expected_output": "['home', 'user', 'documents', 'file.txt']\nhome -> user -> documents -> file.txt\n",
            "hints": ["split(分隔符) 分割字符串", "分隔符.join(列表) 连接列表"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000007-0007-0007-0007-000000000003"),
        title="字符串查找",
        exercise_type="coding",
        difficulty=2,
        linked_nodes=["strings.find", "strings.index"],
        content={
            "prompt": """给定字符串 sentence = "Python是一门优秀的编程语言，Python很容易学习"

1. 查找 "Python" 第一次出现的位置
2. 查找 "Python" 最后一次出现的位置
3. 统计 "Python" 出现的次数""",
            "initial_code": 'sentence = "Python是一门优秀的编程语言，Python很容易学习"\n\n# 第一次出现位置\nprint(sentence.find("Python"))\n\n# 最后一次出现位置\nprint(sentence.rfind("Python"))\n\n# 出现次数\nprint(sentence.count("Python"))',
            "expected_output": "0\n16\n2\n",
            "hints": ["find() 返回第一次出现的索引", "rfind() 返回最后一次出现的索引", "count() 统计出现次数"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000007-0007-0007-0007-000000000004"),
        title="回文判断",
        exercise_type="coding",
        difficulty=3,
        linked_nodes=["strings.slice", "conditions.if"],
        content={
            "prompt": """判断一个字符串是否为回文（正读反读都一样）。

给定 word = "level"，判断是否为回文。

预期输出：level 是回文""",
            "initial_code": 'word = "level"\n\n# 判断回文\nif word == word[::-1]:\n    print(f"{word} 是回文")\nelse:\n    print(f"{word} 不是回文")',
            "expected_output": "level 是回文\n",
            "hints": ["字符串[::-1] 可以反转字符串", "比较原字符串和反转后的字符串"],
        },
    ),

    # ==================== 异常处理 (difficulty: 3) ====================
    Exercise(
        id=uuid.UUID("10000008-0008-0008-0008-000000000001"),
        title="基本异常处理",
        exercise_type="coding",
        difficulty=3,
        linked_nodes=["exceptions.try", "exceptions.except"],
        content={
            "prompt": """编写一个安全的除法函数 safe_divide(a, b)：
- 正常情况返回 a / b
- 如果除数为 0，返回 "错误：除数不能为零"

测试：
1. safe_divide(10, 2)
2. safe_divide(10, 0)""",
            "initial_code": "def safe_divide(a, b):\n    try:\n        return a / b\n    except ZeroDivisionError:\n        return \"错误：除数不能为零\"\n\nprint(safe_divide(10, 2))\nprint(safe_divide(10, 0))",
            "expected_output": "5.0\n错误：除数不能为零\n",
            "hints": ["使用 try-except 捕获异常", "ZeroDivisionError 是除零异常"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000008-0008-0008-0008-000000000002"),
        title="多种异常处理",
        exercise_type="coding",
        difficulty=3,
        linked_nodes=["exceptions.try", "exceptions.multiple"],
        content={
            "prompt": """编写函数 convert_to_int(value)：
- 尝试将 value 转换为整数并返回
- 如果是 None，返回 "错误：输入为空"
- 如果无法转换，返回 "错误：无法转换"

测试三种情况。""",
            "initial_code": 'def convert_to_int(value):\n    try:\n        if value is None:\n            raise ValueError("输入为空")\n        return int(value)\n    except TypeError:\n        return "错误：输入为空"\n    except ValueError:\n        return "错误：无法转换"\n\nprint(convert_to_int("42"))\nprint(convert_to_int(None))\nprint(convert_to_int("abc"))',
            "expected_output": "42\n错误：无法转换\n错误：无法转换\n",
            "hints": ["可以捕获多种类型的异常", "可以使用 raise 主动抛出异常"],
        },
    ),

    # ==================== 综合练习 (difficulty: 4-5) ====================
    Exercise(
        id=uuid.UUID("10000009-0009-0009-0009-000000000001"),
        title="学生成绩管理系统",
        exercise_type="coding",
        difficulty=4,
        linked_nodes=["dicts.create", "functions.def", "loops.for"],
        content={
            "prompt": """创建一个简单的成绩管理系统：

1. 定义学生成绩字典
2. 实现函数 add_student(name, score) - 添加学生
3. 实现函数 get_average() - 计算平均分
4. 实现函数 get_top_student() - 获取最高分学生

初始数据：小明:85, 小红:92, 小刚:78

输出：
- 添加小华(88分)后的平均分
- 最高分学生姓名和分数""",
            "initial_code": '# 学生成绩字典\nstudents = {"小明": 85, "小红": 92, "小刚": 78}\n\ndef add_student(name, score):\n    students[name] = score\n\ndef get_average():\n    return sum(students.values()) / len(students)\n\ndef get_top_student():\n    top_name = max(students, key=students.get)\n    return top_name, students[top_name]\n\n# 添加学生\nadd_student("小华", 88)\nprint(f"平均分: {get_average():.1f}")\n\n# 获取最高分\nname, score = get_top_student()\nprint(f"最高分: {name} ({score}分)")',
            "expected_output": "平均分: 85.8\n最高分: 小红 (92分)\n",
            "hints": ["使用字典存储学生成绩", "max(dict, key=dict.get) 获取值最大的键"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000009-0009-0009-0009-000000000002"),
        title="简易计算器",
        exercise_type="coding",
        difficulty=4,
        linked_nodes=["functions.def", "conditions.if", "exceptions.try"],
        content={
            "prompt": """实现一个简易计算器函数 calculate(a, op, b)：
- 支持加(+)、减(-)、乘(*)、除(/)四种运算
- 除法要处理除零错误
- 不支持的运算符返回错误信息

测试：
calculate(10, '+', 5) → 15
calculate(10, '/', 0) → 错误：除数不能为零
calculate(10, '^', 2) → 错误：不支持的运算符""",
            "initial_code": '''def calculate(a, op, b):
    try:
        if op == '+':
            return a + b
        elif op == '-':
            return a - b
        elif op == '*':
            return a * b
        elif op == '/':
            if b == 0:
                return "错误：除数不能为零"
            return a / b
        else:
            return "错误：不支持的运算符"
    except Exception as e:
        return f"错误：{str(e)}"

print(calculate(10, '+', 5))
print(calculate(10, '/', 0))
print(calculate(10, '^', 2))''',
            "expected_output": "15\n错误：除数不能为零\n错误：不支持的运算符\n",
            "hints": ["使用 if-elif-else 判断运算符", "提前检查除零情况"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000009-0009-0009-0009-000000000003"),
        title="文本分析器",
        exercise_type="coding",
        difficulty=4,
        linked_nodes=["strings.methods", "dicts.create", "functions.def"],
        content={
            "prompt": """实现文本分析函数 analyze_text(text)，返回：
- 字符数（不含空格）
- 单词数
- 句子数（以.!?结尾）

测试文本："Hello World! How are you? I am fine."

输出格式：
字符数: X
单词数: X
句子数: X""",
            "initial_code": '''def analyze_text(text):
    # 字符数（不含空格）
    char_count = len(text.replace(" ", ""))

    # 单词数
    word_count = len(text.split())

    # 句子数
    sentence_count = text.count('.') + text.count('!') + text.count('?')

    return char_count, word_count, sentence_count

text = "Hello World! How are you? I am fine."
chars, words, sentences = analyze_text(text)
print(f"字符数: {chars}")
print(f"单词数: {words}")
print(f"句子数: {sentences}")''',
            "expected_output": "字符数: 30\n单词数: 8\n句子数: 3\n",
            "hints": ["replace() 替换空格后计算长度", "split() 分割单词", "count() 统计标点符号"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000009-0009-0009-0009-000000000004"),
        title="猜数字游戏模拟",
        exercise_type="coding",
        difficulty=4,
        linked_nodes=["loops.while", "conditions.if", "functions.def"],
        content={
            "prompt": """模拟一个猜数字游戏：
- 目标数字是 42
- 从给定的猜测序列 [20, 50, 30, 45, 40, 42] 中依次猜测
- 每次猜测后提示"太小"、"太大"或"猜对了"
- 统计猜测次数

输出每次猜测的提示和最终结果。""",
            "initial_code": '''target = 42
guesses = [20, 50, 30, 45, 40, 42]
count = 0

for guess in guesses:
    count += 1
    if guess < target:
        print(f"猜测 {guess}: 太小了")
    elif guess > target:
        print(f"猜测 {guess}: 太大了")
    else:
        print(f"猜测 {guess}: 猜对了！")
        break

print(f"共猜了 {count} 次")''',
            "expected_output": "猜测 20: 太小了\n猜测 50: 太大了\n猜测 30: 太小了\n猜测 45: 太大了\n猜测 40: 太小了\n猜测 42: 猜对了！\n共猜了 6 次\n",
            "hints": ["使用循环遍历猜测", "使用 break 在猜对后退出"],
        },
    ),
    Exercise(
        id=uuid.UUID("10000009-0009-0009-0009-000000000005"),
        title="购物车系统",
        exercise_type="coding",
        difficulty=5,
        linked_nodes=["dicts.create", "functions.def", "lists.methods"],
        content={
            "prompt": """实现一个简单的购物车系统：

商品价格：苹果:5元，香蕉:3元，橙子:4元

功能：
1. add_item(item, quantity) - 添加商品
2. remove_item(item) - 移除商品
3. get_total() - 计算总价
4. show_cart() - 显示购物车

操作序列：
添加 苹果x3，香蕉x2，橙子x1
移除 香蕉
显示购物车和总价""",
            "initial_code": '''# 商品价格
prices = {"苹果": 5, "香蕉": 3, "橙子": 4}
# 购物车
cart = {}

def add_item(item, quantity):
    if item in cart:
        cart[item] += quantity
    else:
        cart[item] = quantity

def remove_item(item):
    if item in cart:
        del cart[item]

def get_total():
    total = 0
    for item, quantity in cart.items():
        total += prices[item] * quantity
    return total

def show_cart():
    print("购物车内容：")
    for item, quantity in cart.items():
        print(f"  {item} x {quantity} = {prices[item] * quantity}元")
    print(f"总计：{get_total()}元")

# 添加商品
add_item("苹果", 3)
add_item("香蕉", 2)
add_item("橙子", 1)

# 移除香蕉
remove_item("香蕉")

# 显示购物车
show_cart()''',
            "expected_output": "购物车内容：\n  苹果 x 3 = 15元\n  橙子 x 1 = 4元\n总计：19元\n",
            "hints": ["使用字典存储购物车", "计算总价时遍历购物车"],
        },
    ),
]


@router.get("/exercises", response_model=List[Exercise], summary="获取所有练习题")
async def list_exercises(
    difficulty: Optional[int] = Query(None, ge=1, le=5, description="按难度筛选"),
    node: Optional[str] = Query(None, description="按知识点筛选"),
    subject_key: Optional[str] = Query(None, description="按学科筛选"),
) -> List[Exercise]:
    """获取所有练习题，支持按难度、知识点和学科筛选"""
    result = _EXERCISES

    if subject_key is not None:
        result = [e for e in result if e.subject_key == subject_key]

    if difficulty is not None:
        result = [e for e in result if e.difficulty == difficulty]

    if node is not None:
        result = get_exercises_by_node(result, node)

    return result


@router.get("/exercises/{exercise_id}", response_model=Exercise)
async def get_exercise(
    exercise_id: UUID, 
    db: AsyncSession = Depends(get_db)
) -> Exercise:
    # 1. 尝试从静态列表中查找
    for exercise in _EXERCISES:
        if exercise.id == exercise_id:
            return exercise
            
    # 2. 尝试从数据库中查找
    stmt = select(ExerciseItem).where(ExerciseItem.id == exercise_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    
    if item:
        # 转换为 Pydantic 模型
        return Exercise(
            id=item.id,
            title=item.stem[:30] + "..." if len(item.stem) > 30 else item.stem,
            exercise_type=item.item_type,
            difficulty=item.difficulty,
            linked_nodes=item.tags if item.tags else [],
            content={
                "prompt": item.stem,
                "options": item.options,
                "answer_key": item.answer_key,
                "hints": item.hints,
                "initial_code": item.initial_code,
                "expected_output": item.expected_output,
                "test_cases": item.test_cases
            }
        )
        
    raise HTTPException(status_code=404, detail="Exercise not found")


@router.get("/recommendations", response_model=ExerciseRecommendationResponse, summary="智能推荐练习题")
async def recommend(
    user_id: UUID,
    ability_tags: Optional[str] = Query(None, description="能力标签JSON，如 {\"循环\":60,\"函数\":75}"),
    limit: int = Query(5, ge=1, le=20, description="返回题目数量"),
    use_ai: bool = Query(True, description="是否使用AI推荐（需要配置LLM）"),
    db: AsyncSession = Depends(get_db)
) -> ExerciseRecommendationResponse:
    """
    根据用户能力水平智能推荐练习题

    推荐算法考虑：
    - 用户整体能力水平 → 匹配合适难度
    - 用户薄弱项 → 优先推荐相关题目
    - 能力标签 → 强化低分能力

    如果 use_ai=True 且用户配置了LLM，将使用AI进行个性化推荐。
    否则使用静态推荐算法。
    """
    import json

    # 解析能力标签
    parsed_abilities: Dict[str, float] = {}
    if ability_tags:
        try:
            parsed_abilities = json.loads(ability_tags)
        except json.JSONDecodeError:
            pass

    # 获取用户薄弱项
    user_weaknesses: Dict[str, int] = {}
    weakness_stmt = (
        select(WeaknessModel)
        .where(WeaknessModel.user_id == user_id)
        .order_by(WeaknessModel.count.desc())
        .limit(50)
    )
    weakness_result = await db.execute(weakness_stmt)
    for w in weakness_result.scalars().all():
        if w.error_tag:
            user_weaknesses[w.error_tag] = int(w.count or 0)

    # 尝试使用AI推荐
    if use_ai:
        ai_service = AIRecommendationService(db)
        recommended, rationale = await ai_service.get_ai_recommendations(
            user_id=str(user_id),
            exercises=_EXERCISES,
            ability_tags=parsed_abilities,
            weaknesses=user_weaknesses,
            limit=limit
        )
    else:
        # 使用静态推荐算法
        recommended, rationale = get_recommended_exercises(
            exercises=_EXERCISES,
            ability_tags=parsed_abilities,
            weaknesses=user_weaknesses,
            limit=limit
        )

    return ExerciseRecommendationResponse(items=recommended, rationale=rationale)


def _normalize_output_for_compare(text: str) -> str:
    # 统一换行与尾随空白，避免不同平台/print 行尾差异导致误判
    normalized = (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    return "\n".join(line.rstrip() for line in normalized.split("\n")).strip()


async def _upsert_weakness(
    db: AsyncSession,
    user_id: UUID,
    error_tag: str,
) -> None:
    node_code = (error_tag or "generic").split(".")[0] if error_tag else "generic"
    stmt = select(WeaknessModel).where(
        and_(
            WeaknessModel.user_id == user_id,
            WeaknessModel.error_tag == error_tag,
        )
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    if record is None:
        record = WeaknessModel(
            user_id=user_id,
            node_code=node_code,
            error_tag=error_tag,
            count=1,
        )
        db.add(record)
    else:
        record.count = int(record.count or 0) + 1
    await db.flush()


@router.post("/results", response_model=ExerciseSubmissionResponse, summary="提交练习结果（判题+落库）")
async def submit_result(
    user_id: UUID,
    payload: ExerciseResultSubmission,
    db: AsyncSession = Depends(get_db),
) -> ExerciseSubmissionResponse:
    # 1) 找题目（用于拿 expected_output/linked_nodes）
    exercise = None
    for ex in _EXERCISES:
        if ex.id == payload.exercise_id:
            exercise = ex
            break
            
    if exercise is None:
        # 尝试从数据库查找
        stmt = select(ExerciseItem).where(ExerciseItem.id == payload.exercise_id)
        res = await db.execute(stmt)
        item = res.scalar_one_or_none()
        if item:
            # 兼容模型
            exercise = Exercise(
                id=item.id,
                title=item.stem[:30],
                exercise_type=item.item_type,
                difficulty=item.difficulty,
                linked_nodes=item.tags if item.tags else [],
                content={
                    "prompt": item.stem,
                    "expected_output": item.expected_output,
                    "initial_code": item.initial_code,
                    "hints": item.hints
                }
            )

    expected_output = None
    if exercise and isinstance(exercise.content, dict):
        expected_output = exercise.content.get("expected_output")
        expected_output = str(expected_output) if expected_output is not None else None

    # 2) 若传了 code，则后端判题
    status = payload.status
    score = payload.score
    output_text = ""
    error_text = None
    execution_time_ms = 0
    error_tags = list(payload.error_tags or [])

    if payload.code:
        exec_res = await execute_code(CodeExecutionRequest(code=payload.code, timeout=payload.timeout))
        execution_time_ms = exec_res.execution_time_ms
        if exec_res.success:
            output_text = "" if exec_res.output == "(无输出)" else (exec_res.output or "")
            if expected_output is not None:
                if _normalize_output_for_compare(output_text) == _normalize_output_for_compare(expected_output):
                    status = "correct"
                    score = 100
                else:
                    status = "wrong"
                    score = 0
                    if not error_tags:
                        node = exercise.linked_nodes[0] if (exercise and exercise.linked_nodes) else "generic"
                        error_tags = [f"{node}.output_mismatch"]
            else:
                # 没有预期输出（暂时不支持判题），至少记录一次提交
                status = "submitted"
                score = max(score, 0)
        else:
            output_text = ""
            error_text = exec_res.error
            if exec_res.error and "执行超时" in exec_res.error:
                status = "timeout"
            else:
                status = "error"
            score = 0
            if not error_tags:
                node = exercise.linked_nodes[0] if (exercise and exercise.linked_nodes) else "generic"
                tag = "runtime.timeout" if status == "timeout" else "runtime.error"
                error_tags = [f"{node}.{tag}"]

    # 3) 落库
    record = ExerciseResultModel(
        user_id=user_id,
        exercise_id=payload.exercise_id,
        status=status,
        score=score,
        error_tags=error_tags,
    )
    db.add(record)

    # 3.1) 记录到新的 Attempt 表 (用于 Stats)
    attempt = Attempt(
        user_id=user_id,
        exercise_item_id=payload.exercise_id,
        is_correct=status == "correct",
        score=score,
        response=payload.code if payload.code else None,
        execution_time_ms=execution_time_ms,
        created_at=utcnow_naive()
    )
    db.add(attempt)

    # 3.2) 更新 UserExerciseProgress
    progress_stmt = select(UserExerciseProgress).where(
        and_(
            UserExerciseProgress.user_id == user_id,
            UserExerciseProgress.exercise_item_id == payload.exercise_id
        )
    )
    progress_res = await db.execute(progress_stmt)
    progress = progress_res.scalar_one_or_none()
    
    now = utcnow_naive()
    if not progress:
        progress = UserExerciseProgress(
            user_id=user_id,
            exercise_item_id=payload.exercise_id,
            attempts_count=1,
            last_attempt_at=now
        )
        db.add(progress)
    else:
        progress.attempts_count = (progress.attempts_count or 0) + 1
        progress.last_attempt_at = now

    if status == "correct":
        progress.correct_count = (progress.correct_count or 0) + 1
        progress.last_correct_at = now
        progress.status = "completed"
        progress.mastery_score = min(100, (progress.mastery_score or 0) + 10)
    else:
        progress.wrong_count = (progress.wrong_count or 0) + 1
        progress.last_wrong_at = now
        progress.status = "in_progress"

    await db.flush()

    # 3.3) 记录用户行为到记忆系统
    if exercise:
        await UserMemoryService.record_behavior(
            db,
            user_id,
            behavior_type="exercise_complete",
            context=str(payload.exercise_id),
            event_metadata={
                "is_correct": True if status == "correct" else (False if status == "wrong" else None),
                "status": status,
                "score": score,
                "difficulty": exercise.difficulty,
                "item_type": exercise.exercise_type,
                "linked_nodes": getattr(exercise, "linked_nodes", []),
                "mastery_score": progress.mastery_score
            }
        )

    # 4) 更新薄弱项（weaknesses）：对非正确的结果按 error_tags 计数
    if status != "correct":
        for tag in error_tags:
            if tag:
                await _upsert_weakness(db, user_id, tag)

    await db.commit()

    return ExerciseSubmissionResponse(
        success=True,
        status=status,
        score=score,
        output=output_text,
        expected_output=expected_output,
        error=error_text,
        execution_time_ms=execution_time_ms,
        error_tags=error_tags,
    )


@router.get("/exercises/{exercise_id}/last-attempt", summary="获取用户该题的最后一次作答记录")
async def get_last_attempt(
    exercise_id: UUID,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    try:
        user_uuid = UUID(user_id) if isinstance(user_id, str) else user_id
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")

    stmt = select(Attempt).where(
        and_(
            Attempt.user_id == user_uuid,
            Attempt.exercise_item_id == exercise_id
        )
    ).order_by(desc(Attempt.created_at)).limit(1)
    
    result = await db.execute(stmt)
    attempt = result.scalar_one_or_none()
    
    if not attempt:
        return {"success": False, "message": "No attempts found"}
        
    return {
        "success": True,
        "attempt": {
            "id": str(attempt.id),
            "response": attempt.response,
            "is_correct": attempt.is_correct,
            "score": attempt.score,
            "created_at": attempt.created_at
        }
    }


@router.get("/solved", response_model=List[UUID], summary="获取用户已解决题目ID列表")
async def list_solved_exercises(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> List[UUID]:
    stmt = select(distinct(ExerciseResultModel.exercise_id)).where(
        and_(
            ExerciseResultModel.user_id == user_id,
            ExerciseResultModel.status == "correct",
        )
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/execute", response_model=CodeExecutionResponse, summary="执行Python代码")
async def execute_code(payload: CodeExecutionRequest) -> CodeExecutionResponse:
    """
    在安全沙箱中执行Python代码

    **安全限制：**
    - Docker 容器隔离（无网络、只读文件系统、内存/CPU 限制）
    - Docker 不可用时降级到 subprocess + 黑名单
    - 超时限制（默认5秒，最大30秒）
    - 输出长度限制
    - Docker 沙箱镜像可提供真实运行时；若退化到本地模式且缺少 MindSpore / PyTorch，会直接返回边界说明
    """
    result = await sandbox.execute(
        payload.code,
        timeout=payload.timeout,
    )

    if result.success:
        return CodeExecutionResponse(
            success=True,
            output=result.stdout or "(无输出)",
            error=None,
            execution_time_ms=result.execution_time_ms,
            images=list(result.images) if result.images else [],
        )
    else:
        return CodeExecutionResponse(
            success=False,
            output=result.stdout,
            error=result.stderr or "未知错误",
            execution_time_ms=result.execution_time_ms,
            images=list(result.images) if result.images else [],
        )

