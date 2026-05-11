"""
Tests for achievement tree router.
"""
import pytest
from httpx import AsyncClient
from uuid import uuid4


class TestAchievementTreeRouter:
    """Tests for /api/achievement-tree endpoints."""

    @pytest.mark.asyncio
    async def test_get_tree_missing_params(self, client: AsyncClient):
        """Test getting tree without required params returns error."""
        response = await client.get("/api/achievement-tree")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_tree_invalid_subject(self, client: AsyncClient, test_user_id: str):
        """Test getting tree with invalid subject returns 404."""
        response = await client.get(
            "/api/achievement-tree",
            params={
                "subject_id": str(uuid4()),
                "user_id": test_user_id
            }
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_summary_missing_params(self, client: AsyncClient):
        """Test getting summary without required params returns error."""
        response = await client.get("/api/achievement-tree/summary")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_summary_invalid_subject(self, client: AsyncClient, test_user_id: str):
        """Test getting summary with invalid subject returns 404."""
        response = await client.get(
            "/api/achievement-tree/summary",
            params={
                "subject_id": str(uuid4()),
                "user_id": test_user_id
            }
        )
        assert response.status_code == 404
