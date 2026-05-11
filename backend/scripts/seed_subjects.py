"""
Seed script for multi-subject learning platform.

This script:
1. Creates the 7 initial subjects
2. Creates chapters for each subject
3. Migrates existing Python knowledge nodes (adds subject_id)
4. Creates initial knowledge nodes for other subjects

Usage:
    cd backend
    python -m scripts.seed_subjects
"""

import asyncio
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import close_db, get_session
from app.models.subject import Subject, Chapter
from app.models.learning import KnowledgeNode


# Subject definitions
SUBJECTS = [
    {
        "key": "python",
        "name": "Python 编程",
        "icon": "🐍",
        "description": "从零开始学习 Python 编程语言，掌握编程基础和实用技能",
    },
    {
        "key": "machine_learning",
        "name": "机器学习",
        "icon": "🤖",
        "description": "学习机器学习的核心概念、算法和实践应用",
    },
    {
        "key": "advanced_math",
        "name": "高等数学",
        "icon": "📐",
        "description": "掌握微积分、线性代数等高等数学核心知识",
    },
    {
        "key": "probability",
        "name": "概率论",
        "icon": "🎲",
        "description": "掌握概率空间、随机变量、概率分布与极限定理等核心概念",
    },
    {
        "key": "linear_algebra",
        "name": "线性代数",
        "icon": "📊",
        "description": "掌握矩阵运算、向量空间、线性变换与特征值理论",
    },
    {
        "key": "statistics",
        "name": "统计学",
        "icon": "📈",
        "description": "掌握描述统计、推断统计、假设检验与回归分析等统计方法",
    },
    {
        "key": "ai_literacy",
        "name": "AI通识与AI素养",
        "icon": "🧠",
        "description": "全面认知AI、建立AI时代全局视野，掌握AI智能体全流程落地能力与AI素养体系",
    },
]

