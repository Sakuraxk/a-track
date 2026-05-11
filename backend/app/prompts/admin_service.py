"""
Administrative prompt editing service for dev tooling.
"""
from __future__ import annotations

import asyncio
import json
import re
import tomllib
from pathlib import Path
from typing import Any, Dict, List, Optional

from .registry import PromptContent, PromptRegistry, PromptRenderError
from .quality_service import PromptQualityService
from .version_store import PromptVersionStore, PromptVersionSummary


class PromptAdminService:
    """Manage prompt content, fixtures, rendering, saving, and versions."""

    def __init__(self, prompts_dir: Optional[Path] = None, fixtures_dir: Optional[Path] = None):
        self.prompts_dir = Path(prompts_dir or Path(__file__).resolve().parent)
        self.fixtures_dir = Path(fixtures_dir or self.prompts_dir.parent.parent / "prompts" / "fixtures")
        self.version_store = PromptVersionStore(self.prompts_dir)
        self.quality_service = PromptQualityService()

    def list_prompts(self) -> List[Dict[str, Any]]:
        registry = self._registry()
        return [
            {
                "name": definition.name,
                "description": definition.description,
                "has_system_template": bool(definition.system_template),
                "temperature": definition.temperature,
                "max_tokens": definition.max_tokens,
                "output_format": definition.output_format,
            }
            for definition in registry.list_definitions()
        ]

    def get_prompt(self, prompt_name: str) -> Dict[str, Any]:
        content = self._registry().get_prompt_content(prompt_name)
        return self._serialize_prompt(content)

    def analyze_prompt(
        self,
        prompt_name: str,
        system_template: Optional[str] = None,
        user_template: Optional[str] = None,
    ) -> Dict[str, Any]:
        content = self._build_prompt_content(prompt_name, system_template, user_template)
        return {"report": self.quality_service.analyze(content)}

    def optimize_prompt(
        self,
        prompt_name: str,
        focus: str = "",
        variables: Optional[Dict[str, Any]] = None,
        system_template: Optional[str] = None,
        user_template: Optional[str] = None,
    ) -> Dict[str, Any]:
        content = self._build_prompt_content(prompt_name, system_template, user_template)
        report = self.quality_service.analyze(content)
        optimized_system, optimized_user, change_summary, optimization_mode = self._build_optimized_draft(content, report, focus)
        optimized_content = PromptContent(
            name=content.name,
            description=content.description,
            system_template_path=content.system_template_path,
            user_template_path=content.user_template_path,
            system_template=optimized_system,
            user_template=optimized_user,
            temperature=content.temperature,
            max_tokens=content.max_tokens,
            output_format=content.output_format,
            required_variables=self.quality_service.extract_required_variables(optimized_system, optimized_user),
        )
        optimized_report = self.quality_service.analyze(optimized_content)
        return {
            "result": {
                "optimized_system_template": optimized_system,
                "optimized_user_template": optimized_user,
                "change_summary": change_summary,
                "optimization_notes": focus or "根据规则分析自动强化结构与约束。",
                "optimization_mode": optimization_mode,
                "quality_report": optimized_report,
            }
        }

    def apply_issue(
        self,
        prompt_name: str,
        issue_id: str,
        system_template: Optional[str] = None,
        user_template: Optional[str] = None,
    ) -> Dict[str, Any]:
        content = self._build_prompt_content(prompt_name, system_template, user_template)
        report = self.quality_service.analyze(content)
        issue = next((item for item in report["issues"] if item["id"] == issue_id), None)
        if issue is None:
            raise KeyError(f"Unknown issue: {issue_id}")

        updated_system = content.system_template
        updated_user = content.user_template
        target = issue["target_section"]
        replacement = issue.get("replacement_text") or issue["suggestion"]

        if target == "system":
            updated_system = self._apply_replacement(content.system_template or "", issue["matched_text"], replacement)
        else:
            updated_user = self._apply_replacement(content.user_template, issue["matched_text"], replacement)

        updated_content = PromptContent(
            name=content.name,
            description=content.description,
            system_template_path=content.system_template_path,
            user_template_path=content.user_template_path,
            system_template=updated_system,
            user_template=updated_user,
            temperature=content.temperature,
            max_tokens=content.max_tokens,
            output_format=content.output_format,
            required_variables=self.quality_service.extract_required_variables(updated_system, updated_user),
        )

        return {
            "issue": issue,
            "draft": self._serialize_prompt(updated_content),
            "diff": {
                "target_section": target,
                "before": content.system_template if target == "system" else content.user_template,
                "after": updated_system if target == "system" else updated_user,
            },
        }

    def render_prompt(
        self,
        prompt_name: str,
        variables: Optional[Dict[str, Any]] = None,
        system_template: Optional[str] = None,
        user_template: Optional[str] = None,
    ) -> Dict[str, Any]:
        registry = self._registry()
        required_variables = registry.get_required_variables(
            prompt_name,
            overrides={
                "system_template": system_template,
                "user_template": user_template,
            },
        )
        messages = registry.render_messages(
            prompt_name,
            variables or {},
            overrides={
                "system_template": system_template,
                "user_template": user_template,
            },
        )
        return {
            "messages": messages,
            "required_variables": required_variables,
        }

    async def run_prompt(
        self,
        prompt_name: str,
        variables: Optional[Dict[str, Any]] = None,
        system_template: Optional[str] = None,
        user_template: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> Dict[str, Any]:
        from openai import AsyncOpenAI
        from app.core.config import settings

        if not settings.use_system_llm or not settings.deepseek_api_key:
            raise ValueError("系统级 LLM 未配置，无法执行真实调用")

        registry = self._registry()
        definition = registry.get_definition(prompt_name)
        messages = registry.render_messages(
            prompt_name,
            variables or {},
            overrides={
                "system_template": system_template,
                "user_template": user_template,
            },
        )

        client = AsyncOpenAI(
            base_url=settings.deepseek_base_url,
            api_key=settings.deepseek_api_key,
            timeout=settings.default_llm_timeout,
        )
        response = await client.chat.completions.create(
            model=settings.deepseek_model,
            messages=messages,
            temperature=temperature if temperature is not None else definition.temperature,
            max_tokens=max_tokens if max_tokens is not None else definition.max_tokens,
        )
        return {
            "messages": messages,
            "content": response.choices[0].message.content or "",
            "model": response.model or settings.deepseek_model,
        }

    def save_prompt(
        self,
        prompt_name: str,
        description: str,
        system_template: Optional[str],
        user_template: str,
        temperature: float,
        max_tokens: int,
        output_format: str,
        note: str = "",
    ) -> Dict[str, Any]:
        current = self._registry().get_prompt_content(prompt_name)
        system_path = current.system_template_path
        if system_template and not system_path:
            system_path = self._derive_template_path(prompt_name, role="system")
        if system_template is not None and system_path:
            self._write_template(system_path, system_template)
        if not system_template and current.system_template_path:
            system_template = ""

        self._write_template(current.user_template_path, user_template)
        self._update_catalog_entry(
            prompt_name,
            {
                "description": description,
                "system_template": system_path,
                "user_template": current.user_template_path,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "output_format": output_format,
            },
        )

        self._clear_registry_cache()
        updated = self._registry().get_prompt_content(prompt_name)
        updated = PromptContent(
            name=updated.name,
            description=description,
            system_template_path=system_path,
            user_template_path=updated.user_template_path,
            system_template=system_template if system_path else None,
            user_template=user_template,
            temperature=temperature,
            max_tokens=max_tokens,
            output_format=output_format,
            required_variables=self._registry().get_required_variables(prompt_name),
        )
        version = self.version_store.create_version(updated, note=note)
        self._clear_registry_cache()
        return {
            "prompt": self._serialize_prompt(updated),
            "version": self._serialize_version(version),
        }

    def diff_versions(self, prompt_name: str, left_version_id: str, right_version_id: str) -> Dict[str, Any]:
        return {"diff": self.version_store.diff_versions(prompt_name, left_version_id, right_version_id)}

    def restore_version(self, prompt_name: str, version_id: str) -> Dict[str, Any]:
        version = self.version_store.restore_version(prompt_name, version_id)
        self._clear_registry_cache()
        prompt = self.get_prompt(prompt_name)
        return {"prompt": prompt, "version": self._serialize_version(version)}

    def list_versions(self, prompt_name: str) -> List[Dict[str, Any]]:
        return [self._serialize_version(version) for version in self.version_store.list_versions(prompt_name)]

    def get_version(self, prompt_name: str, version_id: str) -> Dict[str, Any]:
        version = self.version_store.get_version(prompt_name, version_id)
        return {
            "version_id": version.version_id,
            "created_at": version.created_at,
            "note": version.note,
            "restored_from": version.restored_from,
            "system_template": version.system_template,
            "user_template": version.user_template,
            "temperature": version.temperature,
            "max_tokens": version.max_tokens,
            "output_format": version.output_format,
            "fixture_data": version.fixture_data,
        }

    def _registry(self) -> PromptRegistry:
        return PromptRegistry(base_dir=self.prompts_dir)

    def _build_prompt_content(
        self,
        prompt_name: str,
        system_template: Optional[str],
        user_template: Optional[str],
    ) -> PromptContent:
        current = self._registry().get_prompt_content(prompt_name)
        resolved_system = system_template if system_template is not None else current.system_template
        resolved_user = user_template if user_template is not None else current.user_template
        return PromptContent(
            name=current.name,
            description=current.description,
            system_template_path=current.system_template_path,
            user_template_path=current.user_template_path,
            system_template=resolved_system,
            user_template=resolved_user,
            temperature=current.temperature,
            max_tokens=current.max_tokens,
            output_format=current.output_format,
            required_variables=self.quality_service.extract_required_variables(resolved_system, resolved_user),
        )

    def _serialize_prompt(self, content: PromptContent) -> Dict[str, Any]:
        return {
            "name": content.name,
            "description": content.description,
            "system_template": content.system_template,
            "user_template": content.user_template,
            "temperature": content.temperature,
            "max_tokens": content.max_tokens,
            "output_format": content.output_format,
            "required_variables": content.required_variables,
            "suggested_variables": self._build_suggested_variables(content),
            "fixtures": self._list_matching_fixtures(content.name),
            "fixture_examples": self._build_fixture_examples(content),
            "versions": self.list_versions(content.name),
        }

    def _serialize_version(self, version: PromptVersionSummary) -> Dict[str, Any]:
        return {
            "prompt_name": version.prompt_name,
            "version_id": version.version_id,
            "created_at": version.created_at,
            "note": version.note,
            "restored_from": version.restored_from,
        }

    def _list_matching_fixtures(self, prompt_name: str) -> List[str]:
        if not self.fixtures_dir.exists():
            return []
        normalized = prompt_name.replace(".", "_")
        return sorted(
            path.name
            for path in self.fixtures_dir.glob("*.json")
            if path.stem.startswith(normalized)
        )

    def load_fixture(self, fixture_name: str) -> Dict[str, Any]:
        fixture_path = self.fixtures_dir / fixture_name
        return json.loads(fixture_path.read_text(encoding="utf-8"))

    def build_validation_error_message(self, prompt_name: str, variables: Dict[str, Any], system_template: Optional[str], user_template: Optional[str]) -> str:
        required_variables = self._registry().get_required_variables(
            prompt_name,
            overrides={
                "system_template": system_template,
                "user_template": user_template,
            },
        )
        missing = [key for key in required_variables if key not in variables]
        if missing:
            return f"缺少必要变量：{', '.join(missing)}"
        return "Prompt 变量校验失败"

    def _derive_template_path(self, prompt_name: str, role: str) -> str:
        namespace, key = prompt_name.split(".", 1)
        return f"templates/{namespace}/{key}.{role}.md"

    def _write_template(self, relative_path: str, content: str) -> None:
        path = self.prompts_dir / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def _update_catalog_entry(self, prompt_name: str, metadata: Dict[str, Any]) -> None:
        catalog_path = self.prompts_dir / "catalog.toml"
        with catalog_path.open("rb") as file:
            raw = tomllib.load(file)
        namespace, key = prompt_name.split(".", 1)
        raw["prompts"][namespace][key] = metadata
        catalog_path.write_text(self._dump_catalog(raw), encoding="utf-8")

    def _dump_catalog(self, raw: Dict[str, Any]) -> str:
        lines: List[str] = []
        for namespace, prompt_entries in raw.get("prompts", {}).items():
            for key, metadata in prompt_entries.items():
                lines.append(f"[prompts.{namespace}.{key}]")
                for field, value in metadata.items():
                    if value is None:
                        continue
                    if isinstance(value, str):
                        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
                        lines.append(f'{field} = "{escaped}"')
                    elif isinstance(value, bool):
                        lines.append(f"{field} = {'true' if value else 'false'}")
                    else:
                        lines.append(f"{field} = {value}")
                lines.append("")
        return "\n".join(lines).rstrip() + "\n"

    def _clear_registry_cache(self) -> None:
        from .registry import get_prompt_registry

        get_prompt_registry.cache_clear()

    def _build_fixture_examples(self, content: PromptContent) -> List[Dict[str, Any]]:
        suggested = self._build_suggested_variables(content)
        examples: List[Dict[str, Any]] = []
        for fixture_name in self._list_matching_fixtures(content.name):
            loaded = self.load_fixture(fixture_name)
            merged = {**suggested, **loaded}
            examples.append({"name": fixture_name, "data": merged, "generated": False})
        if not examples:
            examples.append({"name": "自动生成样例", "data": suggested, "generated": True})
        return examples

    def _build_suggested_variables(self, content: PromptContent) -> Dict[str, Any]:
        suggestions: Dict[str, Any] = {}
        for variable in content.required_variables:
            suggestions[variable] = self._suggest_value(variable)
        return suggestions

    def _build_optimized_draft(
        self,
        content: PromptContent,
        report: Dict[str, Any],
        focus: str,
    ) -> tuple[Optional[str], str, str, str]:
        llm_result = self._try_llm_optimized_draft(content, report, focus)
        if llm_result is not None:
            return (
                llm_result["optimized_system_template"],
                llm_result["optimized_user_template"],
                llm_result["change_summary"],
                "llm",
            )

        optimized_system = content.system_template
        optimized_user = content.user_template
        change_summary: List[str] = []

        if optimized_system and "只输出 JSON" not in optimized_system and content.output_format == "json":
            optimized_system = optimized_system.rstrip() + "\n你必须只输出 JSON，不要输出任何额外说明。"
            change_summary.append("为 system prompt 增加了严格 JSON-only 约束。")

        if "## 输出格式" not in optimized_user and content.output_format == "json":
            optimized_user = optimized_user.rstrip() + "\n\n## 输出格式\n只输出 JSON，不要其他内容。"
            change_summary.append("为 user prompt 增加了输出格式小节。")

        if "## 任务目标" not in optimized_user and len(optimized_user.splitlines()) <= 20:
            optimized_user = "## 任务目标\n" + optimized_user
            change_summary.append("补充了任务目标标题，增强结构清晰度。")

        if focus:
            optimized_user = optimized_user.rstrip() + f"\n\n## 优化重点\n请特别关注：{focus}"
            change_summary.append("根据用户指定 focus 增加了显式优化重点。")

        if not change_summary:
            change_summary.append("基于当前规则分析，保留原有结构，仅做轻量整理。")

        return optimized_system, optimized_user, " ".join(change_summary), "rule_based"

    def _try_llm_optimized_draft(
        self,
        content: PromptContent,
        report: Dict[str, Any],
        focus: str,
    ) -> Optional[Dict[str, Any]]:
        try:
            from app.core.config import settings
            if not settings.use_system_llm or not settings.deepseek_api_key:
                return None
        except Exception:
            return None

        async def _run() -> Dict[str, Any]:
            from openai import AsyncOpenAI
            from app.core.config import settings

            client = AsyncOpenAI(
                base_url=settings.deepseek_base_url,
                api_key=settings.deepseek_api_key,
                timeout=settings.default_llm_timeout,
            )
            system_prompt = (
                "你是一名提示词优化专家。"
                "你必须输出 JSON，并包含 optimized_system_template、optimized_user_template、change_summary 三个字段。"
                "如果 system prompt 不需要修改，可返回空字符串。"
            )
            user_payload = {
                "current_system_template": content.system_template or "",
                "current_user_template": content.user_template,
                "quality_report": report,
                "focus": focus,
                "requirements": [
                    "保持原始任务意图不变",
                    "强化结构清晰度和约束表达",
                    "尽量补足 JSON-only 等硬性约束",
                    "输出可直接替换到模板文件中的最终稿",
                ],
            }
            response = await client.chat.completions.create(
                model=settings.deepseek_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False, indent=2)},
                ],
                temperature=0.2,
                max_tokens=2200,
                response_format={"type": "json_object"},
            )
            content_text = response.choices[0].message.content or "{}"
            data = json.loads(content_text)
            return {
                "optimized_system_template": (data.get("optimized_system_template") or "").strip() or content.system_template,
                "optimized_user_template": (data.get("optimized_user_template") or "").strip() or content.user_template,
                "change_summary": (data.get("change_summary") or "已使用当前模型生成优化稿。").strip(),
            }

        try:
            return asyncio.run(_run())
        except Exception:
            return None

    def _apply_replacement(self, original: str, matched_text: str, replacement_text: str) -> str:
        if matched_text and matched_text in original:
            return original.replace(matched_text, replacement_text, 1)
        if replacement_text not in original:
            return original.rstrip() + "\n\n" + replacement_text
        return original

    def _suggest_value(self, variable_name: str) -> Any:
        explicit: Dict[str, Any] = {
            "subject_name": "Python",
            "subject_context": "Focus on Python syntax, data structures, and coding best practices.",
            "question_distribution": "Coding 70%, MCQ 30%",
            "subject_scope_constraints": "所有任务必须严格属于 Python 学科范围。",
            "subject_task_examples_section": "## 任务表达示例（参考）\n- 阅读一段示例代码并分析输出\n- 完成一个 20 分钟的列表练习\n",
            "level": "初级",
            "goal": "掌握函数、列表和条件判断",
            "overall_total_days": 21,
            "total_days": 21,
            "generate_days": 7,
            "start_day": 8,
            "end_day": 14,
            "daily_minutes": 45,
            "ability_tags_detail": "- 函数: 55/100\n- 列表: 62/100\n- 条件判断: 70/100",
            "weak_areas": "- 函数参数设计薄弱\n- 列表推导式练习不足",
            "learning_stats": "- 已完成题目: 12/30\n- 平均正确率: 68%\n- 连续学习: 4 天\n- 最近7天学习时长: 135 分钟",
            "existing_days_json": json.dumps(
                [
                    {
                        "day": 1,
                        "theme": "函数基础",
                        "tasks": [{"id": "task_1_1", "title": "理解函数定义"}],
                    },
                    {
                        "day": 2,
                        "theme": "列表操作",
                        "tasks": [{"id": "task_2_1", "title": "列表切片练习"}],
                    },
                ],
                ensure_ascii=False,
                indent=2,
            ),
            "assessment_data": json.dumps(
                [{"category": "函数", "is_correct": False}, {"category": "循环", "is_correct": True}],
                ensure_ascii=False,
                indent=2,
            ),
            "question_type": "short_answer",
            "question": "请解释 Python 中列表和元组的区别。",
            "rubric": "说明可变性、语法和典型使用场景",
            "answer": "列表可变，元组不可变。",
            "ability_tags": json.dumps({"函数": 55, "列表": 62}, ensure_ascii=False),
            "weaknesses": json.dumps({"函数": 3, "列表推导式": 2}, ensure_ascii=False),
            "level_description": "初学者，已掌握基础语法",
            "exercises_list": "- ID: ex-1 | 标题: 列表练习 | 难度: 中等 | 知识点: 列表\n- ID: ex-2 | 标题: 函数练习 | 难度: 较难 | 知识点: 函数",
            "item_type": "mcq",
            "stem": "以下哪个选项会返回列表长度？",
            "options_block": "\n选项:\nA. len(x)\nB. size(x)\nC. list.len()\nD. count(x)",
            "hint_level": 2,
            "level_hint": "指出关键概念或思路",
            "node_title": "列表推导式",
            "node_description": "用一行表达式构建列表",
            "node_code": "python.basics.list_comprehension",
            "count": 2,
            "difficulty_desc": "中等",
            "difficulty": 3,
            "type_prompt": "题型：选择题。每题提供 4 个选项，仅 1 个正确答案。",
            "topic_clause": "，主题为“列表推导式”",
            "topic_requirement": "\n4. 题目应紧扣“列表推导式”主题，避免偏题",
            "reference_answer_section": "参考答案：列表可变，元组不可变。",
            "name": "学习者A",
            "topic": "函数",
        }
        if variable_name in explicit:
            return explicit[variable_name]
        if re.search(r"(days|minutes|count|difficulty|tokens|day)$", variable_name):
            return 1
        if variable_name.endswith("_json"):
            return "{}"
        return f"<{variable_name}>"
