"""
Conversation scope tests for AI tutor sessions.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.models.llm_config import ConversationSession
from app.services.conversation_service import ConversationService


@pytest.mark.asyncio
async def test_list_sessions_can_filter_by_scope(
    client: AsyncClient, test_session: AsyncSession, test_user_id: str
):
    """List sessions should support scope_type/scope_id filtering."""
    concept_session = ConversationSession(
        user_id=UUID(test_user_id),
        title="concept-session",
        role="explainer",
    )
    global_session = ConversationSession(
        user_id=UUID(test_user_id),
        title="global-session",
        role="explainer",
    )

    if hasattr(concept_session, "scope_type"):
        concept_session.scope_type = "concept"
    if hasattr(concept_session, "scope_id"):
        concept_session.scope_id = "task_1_1"
    if hasattr(global_session, "scope_type"):
        global_session.scope_type = "global"
    if hasattr(global_session, "scope_id"):
        global_session.scope_id = "subject_python"

    test_session.add_all([concept_session, global_session])
    await test_session.commit()

    response = await client.get(
        "/api/ai-tutor/sessions",
        params={
            "user_id": test_user_id,
            "scope_type": "concept",
            "scope_id": "task_1_1",
        },
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["total"] == 1
    assert len(payload["sessions"]) == 1
    assert payload["sessions"][0]["title"] == "concept-session"
    assert payload["sessions"][0].get("scope_type") == "concept"
    assert payload["sessions"][0].get("scope_id") == "task_1_1"


@pytest.mark.asyncio
async def test_chat_stream_creates_session_with_scope(
    client: AsyncClient, test_user_id: str, monkeypatch: pytest.MonkeyPatch
):
    """Stream chat should create session with scope_type/scope_id."""
    original_get_or_create = ConversationService._get_or_create_session

    async def _mock_get_llm_config(self, user_id: str, role: str):
        return None

    async def _patched_get_or_create_session(self, user_id, *args, **kwargs):
        normalized_user_id = UUID(user_id) if isinstance(user_id, str) else user_id
        return await original_get_or_create(self, normalized_user_id, *args, **kwargs)

    monkeypatch.setattr(ConversationService, "_get_llm_config", _mock_get_llm_config)
    monkeypatch.setattr(ConversationService, "_get_or_create_session", _patched_get_or_create_session)

    response = await client.post(
        "/api/ai-tutor/chat/stream",
        params={"user_id": test_user_id},
        json={
            "message": "解释一下循环",
            "tutor_role": "explainer",
            "scope_type": "concept",
            "scope_id": "task_1_1",
        },
    )
    assert response.status_code == 200

    sessions_response = await client.get(
        "/api/ai-tutor/sessions",
        params={"user_id": test_user_id, "limit": 1, "offset": 0},
    )
    assert sessions_response.status_code == 200
    sessions_payload = sessions_response.json()
    assert sessions_payload["total"] == 1
    assert sessions_payload["sessions"][0].get("scope_type") == "concept"
    assert sessions_payload["sessions"][0].get("scope_id") == "task_1_1"
