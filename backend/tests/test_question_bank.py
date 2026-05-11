"""
Tests for question bank router.
"""
import pytest
from httpx import AsyncClient

import app.routers.question_bank as question_bank_router
from app.models.subject import Subject


class TestQuestionBankRouter:
    """Tests for /api/question-bank endpoints."""

    @pytest.mark.asyncio
    async def test_get_question_types(self, client: AsyncClient):
        """Test getting supported question types."""
        response = await client.get("/api/question-bank/types")
        assert response.status_code == 200
        data = response.json()
        assert "types" in data
        types = data["types"]
        assert len(types) == 5
        type_keys = [t["key"] for t in types]
        assert "mcq" in type_keys
        assert "fill_blank" in type_keys
        assert "short_answer" in type_keys
        assert "essay" in type_keys
        assert "coding" in type_keys

    @pytest.mark.asyncio
    async def test_generate_questions_missing_user(self, client: AsyncClient):
        """Test generating questions without user_id returns error."""
        response = await client.post(
            "/api/question-bank/generate",
            json={
                "subject_key": "python",
                "question_type": "mcq",
                "difficulty": 2,
                "count": 1
            }
        )
        # Should fail validation without user_id
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_generate_questions_with_user(self, client: AsyncClient, test_user_id: str):
        """Test generating questions with valid user_id."""
        response = await client.post(
            "/api/question-bank/generate",
            params={"user_id": test_user_id},
            json={
                "subject_key": "python",
                "question_type": "mcq",
                "difficulty": 2,
                "count": 1
            }
        )
        # Should return template questions (no LLM configured in test)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "questions" in data
        assert data["source"] in ["template", "database", "ai"]

    @pytest.mark.asyncio
    async def test_generate_questions_keeps_versions_isolated(self, client: AsyncClient, test_user_id: str, test_session):
        """同一任务在不同学习计划版本下不应复用同一题组。"""
        test_session.add(
            Subject(
                key="python",
                name="Python",
                description="Python subject for question bank tests",
            )
        )
        await test_session.commit()

        base_payload = {
            "subject_key": "python",
            "topic": "理解事件循环",
            "question_type": "mcq",
            "difficulty": 2,
            "count": 1,
            "persist": True,
            "group_source_type": "ai_generated",
            "group_source_task_id": "task-async-basics",
            "learning_path_id": "path-1",
            "source_chapter_id": "day-1",
            "source_chapter_title": "异步基础",
            "source_task_title": "理解事件循环",
        }

        first_response = await client.post(
            "/api/question-bank/generate",
            params={"user_id": test_user_id},
            json={
                **base_payload,
                "learning_path_version": 2,
                "learning_path_version_name": "学习计划 v2",
            },
        )
        assert first_response.status_code == 200
        first_group_id = first_response.json()["group_id"]

        second_response = await client.post(
            "/api/question-bank/generate",
            params={"user_id": test_user_id},
            json={
                **base_payload,
                "learning_path_version": 3,
                "learning_path_version_name": "学习计划 v3",
            },
        )
        assert second_response.status_code == 200
        second_group_id = second_response.json()["group_id"]

        groups_response = await client.get(
            "/api/question-bank/groups",
            params={"user_id": test_user_id},
        )
        assert groups_response.status_code == 200

        groups = groups_response.json()["groups"]
        assert first_group_id != second_group_id
        assert len(groups) == 2
        assert {group["source_task_id"] for group in groups} == {"task-async-basics"}

    @pytest.mark.asyncio
    async def test_score_answer_missing_user(self, client: AsyncClient):
        """Test scoring answer without user_id returns error."""
        response = await client.post(
            "/api/question-bank/score",
            json={
                "question_id": "q1",
                "question": "What is Python?",
                "answer": "A programming language",
                "question_type": "short_answer"
            }
        )
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_submit_attempt_returns_ai_grading_fields(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """提交主观题时，应返回 AI 判题相关字段。"""

        async def fake_submit_attempt_service(db, user_id: str, exercise_item_id: str, response):
            assert user_id == test_user_id
            assert exercise_item_id == "q-short-1"
            assert response == "Python 是一种解释型语言"
            return {
                "is_correct": True,
                "score": 86,
                "scoring_method": "llm",
                "feedback": "答案抓住了核心概念，但还可以补充动态类型特征。",
                "grading_detail": {
                    "total_score": 86,
                    "dimensions": [
                        {
                            "name": "内容准确性",
                            "score": 86,
                            "feedback": "核心概念表述正确",
                        }
                    ],
                    "strengths": ["概念准确"],
                    "improvements": ["补充语言特性"],
                },
                "grading_trace": ["已读取题干与参考答案。"],
                "progress": {
                    "status": "completed",
                    "attempts_count": 1,
                    "correct_count": 1,
                    "wrong_count": 0,
                    "mastery_score": 20,
                    "last_attempt_at": None,
                    "last_correct_at": None,
                    "last_wrong_at": None,
                },
                "group_progress": None,
                "xp_gained": 10,
                "leveled_up": False,
                "new_badges": [],
            }

        monkeypatch.setattr(
            question_bank_router,
            "submit_attempt_service",
            fake_submit_attempt_service,
        )

        response = await client.post(
            "/api/question-bank/attempts",
            params={"user_id": test_user_id},
            json={
                "exercise_item_id": "q-short-1",
                "response": "Python 是一种解释型语言",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["is_correct"] is True
        assert data["score"] == 86
        assert data["scoring_method"] == "llm"
        assert "核心概念" in data["feedback"]
        assert data["grading_detail"]["total_score"] == 86
        assert data["grading_detail"]["strengths"] == ["概念准确"]
        assert data["grading_trace"] == ["已读取题干与参考答案。"]
