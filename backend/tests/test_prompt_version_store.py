"""
Tests for prompt version snapshot storage.
"""
from __future__ import annotations

import json
from pathlib import Path
import uuid

import pytest

from app.prompts.registry import PromptRegistry
from app.prompts.version_store import PromptVersionStore


def _create_prompt_workspace(base_dir: Path) -> PromptRegistry:
    templates_dir = base_dir / "templates" / "demo"
    templates_dir.mkdir(parents=True, exist_ok=True)
    (templates_dir / "prompt.system.md").write_text("系统提示：{name}", encoding="utf-8")
    (templates_dir / "prompt.user.md").write_text("用户提示：{topic}", encoding="utf-8")
    (base_dir / "catalog.toml").write_text(
        """
[prompts.demo.prompt]
description = "测试 Prompt"
system_template = "templates/demo/prompt.system.md"
user_template = "templates/demo/prompt.user.md"
temperature = 0.4
max_tokens = 800
output_format = "json"
""".strip(),
        encoding="utf-8",
    )
    return PromptRegistry(base_dir=base_dir)


@pytest.fixture
def local_tmp_dir() -> Path:
    base_dir = Path(__file__).resolve().parent / "_tmp" / f"prompt_versions_{uuid.uuid4().hex}"
    base_dir.mkdir(parents=True, exist_ok=True)
    yield base_dir


def test_version_store_saves_and_lists_versions(local_tmp_dir: Path):
    registry = _create_prompt_workspace(local_tmp_dir)
    store = PromptVersionStore(prompts_dir=local_tmp_dir)

    version = store.create_version(
        registry.get_prompt_content("demo.prompt"),
        note="first save",
        fixture_data={"name": "小智", "topic": "函数"},
    )

    versions = store.list_versions("demo.prompt")

    assert version.version_id == versions[0].version_id
    assert versions[0].note == "first save"


def test_version_store_reads_detail_and_builds_diff(local_tmp_dir: Path):
    registry = _create_prompt_workspace(local_tmp_dir)
    store = PromptVersionStore(prompts_dir=local_tmp_dir)

    first = store.create_version(
        registry.get_prompt_content("demo.prompt"),
        note="v1",
        fixture_data={"name": "老师", "topic": "列表"},
    )

    updated_content = registry.get_prompt_content("demo.prompt")
    updated_content = updated_content.__class__(
        **{
            **updated_content.__dict__,
            "user_template": "用户提示：{topic}\n请输出示例。",
        }
    )
    second = store.create_version(updated_content, note="v2")

    detail = store.get_version("demo.prompt", first.version_id)
    diff = store.diff_versions("demo.prompt", first.version_id, second.version_id)

    assert detail.version_id == first.version_id
    assert "示例" in diff["user_template"]
    assert diff["user_template"].startswith("---")


def test_version_store_restores_historical_version(local_tmp_dir: Path):
    registry = _create_prompt_workspace(local_tmp_dir)
    store = PromptVersionStore(prompts_dir=local_tmp_dir)

    first = store.create_version(registry.get_prompt_content("demo.prompt"), note="v1")

    templates_dir = local_tmp_dir / "templates" / "demo"
    (templates_dir / "prompt.user.md").write_text("用户提示：已改坏", encoding="utf-8")

    restored = store.restore_version("demo.prompt", first.version_id)
    restored_content = (templates_dir / "prompt.user.md").read_text(encoding="utf-8")

    assert restored.version_id != first.version_id
    assert restored_content == "用户提示：{topic}"

    index_data = json.loads((local_tmp_dir / "versions" / "index.json").read_text(encoding="utf-8"))
    assert "demo.prompt" in index_data