# Chapter definitions for each subject
CHAPTERS = {
    "python": [
        {"code": "basics", "title": "基础语法", "order_index": 1},
        {"code": "control_flow", "title": "控制流程", "order_index": 2},
        {"code": "data_structures", "title": "数据结构", "order_index": 3},
        {"code": "functions", "title": "函数", "order_index": 4},
        {"code": "oop", "title": "面向对象", "order_index": 5},
        {"code": "advanced", "title": "高级主题", "order_index": 6},
    ],
    "machine_learning": [
        {"code": "math_foundations", "title": "数学基础", "order_index": 1},
        {"code": "supervised", "title": "监督学习", "order_index": 2},
        {"code": "unsupervised", "title": "无监督学习", "order_index": 3},
        {"code": "deep_learning", "title": "深度学习", "order_index": 4},
        {"code": "projects", "title": "实践项目", "order_index": 5},
    ],
    "advanced_math": [
        {"code": "limits", "title": "极限与连续", "order_index": 1},
        {"code": "derivatives", "title": "导数与微分", "order_index": 2},
        {"code": "integrals", "title": "积分", "order_index": 3},
        {"code": "series", "title": "级数", "order_index": 4},
        {"code": "multivariate", "title": "多元函数", "order_index": 5},
    ],
    "probability": [
        {"code": "probability_basics", "title": "概率基础与随机事件", "order_index": 1},
        {"code": "conditional_probability", "title": "条件概率与独立性", "order_index": 2},
        {"code": "random_variables", "title": "随机变量与分布", "order_index": 3},
        {"code": "numerical_characteristics", "title": "数字特征", "order_index": 4},
        {"code": "limit_theorems", "title": "大数定律与中心极限定理", "order_index": 5},
        {"code": "joint_distributions", "title": "多维随机变量", "order_index": 6},
    ],
    "linear_algebra": [
        {"code": "determinants", "title": "行列式", "order_index": 1},
        {"code": "matrices", "title": "矩阵及其运算", "order_index": 2},
        {"code": "linear_equations", "title": "线性方程组", "order_index": 3},
        {"code": "vector_spaces", "title": "向量空间与线性变换", "order_index": 4},
        {"code": "eigenvalues", "title": "特征值与特征向量", "order_index": 5},
        {"code": "quadratic_forms", "title": "二次型", "order_index": 6},
    ],
    "statistics": [
        {"code": "descriptive_statistics", "title": "描述统计", "order_index": 1},
        {"code": "sampling_distributions", "title": "抽样分布", "order_index": 2},
        {"code": "parameter_estimation", "title": "参数估计", "order_index": 3},
        {"code": "hypothesis_testing", "title": "假设检验", "order_index": 4},
        {"code": "regression_analysis", "title": "回归分析", "order_index": 5},
        {"code": "variance_analysis", "title": "方差分析", "order_index": 6},
    ],
    "ai_literacy": [
        # 第一大部分：AI 通识（7 个单元）
        {"code": "intro_cognitive", "title": "课程导论与AI时代的认知重构", "order_index": 1},
        {"code": "ai_history", "title": "人工智能发展历程与核心里程碑", "order_index": 2},
        {"code": "llm_principles", "title": "大模型核心原理通俗解读", "order_index": 3},
        {"code": "ai_tools_ecosystem", "title": "全球主流AI工具与智能体生态全景", "order_index": 4},
        {"code": "ai_applications", "title": "AI在全学科与全场景的应用落地", "order_index": 5},
        {"code": "ai_ethics", "title": "AI的伦理、安全与合规边界", "order_index": 6},
        {"code": "ai_future", "title": "AI未来发展趋势与个人成长路径", "order_index": 7},
        # 第二大部分：AI 素养 - 模块一：AI智能体必备工具与技术基础（8 个单元）
        {"code": "markdown", "title": "AI交互核心语言：Markdown全掌握", "order_index": 8},
        {"code": "json_data", "title": "AI智能体核心数据格式：JSON与结构化数据", "order_index": 9},
        {"code": "cli_terminal", "title": "终端/CLI命令行基础", "order_index": 10},
        {"code": "runtime_env", "title": "AI智能体运行环境核心：Node.js与Python基础", "order_index": 11},
        {"code": "git_github", "title": "Git与GitHub基础：开源AI智能体生态入门", "order_index": 12},
        {"code": "yaml_automation", "title": "AI智能体配置核心：YAML/TOML与自动化脚本基础", "order_index": 13},
        {"code": "api_docker", "title": "API与Docker基础：AI智能体进阶使用", "order_index": 14},
        {"code": "agent_fullstack", "title": "AI智能体全流程落地综合实战", "order_index": 15},
        # 第二大部分：AI 素养 - 模块二：核心思维与价值认知
        {"code": "ai_mindset", "title": "AI素养核心思维与价值认知", "order_index": 16},
    ],
}

# Mapping from old Python node category to chapter code
PYTHON_CATEGORY_TO_CHAPTER = {
    "基础语法": "basics",
    "条件语句": "control_flow",
    "循环结构": "control_flow",
    "列表与元组": "data_structures",
    "字典与集合": "data_structures",
    "字符串处理": "data_structures",
    "函数": "functions",
    "异常处理": "advanced",
    "文件操作": "advanced",
    "面向对象": "oop",
}


