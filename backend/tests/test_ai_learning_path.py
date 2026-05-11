"""
Tests for AI learning path router.
"""
import pytest
from httpx import AsyncClient
from uuid import uuid4


class TestAILearningPathRouter:
    """Tests for /api/ai-learning-path endpoints."""

    @pytest.mark.asyncio
    async def test_get_path_missing_params(self, client: AsyncClient):
        """Test getting path without required params returns error."""
        response = await client.get("/api/ai-learning-path")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_path_no_existing_path(self, client: AsyncClient, test_user_id: str, test_subject_id: str):
        """Test getting path when none exists returns empty or generates new."""
        response = await client.get(
            "/api/ai-learning-path",
            params={
                "user_id": test_user_id,
                "subject_id": test_subject_id
            }
        )
        # Should return 200 with empty path or 404
        assert response.status_code in [200, 404]

    @pytest.mark.asyncio
    async def test_generate_path_missing_user(self, client: AsyncClient, test_subject_id: str):
        """Test generating path without user_id returns error."""
        response = await client.post(
            "/api/ai-learning-path/generate",
            json={"subject_id": test_subject_id}
        )
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_delete_path_missing_params(self, client: AsyncClient):
        """Test deleting path without required params returns error."""
        response = await client.delete("/api/ai-learning-path")
        assert response.status_code == 404
