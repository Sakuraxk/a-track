from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.core.llm_limits import MAX_LLM_OUTPUT_TOKENS
from app.dependencies.auth import get_current_user_id
from app.main import app
from app.models.llm_config import UserLLMConfig
from app.routers import llm_config as llm_config_router
from app.schemas.llm_config import LLMConfigCreate, LLMConfigUpdate
from app.services.encryption import encryption_service


def _valid_config_payload(**overrides):
    payload = {
        "api_base_url": "https://api.example.com/v1",
        "api_key": "sk-test-api-key",
        "model_name": "test-model",
        "max_tokens": MAX_LLM_OUTPUT_TOKENS,
    }
    payload.update(overrides)
    return payload


def test_llm_config_create_rejects_output_tokens_above_platform_limit():
    with pytest.raises(ValidationError):
        LLMConfigCreate(**_valid_config_payload(max_tokens=MAX_LLM_OUTPUT_TOKENS + 1))


def test_llm_config_update_rejects_output_tokens_above_platform_limit():
    with pytest.raises(ValidationError):
        LLMConfigUpdate(max_tokens=MAX_LLM_OUTPUT_TOKENS + 1)


@pytest.mark.asyncio
async def test_llm_config_list_uses_authenticated_user(client, test_session):
    current_user_id = uuid4()
    other_user_id = uuid4()

    app.dependency_overrides[get_current_user_id] = lambda: current_user_id

    current_config = UserLLMConfig(
        user_id=current_user_id,
        model_role="default",
        api_base_url="https://api.current.example/v1",
        api_key_encrypted=encryption_service.encrypt("sk-current-user-key"),
        model_name="current-model",
    )
    other_config = UserLLMConfig(
        user_id=other_user_id,
        model_role="default",
        api_base_url="https://api.other.example/v1",
        api_key_encrypted=encryption_service.encrypt("sk-other-user-key"),
        model_name="other-model",
    )
    test_session.add_all([current_config, other_config])
    await test_session.commit()

    response = await client.get(
        "/api/llm-config/",
        params={"user_id": str(other_user_id)},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["configs"][0]["user_id"] == str(current_user_id)
    assert payload["configs"][0]["model_name"] == "current-model"


@pytest.mark.asyncio
async def test_llm_config_test_uses_saved_runtime_parameters_and_probe(client, test_session, monkeypatch):
    current_user_id = uuid4()
    app.dependency_overrides[get_current_user_id] = lambda: current_user_id

    try:
        config = UserLLMConfig(
            user_id=current_user_id,
            model_role="default",
            api_base_url="https://api.runtime.example/v1",
            api_key_encrypted=encryption_service.encrypt("sk-runtime-user-key"),
            model_name="runtime-model",
            temperature=30,
            max_tokens=512,
            timeout_seconds=45,
        )
        test_session.add(config)
        await test_session.commit()

        captured: dict[str, dict] = {}

        def _fake_create(*, api_base_url, api_key, model_name, temperature=None, max_tokens=None, timeout=None):
            captured["create"] = {
                "api_base_url": api_base_url,
                "api_key": api_key,
                "model_name": model_name,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "timeout": timeout,
            }

            async def _test_connection():
                return {
                    "success": True,
                    "message": "连接成功",
                    "latency_ms": 12,
                    "model_info": {},
                }

            async def _raw_completion(messages, **kwargs):
                captured["raw_completion"] = kwargs
                return ('{"status":"ok","mode":"json"}', "stop")

            return SimpleNamespace(
                api_base_url=api_base_url,
                api_key=api_key,
                model_name=model_name,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
                test_connection=_test_connection,
                raw_completion=_raw_completion,
            )

        monkeypatch.setattr(llm_config_router.LLMServiceFactory, "create", staticmethod(_fake_create))

        response = await client.post(
            "/api/llm-config/test",
            json={"config_id": str(config.id)},
        )

        payload = response.json()
        assert response.status_code == 200
        assert payload["success"] is True
        assert captured["create"]["api_base_url"] == "https://api.runtime.example/v1"
        assert captured["create"]["model_name"] == "runtime-model"
        assert captured["create"]["temperature"] == pytest.approx(0.3)
        assert captured["create"]["max_tokens"] == 512
        assert captured["create"]["timeout"] == 45
        assert captured["raw_completion"]["max_tokens"] == 128
        assert captured["raw_completion"]["timeout_override"] == 45
        assert captured["raw_completion"]["use_json_mode"] is True
        assert payload["model_info"]["effective_config"]["max_tokens"] == 512
    finally:
        app.dependency_overrides.pop(get_current_user_id, None)
