from datetime import datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.llm_config import UserLLMConfig
from app.services.ai_learning_path_service import AILearningPathService
from app.services.encryption import encryption_service


class TestAILearningPathLLMConfig:
    async def _start_session(self, client, test_user_id: str) -> str:
        response = await client.post(
            f"/api/ai-learning-path/session/start?user_id={test_user_id}",
            json={"subject_key": "python"},
        )
        assert response.status_code == 200
        return response.json()["session_id"]

    async def _save_snapshot(self, client, session_id: str) -> None:
        response = await client.put(
            f"/api/ai-learning-path/session/{session_id}/preference-snapshot",
            json={
                "known_node_ids": ["python.syntax.variables"],
                "target_node_ids": ["python.syntax.variables"],
                "avoid_node_ids": [],
                "free_text_notes": "优先围绕自动化脚本和错误处理展开。",
            },
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_llm_service_prefers_latest_active_user_config(self, test_session):
        user_id = uuid4()
        other_user_id = uuid4()
        base_time = datetime(2026, 4, 16, 10, 0, 0)

        older_active = UserLLMConfig(
            user_id=user_id,
            model_role="default",
            api_base_url="https://api.old.example/v1",
            api_key_encrypted=encryption_service.encrypt("sk-old-active-key"),
            model_name="old-model",
            max_tokens=1024,
            timeout_seconds=30,
            is_active=True,
            created_at=base_time,
            updated_at=base_time,
        )
        newest_inactive = UserLLMConfig(
            user_id=user_id,
            model_role="default",
            api_base_url="https://api.inactive.example/v1",
            api_key_encrypted=encryption_service.encrypt("sk-inactive-key"),
            model_name="inactive-model",
            max_tokens=2048,
            timeout_seconds=60,
            is_active=False,
            created_at=base_time + timedelta(minutes=1),
            updated_at=base_time + timedelta(minutes=1),
        )
        latest_active = UserLLMConfig(
            user_id=user_id,
            model_role="default",
            api_base_url="https://api.latest.example/v1",
            api_key_encrypted=encryption_service.encrypt("sk-latest-active-key"),
            model_name="latest-model",
            max_tokens=512,
            timeout_seconds=45,
            is_active=True,
            created_at=base_time + timedelta(minutes=2),
            updated_at=base_time + timedelta(minutes=2),
        )
        other_user = UserLLMConfig(
            user_id=other_user_id,
            model_role="default",
            api_base_url="https://api.other.example/v1",
            api_key_encrypted=encryption_service.encrypt("sk-other-key"),
            model_name="other-model",
            max_tokens=256,
            timeout_seconds=25,
            is_active=True,
            created_at=base_time + timedelta(minutes=3),
            updated_at=base_time + timedelta(minutes=3),
        )

        test_session.add_all([older_active, newest_inactive, latest_active, other_user])
        await test_session.commit()

        service = AILearningPathService(test_session)
        llm_service = await service._get_llm_service(str(user_id))

        assert llm_service is not None
        assert llm_service.model_name == "latest-model"
        assert llm_service.api_base_url == "https://api.latest.example/v1"
        assert llm_service.max_tokens == 512
        assert llm_service.timeout == 45
        assert getattr(llm_service, "config_source") == "user"
        assert getattr(llm_service, "user_llm_config_id") == str(latest_active.id)

    @pytest.mark.asyncio
    async def test_get_preference_snapshot_delegates_to_clarification_service(self, test_session, monkeypatch):
        service = AILearningPathService(test_session)
        captured: dict[str, str] = {}
        fake_snapshot = SimpleNamespace(session_id="session-1", target_node_ids=["python.syntax.variables"])

        async def _fake_get_preference_snapshot(session_id: str):
            captured["session_id"] = session_id
            return fake_snapshot

        monkeypatch.setattr(service._clarification, "_get_preference_snapshot", _fake_get_preference_snapshot)

        snapshot = await service._get_preference_snapshot("session-1")

        assert captured["session_id"] == "session-1"
        assert snapshot is fake_snapshot

    @pytest.mark.asyncio
    async def test_clarification_helpers_delegate_to_clarification_service(self, test_session, monkeypatch):
        service = AILearningPathService(test_session)
        calls: dict[str, object] = {}
        fake_snapshot = SimpleNamespace(session_id="session-1")
        fake_detail = {"user_id": "user-1"}

        async def _fake_build_context(user_id: str):
            calls["build_context_user_id"] = user_id
            return {"ability_tags_detail": "detail", "learning_stats": "stats"}

        async def _fake_resolve_labels(snapshot, subject_key: str, user_id: str | None):
            calls["resolve_labels"] = (snapshot, subject_key, user_id)
            return {"target": ["变量与数据类型"]}

        async def _fake_build_snapshot_summary(snapshot, subject_key: str, user_id: str | None):
            calls["build_snapshot_summary"] = (snapshot, subject_key, user_id)
            return "快照摘要"

        async def _fake_collect_state(detail: dict, snapshot):
            calls["collect_state"] = (detail, snapshot)
            return {"ready": True, "summary": "ok"}

        monkeypatch.setattr(service._clarification, "_build_clarification_personalization_context", _fake_build_context)
        monkeypatch.setattr(service._clarification, "_resolve_snapshot_node_labels", _fake_resolve_labels)
        monkeypatch.setattr(service._clarification, "_build_snapshot_summary", _fake_build_snapshot_summary)
        monkeypatch.setattr(service._clarification, "_collect_clarification_state", _fake_collect_state)

        context = await service._build_clarification_personalization_context("user-1")
        labels = await service._resolve_snapshot_node_labels(fake_snapshot, "python", "user-1")
        summary = await service._build_snapshot_summary(fake_snapshot, "python", "user-1")
        state = await service._collect_clarification_state(fake_detail, fake_snapshot)

        assert context == {"ability_tags_detail": "detail", "learning_stats": "stats"}
        assert labels == {"target": ["变量与数据类型"]}
        assert summary == "快照摘要"
        assert state == {"ready": True, "summary": "ok"}
        assert calls["build_context_user_id"] == "user-1"
        assert calls["resolve_labels"] == (fake_snapshot, "python", "user-1")
        assert calls["build_snapshot_summary"] == (fake_snapshot, "python", "user-1")
        assert calls["collect_state"] == (fake_detail, fake_snapshot)

    @pytest.mark.asyncio
    async def test_expand_node_respects_user_max_tokens_ceiling(self, client, monkeypatch, test_user_id):
        session_id = await self._start_session(client, test_user_id)
        await self._save_snapshot(client, session_id)

        captured: dict[str, object] = {}

        async def _fake_get_llm_service(self, user_id: str):
            async def _raw_completion(messages, **kwargs):
                captured.update(kwargs)
                return (
                    '{"nodes":[{"label":"错误处理策略","description":"掌握异常分类、重试与兜底处理。","tags":["practical"],"slug":"error-handling"}]}',
                    "stop",
                )

            return SimpleNamespace(
                api_base_url="https://api.user.example/v1",
                api_key="sk-fake-key",
                model_name="user-model",
                timeout=30,
                max_tokens=512,
                config_source="user",
                user_llm_config_id="cfg-user-1",
                raw_completion=_raw_completion,
            )

        monkeypatch.setattr(AILearningPathService, "_get_llm_service", _fake_get_llm_service)

        response = await client.post(
            f"/api/ai-learning-path/session/{session_id}/expand-node",
            json={"node_id": "python.syntax.variables", "mode": "curriculum"},
        )

        payload = response.json()
        assert response.status_code == 200
        assert payload["new_node_ids"] == ["python.syntax.variables.error-handling"]
        assert captured["max_tokens"] == 512
        assert captured["timeout_override"] == 60
        assert captured["use_json_mode"] is True
