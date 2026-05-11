"""
Tests for assessment router.
"""
import pytest
from httpx import AsyncClient
from uuid import uuid4


class TestAssessmentRouter:
    """Tests for /api/assessment endpoints."""

    @pytest.mark.asyncio
    async def test_get_status_missing_params(self, client: AsyncClient):
        """Test checking status without required params returns validation error."""
        response = await client.get("/api/assessment/status")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_start_assessment_missing_user(self, client: AsyncClient):
        """Test starting assessment without user_id returns error."""
        response = await client.post(
            "/api/assessment/start",
            json={"subject_key": "python"}
        )
        # Should fail validation without user_id
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_submit_answer_invalid_session(self, client: AsyncClient, test_user_id: str):
        """Test submitting answer with invalid session returns error."""
        response = await client.post(
            "/api/assessment/answer",
            json={
                "session_id": str(uuid4()),
                "question_id": "q1",
                "answer": "A"
            }
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_complete_assessment_invalid_session(self, client: AsyncClient, test_user_id: str):
        """Test completing assessment with invalid session returns error."""
        response = await client.post(
            "/api/assessment/complete",
            json={
                "session_id": str(uuid4()),
                "user_id": test_user_id,
                "learning_goals": ["goal1"]
            }
        )
        assert response.status_code == 404
