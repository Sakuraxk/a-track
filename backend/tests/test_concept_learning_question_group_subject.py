from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from app.models.subject import QuestionGroup, Subject
from app.routers.concept_learning import save_exercises_to_db


@pytest.mark.asyncio
async def test_save_exercises_to_db_resolves_subject_by_display_name(test_session):
    user_id = str(uuid4())
    subject = Subject(
        key="machine_learning",
        name="机器学习",
        icon="🤖",
        description="机器学习",
        is_active=True,
    )
    test_session.add(subject)
    await test_session.commit()

    group_id = await save_exercises_to_db(
        test_session,
        exercises=[
            {
                "type": "short_answer",
                "title": "逻辑回归适合解决什么问题？",
                "description": "请说明逻辑回归通常适合的任务类型。",
                "hint": "从输出标签类型思考。",
                "difficulty": 2,
                "answer_key": "分类问题",
            }
        ],
        user_id=user_id,
        task_id="task-ml-logic",
        task_title="理解逻辑回归",
        subject_key="机器学习",
        learning_path_id="path-ml-1",
        learning_path_version=1,
        learning_path_version_name="机器学习计划 v1",
        source_day=1,
        source_chapter_id="chapter-ml-1",
        source_chapter_title="经典监督学习",
        source_task_title="理解逻辑回归",
    )

    assert group_id is not None

    group = (
        await test_session.execute(
            select(QuestionGroup).where(QuestionGroup.id == UUID(group_id))
        )
    ).scalar_one()

    assert group.subject_id is not None
    assert group.source_type == "concept_learning"
    assert group.learning_path_id == "path-ml-1"
