"""
Tests for dev-only prompt management API.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.prompts.admin_service import PromptAdminService
from app.routers.dev_prompts import (
    PromptApplyIssueRequest,
    PromptAnalyzeRequest,
    PromptDiffRequest,
    PromptOptimizeRequest,
    PromptRenderRequest,
    PromptSaveRequest,
    apply_issue,
    analyze_prompt,
    diff_versions,
    get_prompt_detail,
    list_prompts,
    optimize_prompt,
    render_prompt,
    restore_version,
    save_prompt,
)


def _create_prompt_workspace(base_dir: Path) -> PromptAdminService:
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
    fixtures_dir = base_dir.parent / "fixtures"
    fixtures_dir.mkdir(parents=True, exist_ok=True)
    (fixtures_dir / "demo_prompt.json").write_text(
        json.dumps({"name": "小智", "topic": "函数"}, ensure_ascii=False),
        encoding="utf-8",
    )
    return PromptAdminService(prompts_dir=base_dir, fixtures_dir=fixtures_dir)


def _build_service() -> PromptAdminService:
    base_dir = Path(__file__).resolve().parent / "_tmp" / f"prompt_api_{uuid.uuid4().hex}"
    base_dir.mkdir(parents=True, exist_ok=True)
    return _create_prompt_workspace(base_dir)


def test_list_prompts():
    service = _build_service()
    response = list_prompts(True, service)

    assert response["prompts"][0]["name"] == "demo.prompt"


def test_get_prompt_detail():
    service = _build_service()
    response = get_prompt_detail("demo.prompt", True, service)

    assert response["prompt"]["name"] == "demo.prompt"
    assert "fixtures" in response["prompt"]


def test_render_prompt_with_overrides():
    service = _build_service()
    response = render_prompt(
        "demo.prompt",
        PromptRenderRequest(
            variables={"name": "测试者", "topic": "闭包"},
            system_template="系统：{name}",
            user_template="用户：{topic}",
        ),
        True,
        service,
    )

    assert response["messages"][0]["content"] == "系统：测试者"
    assert response["messages"][1]["content"] == "用户：闭包"


def test_render_prompt_returns_http_400_for_missing_variables():
    service = _build_service()

    with pytest.raises(HTTPException) as excinfo:
        render_prompt(
            "demo.prompt",
            PromptRenderRequest(variables={"name": "测试者"}),
            True,
            service,
        )

    assert excinfo.value.status_code == 400
    assert "topic" in str(excinfo.value.detail)


def test_save_prompt_creates_new_version():
    service = _build_service()
    response = save_prompt(
        "demo.prompt",
        PromptSaveRequest(
            description="更新后的 Prompt",
            system_template="系统提示：{name}\n请保持简洁。",
            user_template="用户提示：{topic}\n请给一个例子。",
            temperature=0.2,
            max_tokens=1200,
            output_format="json",
            note="refine prompt",
        ),
        True,
        service,
    )

    assert response["version"]["note"] == "refine prompt"
    assert response["prompt"]["temperature"] == 0.2


def test_diff_and_restore_prompt_version():
    service = _build_service()
    first = save_prompt(
        "demo.prompt",
        PromptSaveRequest(
            description="v1",
            system_template="系统提示：{name}",
            user_template="用户提示：{topic}",
            temperature=0.4,
            max_tokens=800,
            output_format="json",
            note="v1",
        ),
        True,
        service,
    )["version"]["version_id"]

    second = save_prompt(
        "demo.prompt",
        PromptSaveRequest(
            description="v2",
            system_template="系统提示：{name}\n请输出 JSON。",
            user_template="用户提示：{topic}\n请补充一个例子。",
            temperature=0.2,
            max_tokens=1200,
            output_format="json",
            note="v2",
        ),
        True,
        service,
    )["version"]["version_id"]

    diff_response = diff_versions(
        "demo.prompt",
        PromptDiffRequest(left_version_id=first, right_version_id=second),
        True,
        service,
    )
    restore_response = restore_version("demo.prompt", first, True, service)

    assert "请补充一个例子" in diff_response["diff"]["user_template"]
    assert restore_response["version"]["restored_from"] == first


def test_analyze_prompt_returns_quality_report():
    service = _build_service()

    response = analyze_prompt(
        "demo.prompt",
        PromptAnalyzeRequest(),
        True,
        service,
    )

    assert "report" in response
    assert "score" in response["report"]
    assert "issues" in response["report"]


def test_optimize_prompt_returns_optimized_draft():
    service = _build_service()

    response = optimize_prompt(
        "demo.prompt",
        PromptOptimizeRequest(
            focus="强化 JSON-only 输出约束",
            variables={"name": "小智", "topic": "函数"},
        ),
        True,
        service,
    )

    assert "result" in response
    assert "optimized_user_template" in response["result"]
    assert "quality_report" in response["result"]
    assert response["result"]["optimization_mode"] in {"llm", "rule_based"}


def test_apply_issue_updates_draft_and_returns_diff():
    service = _build_service()
    report = analyze_prompt(
        "demo.prompt",
        PromptAnalyzeRequest(),
        True,
        service,
    )
    issue_id = report["report"]["issues"][0]["id"]

    response = apply_issue(
        "demo.prompt",
        PromptApplyIssueRequest(issue_id=issue_id),
        True,
        service,
    )

    assert response["issue"]["id"] == issue_id
    assert response["diff"]["target_section"] == "user"
    assert response["diff"]["after"] != response["diff"]["before"]
