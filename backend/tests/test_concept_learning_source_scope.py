"""
Tests for concept learning source-scope isolation.
"""
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient

from app.models.concept_content import ConceptContent


@pytest.mark.asyncio
async def test_get_concept_content_isolated_by_learning_path_version(
    client: AsyncClient,
    test_session,
):
    """同一 task_id 在不同学习计划版本下应返回各自的缓存内容。"""
    user_id = uuid4()

    test_session.add_all(
        [
            ConceptContent(
                user_id=user_id,
                task_id="task-async-basics",
                task_title="理解事件循环 v2",
                subject="Python",
                learning_path_id="path-1",
                learning_path_version=2,
                learning_path_version_name="学习计划 v2",
                source_day=1,
                source_chapter_id="day-1",
                source_chapter_title="异步基础",
                source_task_title="理解事件循环",
                source_scope_key="concept_learning:path-1:v2:day-1:task-async-basics",
                content="v2 concept content",
                reasoning="",
            ),
            ConceptContent(
                user_id=user_id,
                task_id="task-async-basics",
                task_title="理解事件循环 v3",
                subject="Python",
                learning_path_id="path-2",
                learning_path_version=3,
                learning_path_version_name="学习计划 v3",
                source_day=1,
                source_chapter_id="day-1",
                source_chapter_title="异步基础",
                source_task_title="理解事件循环",
                source_scope_key="concept_learning:path-2:v3:day-1:task-async-basics",
                content="v3 concept content",
                reasoning="",
            ),
        ]
    )
    await test_session.commit()

    v2_response = await client.get(
        "/api/concept-learning/task-async-basics",
        params={
            "user_id": str(user_id),
            "learning_path_id": "path-1",
            "learning_path_version": 2,
            "source_chapter_id": "day-1",
        },
    )
    assert v2_response.status_code == 200
    assert v2_response.json()["content"] == "v2 concept content"

    v3_response = await client.get(
        "/api/concept-learning/task-async-basics",
        params={
            "user_id": str(user_id),
            "learning_path_id": "path-2",
            "learning_path_version": 3,
            "source_chapter_id": "day-1",
        },
    )
    assert v3_response.status_code == 200
    assert v3_response.json()["content"] == "v3 concept content"


@pytest.mark.asyncio
async def test_get_concept_content_exposes_cached_map_metadata(
    client: AsyncClient,
    test_session,
):
    user_id = uuid4()
    cached_reasoning = (
        '{"reasoning_text":"map ready","concept_map":{"root":"生成器"},"markmap_markdown":"# 生成器"}'
    )

    test_session.add(
        ConceptContent(
            user_id=user_id,
            task_id="task-generators",
            task_title="理解生成器",
            subject="Python",
            source_scope_key="concept_learning:legacy:task-generators",
            content="## 生成器是什么\n按需返回值。",
            reasoning=cached_reasoning,
        )
    )
    await test_session.commit()

    response = await client.get(
        "/api/concept-learning/task-generators",
        params={
            "user_id": str(user_id),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["reasoning"] == "map ready"
    assert payload["concept_map"]["root"] == "生成器"
    assert payload["markmap_markdown"] == "# 生成器"