async def seed_subjects(db: AsyncSession) -> dict[str, uuid.UUID]:
    """Create subjects and return mapping of key -> id"""
    subject_ids = {}
    active_keys = {s["key"] for s in SUBJECTS}

    for subject_data in SUBJECTS:
        # Check if subject already exists
        result = await db.execute(
            select(Subject).where(Subject.key == subject_data["key"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            subject_ids[subject_data["key"]] = existing.id
            print(f"Subject '{subject_data['key']}' already exists, skipping...")
            continue

        subject = Subject(
            id=uuid.uuid4(),
            key=subject_data["key"],
            name=subject_data["name"],
            icon=subject_data["icon"],
            description=subject_data["description"],
            is_active=True,
            created_at=datetime.utcnow(),
        )
        db.add(subject)
        subject_ids[subject_data["key"]] = subject.id
        print(f"Created subject: {subject_data['name']}")

    # Deactivate subjects that are no longer in the active SUBJECTS list
    all_subjects_result = await db.execute(select(Subject))
    for subject in all_subjects_result.scalars().all():
        if subject.key not in active_keys and subject.is_active:
            subject.is_active = False
            print(f"Deactivated discontinued subject: {subject.name} ({subject.key})")

    await db.flush()
    return subject_ids


async def seed_chapters(db: AsyncSession, subject_ids: dict[str, uuid.UUID]) -> dict[str, uuid.UUID]:
    """Create chapters and return mapping of (subject_key, chapter_code) -> id"""
    chapter_ids = {}

    for subject_key, chapters in CHAPTERS.items():
        subject_id = subject_ids.get(subject_key)
        if not subject_id:
            print(f"Subject '{subject_key}' not found, skipping chapters...")
            continue

        for chapter_data in chapters:
            # Check if chapter already exists
            result = await db.execute(
                select(Chapter).where(
                    Chapter.subject_id == subject_id,
                    Chapter.code == chapter_data["code"]
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                chapter_ids[(subject_key, chapter_data["code"])] = existing.id
                print(f"Chapter '{subject_key}.{chapter_data['code']}' already exists, skipping...")
                continue

            chapter = Chapter(
                id=uuid.uuid4(),
                subject_id=subject_id,
                code=chapter_data["code"],
                title=chapter_data["title"],
                order_index=chapter_data["order_index"],
                created_at=datetime.utcnow(),
            )
            db.add(chapter)
            chapter_ids[(subject_key, chapter_data["code"])] = chapter.id
            print(f"Created chapter: {subject_key}.{chapter_data['code']} - {chapter_data['title']}")

    await db.flush()
    return chapter_ids


async def migrate_python_nodes(
    db: AsyncSession,
    python_subject_id: uuid.UUID,
    chapter_ids: dict[str, uuid.UUID]
) -> None:
    """Update existing Python knowledge nodes with subject_id and chapter_id"""
    # Get all knowledge nodes without subject_id
    result = await db.execute(
        select(KnowledgeNode).where(KnowledgeNode.subject_id.is_(None))
    )
    nodes = result.scalars().all()

    if not nodes:
        print("No Python nodes to migrate (all nodes already have subject_id)")
        return

    for node in nodes:
        # Determine chapter from attributes
        category = None
        if node.attributes and isinstance(node.attributes, dict):
            category = node.attributes.get("category")

        chapter_code = PYTHON_CATEGORY_TO_CHAPTER.get(category, "basics")
        chapter_id = chapter_ids.get(("python", chapter_code))

        node.subject_id = python_subject_id
        node.chapter_id = chapter_id
        node.updated_at = datetime.utcnow()

        print(f"Migrated node: {node.code} -> python.{chapter_code}")

    await db.flush()
    print(f"Migrated {len(nodes)} Python knowledge nodes")


async def main():
    """Main seed function"""
    async with get_session() as db:
        try:
            print("=" * 50)
            print("Seeding multi-subject learning platform...")
            print("=" * 50)

            # 1. Create subjects
            print("\n[1/3] Creating subjects...")
            subject_ids = await seed_subjects(db)

            # 2. Create chapters
            print("\n[2/3] Creating chapters...")
            chapter_ids = await seed_chapters(db, subject_ids)

            # 3. Migrate Python nodes
            print("\n[3/3] Migrating Python knowledge nodes...")
            python_subject_id = subject_ids.get("python")
            if python_subject_id:
                await migrate_python_nodes(db, python_subject_id, chapter_ids)

            # Commit all changes
            await db.commit()

            print("\n" + "=" * 50)
            print("Seeding completed successfully!")
            print("=" * 50)

        except Exception as e:
            print(f"\nError during seeding: {e}")
            raise
        finally:
            await close_db()


if __name__ == "__main__":
    asyncio.run(main())
