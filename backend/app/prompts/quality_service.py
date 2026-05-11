"""
Prompt quality analysis and optimization helpers.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .registry import PromptContent


class PromptQualityService:
    """Analyze prompt quality with deterministic rules and summaries."""

    DIMENSION_WEIGHTS = {
        "结构清晰度": 25,
        "意图表达": 20,
        "约束完整性": 25,
        "变量健壮性": 10,
        "可执行性": 20,
    }

    def extract_required_variables(self, system_template: Optional[str], user_template: str) -> List[str]:
        pattern = re.compile(r"{([a-zA-Z0-9_]+)}")
        fields = set(pattern.findall(system_template or "")) | set(pattern.findall(user_template))
        return sorted(fields)

    def analyze(self, content: PromptContent) -> Dict[str, Any]:
        issues: List[Dict[str, Any]] = []
        structure_score = self._score_structure(content, issues)
        intent_score = self._score_intent(content, issues)
        constraints_score = self._score_constraints(content, issues)
        variable_score = self._score_variables(content, issues)
        executable_score = self._score_executability(content, issues)

        dimensions = [
            {"name": "结构清晰度", "score": structure_score, "reason": "根据段落、标题和层次结构评估"},
            {"name": "意图表达", "score": intent_score, "reason": "根据任务目标是否具体明确评估"},
            {"name": "约束完整性", "score": constraints_score, "reason": "根据输出格式、禁止项和边界条件评估"},
            {"name": "变量健壮性", "score": variable_score, "reason": "根据变量数量、样例和命名一致性评估"},
            {"name": "可执行性", "score": executable_score, "reason": "根据 Prompt 是否足够具体可执行评估"},
        ]

        score = round(
            structure_score * 0.25
            + intent_score * 0.20
            + constraints_score * 0.25
            + variable_score * 0.10
            + executable_score * 0.20
        )

        grade = "优秀" if score >= 90 else "良好" if score >= 75 else "合格" if score >= 60 else "待优化"
        improvement_suggestions = [issue["suggestion"] for issue in issues[:5]]
        summary = self._build_summary(score, grade, issues)

        return {
            "score": score,
            "grade": grade,
            "dimensions": dimensions,
            "issues": issues,
            "summary": summary,
            "improvement_suggestions": improvement_suggestions,
        }

    def _score_structure(self, content: PromptContent, issues: List[Dict[str, Any]]) -> int:
        text = "\n".join(filter(None, [content.system_template or "", content.user_template]))
        has_sections = "## " in text or "### " in text
        line_count = len([line for line in text.splitlines() if line.strip()])
        score = 88
        if not has_sections:
            score -= 22
            issues.append(self._issue(
                "medium",
                "结构不清晰",
                "Prompt 缺少明确章节或层级标题，信息容易堆叠。",
                "建议增加“任务目标 / 输入信息 / 输出约束 / 注意事项”等小节标题。",
                "user",
                content.user_template[:120],
            ))
        if line_count < 6:
            score -= 10
        return max(min(score, 100), 30)

    def _score_intent(self, content: PromptContent, issues: List[Dict[str, Any]]) -> int:
        user_template = content.user_template
        score = 84
        if not any(keyword in user_template for keyword in ["请", "生成", "输出", "分析", "优化"]):
            score -= 18
        if len(user_template.strip()) < 40:
            score -= 12
            issues.append(self._issue(
                "medium",
                "任务目标偏模糊",
                "Prompt 对模型要完成的任务描述过短，可能导致输出方向不稳定。",
                "建议明确说明“要做什么、输入是什么、输出是什么”。",
                "user",
                user_template[:80],
            ))
        return max(min(score, 100), 35)

    def _score_constraints(self, content: PromptContent, issues: List[Dict[str, Any]]) -> int:
        text = "\n".join(filter(None, [content.system_template or "", content.user_template]))
        score = 86
        mentions_json = "JSON" in text.upper()
        json_only = "只输出 JSON" in text or "只能输出 JSON" in text or "only output json" in text.lower()
        if mentions_json and not json_only:
            score -= 22
            issues.append(self._issue(
                "high",
                "输出约束不完整",
                "Prompt 提到了 JSON，但没有明确要求模型只能输出 JSON。",
                "建议补充“只输出 JSON，不要其他内容”之类的硬约束。",
                "user",
                content.user_template[:120],
                replacement_text="只输出 JSON，不要其他内容。",
            ))
        if "禁止" not in text and "不要" not in text:
            score -= 8
        return max(min(score, 100), 25)

    def _score_variables(self, content: PromptContent, issues: List[Dict[str, Any]]) -> int:
        score = 90
        variable_count = len(content.required_variables)
        if variable_count >= 8:
            score -= 12
            issues.append(self._issue(
                "medium",
                "变量较多，建议强化样例",
                "当前 Prompt 依赖的模板变量较多，手动测试时容易漏传。",
                "建议提供一组推荐变量样例，并在 Prompt 中保持变量命名一致。",
                "params",
                ", ".join(content.required_variables),
            ))
        return max(min(score, 100), 40)

    def _score_executability(self, content: PromptContent, issues: List[Dict[str, Any]]) -> int:
        text = "\n".join(filter(None, [content.system_template or "", content.user_template]))
        score = 82
        if "例如" not in text and "示例" not in text and "输出格式" not in text:
            score -= 12
        if "必须" not in text and "严格" not in text:
            score -= 10
            issues.append(self._issue(
                "low",
                "执行约束可以更强",
                "Prompt 有任务描述，但对关键要求的强调还不够强。",
                "建议使用“必须/严格/只能”等词强化硬约束。",
                "user",
                content.user_template[:120],
            ))
        return max(min(score, 100), 35)

    def _build_summary(self, score: int, grade: str, issues: List[Dict[str, Any]]) -> str:
        if not issues:
            return f"当前 Prompt 总体质量较高，评分 {score} 分（{grade}），结构和约束都比较稳定。"
        high_count = sum(1 for issue in issues if issue["severity"] == "high")
        if high_count:
            return f"当前 Prompt 评分 {score} 分（{grade}），主要问题集中在硬约束表达和输出稳定性。"
        return f"当前 Prompt 评分 {score} 分（{grade}），整体可用，但在结构组织和执行约束上仍有优化空间。"

    def _issue(
        self,
        severity: str,
        title: str,
        problem: str,
        suggestion: str,
        target_section: str,
        matched_text: str,
        replacement_text: Optional[str] = None,
    ) -> Dict[str, Any]:
        issue_id = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "issue"
        return {
            "id": issue_id,
            "severity": severity,
            "title": title,
            "problem": problem,
            "suggestion": suggestion,
            "target_section": target_section,
            "matched_text": matched_text,
            "replacement_text": replacement_text,
        }
