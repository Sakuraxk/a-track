"""
Tests for prompt quality analysis and optimization.
"""
from app.prompts.quality_service import PromptQualityService
from app.prompts.registry import PromptContent


def _build_content(system_template: str | None, user_template: str) -> PromptContent:
    service = PromptQualityService()
    return PromptContent(
        name="demo.prompt",
        description="测试 Prompt",
        system_template_path="templates/demo/system.md" if system_template else None,
        user_template_path="templates/demo/user.md",
        system_template=system_template,
        user_template=user_template,
        temperature=0.7,
        max_tokens=2000,
        output_format="json",
        required_variables=service.extract_required_variables(system_template, user_template),
    )


def test_quality_service_returns_score_dimensions_and_summary():
    service = PromptQualityService()
    content = _build_content(
        "你是一个严谨的助手。你必须只输出 JSON。",
        "请根据 {subject_name} 生成结果。\n\n## 输出格式\n只输出 JSON，不要其他内容。",
    )

    report = service.analyze(content)

    assert 0 <= report["score"] <= 100
    assert report["grade"] in {"优秀", "良好", "合格", "待优化"}
    assert len(report["dimensions"]) == 5
    assert isinstance(report["summary"], str)


def test_quality_service_flags_missing_json_only_constraint():
    service = PromptQualityService()
    content = _build_content(
        "你是一个助手。",
        "请生成 5 条学习建议，并返回 JSON 格式。",
    )

    report = service.analyze(content)
    issue_titles = [issue["title"] for issue in report["issues"]]

    assert any("JSON" in title or "输出约束" in title for title in issue_titles)
    assert report["score"] < 90


def test_quality_service_penalizes_unstructured_prompt():
    service = PromptQualityService()
    content = _build_content(
        None,
        "请帮我优化这个提示词然后顺便给出结果还要注意格式和规则以及变量和上下文不要遗漏并且尽量详细",
    )

    report = service.analyze(content)
    structure_dimension = next(item for item in report["dimensions"] if item["name"] == "结构清晰度")

    assert structure_dimension["score"] < 70
    assert len(report["issues"]) >= 1
