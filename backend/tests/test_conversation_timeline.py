"""
Conversation timeline tests for global history search and pagination.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.llm_config import ConversationMessage, ConversationSession


@pytest.mark.asyncio
async def test_global_timeline_search(
    client: AsyncClient, test_session: AsyncSession, test_user_id: str
):
    """Global timeline should support keyword filtering and pagination."""
    base_time = datetime.now(timezone.utc)

    global_title_hit = ConversationSession(
        user_id=UUID(test_user_id),
        title="for loop title",
        role="explainer",
        scope_type="global",
        scope_id="subject_python",
        updated_at=base_time + timedelta(minutes=3),
    )
    global_message_hit = ConversationSession(
        user_id=UUID(test_user_id),
        title="array tricks",
        role="explainer",
        scope_type="global",
        scope_id="subject_python",
        updated_at=base_time + timedelta(minutes=2),
    )
    global_no_hit = ConversationSession(
        user_id=UUID(test_user_id),
        title="recursion notes",
        role="explainer",
        scope_type="global",
        scope_id="subject_python",
        updated_at=base_time + timedelta(minutes=1),
    )
    concept_hit = ConversationSession(
        user_id=UUID(test_user_id),
        title="for in concept scope",
        role="explainer",
        scope_type="concept",
        scope_id="task_1_1",
        updated_at=base_time + timedelta(minutes=4),
    )

    test_session.add_all([global_title_hit, global_message_hit, global_no_hit, concept_hit])
    await test_session.flush()

    test_session.add(
        ConversationMessage(
            session_id=global_message_hit.id,
            role="assistant",
            content="You can use for loops to iterate items.",
        )
    )
    await test_session.commit()

    page_1 = await client.get(
        "/api/ai-tutor/sessions",
        params={
            "user_id": test_user_id,
            "scope_type": "global",
            "keyword": "for",
            "limit": 1,
            "offset": 0,
        },
    )
    assert page_1.status_code == 200
    payload_1 = page_1.json()
    assert payload_1["total"] == 2
    assert len(payload_1["sessions"]) == 1
    assert payload_1["sessions"][0]["title"] == "for loop title"

    page_2 = await client.get(
        "/api/ai-tutor/sessions",
        params={
            "user_id": test_user_id,
            "scope_type": "global",
            "keyword": "for",
            "limit": 1,
            "offset": 1,
        },
    )
    assert page_2.status_code == 200
    payload_2 = page_2.json()
    assert payload_2["total"] == 2
    assert len(payload_2["sessions"]) == 1
    assert payload_2["sessions"][0]["title"] == "array tricks"
