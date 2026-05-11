"""
概念学习内容生成API
提供流式生成AI学习内容的端点，支持内容缓存和练习题提取
"""
import asyncio
import json
import logging
import re
from typing import Any, Dict, Optional, List
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from openai import AsyncOpenAI

from ..core.database import get_db, get_session
from ..core.llm_limits import clamp_llm_output_tokens
from ..services.llm_service import LLMServiceFactory
from ..services.encryption import decrypt_api_key
from ..models.llm_config import UserLLMConfig
from ..models.concept_content import ConceptContent
from ..models.subject import ExerciseItem, Subject, QuestionGroup
from ..prompts.registry import PromptRenderError, get_prompt_registry
from ..models.base import utcnow_naive

router = APIRouter()
logger = logging.getLogger(__name__)


class GenerateConceptContentRequest(BaseModel):
    """生成概念学习内容请求"""
    task_id: str
    task_title: str
    subject: str = "Python"
    description: str
    duration_minutes: int = 20
    resources: list[str] = []
    learning_path_id: Optional[str] = None
    learning_path_version: Optional[int] = None
    learning_path_version_name: Optional[str] = None
    source_day: Optional[int] = None
    source_chapter_id: Optional[str] = None
    source_chapter_title: Optional[str] = None
    source_task_title: Optional[str] = None
    source_scope_key: Optional[str] = None
    diagram_only: bool = False
    existing_content: Optional[str] = None
    target_headings: Optional[List[str]] = None
    concept_map: Optional[Dict[str, Any]] = None



class ConceptContentResponse(BaseModel):
    """概念内容响应"""
    task_id: str
    task_title: str
    subject: str
    content: Optional[str] = None
    reasoning: Optional[str] = None
    learning_path_id: Optional[str] = None
    learning_path_version: Optional[int] = None
    learning_path_version_name: Optional[str] = None
    source_day: Optional[int] = None
    source_chapter_id: Optional[str] = None
    source_chapter_title: Optional[str] = None
    source_task_title: Optional[str] = None
    source_scope_key: Optional[str] = None
    concept_map: Optional[Dict[str, Any]] = None
    markmap_markdown: Optional[str] = None
    created_at: Optional[datetime] = None
    exists: bool = False


class GenerateConceptExercisesRequest(BaseModel):
    task_id: str
    task_title: str
    subject: str = "Python"
    subject_key: Optional[str] = None
    description: str = ""
    article_content: str
    concept_map: Optional[Dict[str, Any]] = None
    learning_path_id: Optional[str] = None
    learning_path_version: Optional[int] = None
    learning_path_version_name: Optional[str] = None
    source_day: Optional[int] = None
    source_chapter_id: Optional[str] = None
    source_chapter_title: Optional[str] = None
    source_task_title: Optional[str] = None
    source_scope_key: Optional[str] = None


class GenerateConceptExercisesResponse(BaseModel):
    success: bool
    exercises_count: int = 0
    raw_content: str = ""
    group_id: Optional[str] = None
    exercises: List[dict] = []


def build_source_scope_key(
    *,
    task_id: str,
    learning_path_id: Optional[str] = None,
    learning_path_version: Optional[int] = None,
    source_chapter_id: Optional[str] = None,
    source_day: Optional[int] = None,
    source_scope_key: Optional[str] = None,
) -> str:
    if source_scope_key:
        return source_scope_key
    if learning_path_id and learning_path_version is not None:
        chapter_scope = source_chapter_id or (f"day-{source_day}" if source_day is not None else "chapter")
        return f"concept_learning:{learning_path_id}:v{learning_path_version}:{chapter_scope}:{task_id}"
    return f"concept_learning:legacy:{task_id}"


def coerce_user_uuid(user_id: str | UUID) -> UUID:
    return user_id if isinstance(user_id, UUID) else UUID(str(user_id))

REASONING_ENVELOPE_VERSION = 1


def _fix_latex_backslashes_in_json(text: str) -> str:
    """Fix unescaped LaTeX backslash commands inside JSON string values.

    LLMs frequently emit JSON like {"summary": "$\\varepsilon$"} where the
    backslash before LaTeX commands (\\varepsilon, \\lim, \\infty …) is NOT a
    valid JSON escape sequence (\\v, \\l, \\i are illegal).  We fix this by
    doubling every backslash that is NOT already part of a recognised JSON
    escape (\\", \\\\, \\/, \\b, \\f, \\n, \\r, \\t, \\uXXXX).
    """
    # Only operate inside JSON string values (between unescaped quotes).
    _VALID_JSON_ESCAPES = re.compile(
        r'\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})'
    )

    def _fix_string_value(m: re.Match) -> str:
        """Process a single JSON string token."""
        raw = m.group(0)
        inner = raw[1:-1]  # strip surrounding quotes
        result: list[str] = []
        i = 0
        while i < len(inner):
            if inner[i] == '\\':
                remaining = inner[i:]
                esc_match = _VALID_JSON_ESCAPES.match(remaining)
                if esc_match:
                    result.append(esc_match.group(0))
                    i += len(esc_match.group(0))
                else:
                    # Not a valid JSON escape – double the backslash
                    result.append('\\\\')
                    i += 1
            else:
                result.append(inner[i])
                i += 1
        return '"' + ''.join(result) + '"'

    # Match JSON string tokens (handles escaped quotes inside strings)
    return re.sub(r'"(?:[^"\\]|\\.)*"', _fix_string_value, text)


def _clean_llm_json_text(raw_text: str) -> str:
    text = raw_text.strip()
    # Try complete fenced block first
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()
    else:
        # Handle truncated fenced block (no closing ```) — e.g. max_tokens hit
        open_fence = re.match(r"```(?:json)?\s*", text)
        if open_fence:
            text = text[open_fence.end():].strip()
    return text


def _try_repair_truncated_json(text: str) -> dict | None:
    """Attempt to repair JSON truncated by max_tokens by closing open structures.

    Uses a character-level scanner to find the last position where all JSON
    strings are properly closed, strips any trailing incomplete tokens, then
    progressively tries to close unclosed brackets / braces.

    Returns the parsed dict on success, or None if repair fails.
    """
    if not text or not text.strip():
        return None

    # --- Phase 1: find the last safe cut point (all strings closed) ---
    in_string = False
    escape = False
    last_string_closed_pos = 0  # position right after the last closing quote

    for i, ch in enumerate(text):
        if escape:
            escape = False
            continue
        if in_string:
            if ch == '\\':
                escape = True
            elif ch == '"':
                in_string = False
                last_string_closed_pos = i + 1
        else:
            if ch == '"':
                in_string = True

    # If we're still inside a string, truncate to the last closed position
    if in_string:
        text = text[:last_string_closed_pos]

    # --- Phase 2: strip trailing incomplete tokens iteratively ---
    for _ in range(5):
        stripped = text.rstrip()
        stripped = re.sub(r',\s*$', '', stripped)
        stripped = re.sub(r':\s*$', '', stripped)
        stripped = re.sub(r',\s*"[^"]*"\s*$', '', stripped)
        if stripped == text.rstrip():
            break
        text = stripped

    text = text.rstrip()

    # --- Phase 3: progressive truncation to last complete structure ---
    # Collect positions of structure-closing characters (}, ]) outside strings
    # so we can try truncating to each one if simple closure fails.
    close_positions: list[int] = []
    in_string = False
    escape = False
    for i, ch in enumerate(text):
        if escape:
            escape = False
            continue
        if in_string:
            if ch == '\\':
                escape = True
            elif ch == '"':
                in_string = False
        else:
            if ch == '"':
                in_string = True
            elif ch in ('}', ']'):
                close_positions.append(i)

    # Try from the current end first, then progressively truncate
    # to the last }, ], etc.
    candidates = [text] + [text[:pos + 1] for pos in reversed(close_positions[-10:])]

    for candidate in candidates:
        # Count unclosed structures
        opens = 0
        open_sq = 0
        in_str = False
        esc = False
        for ch in candidate:
            if esc:
                esc = False
                continue
            if in_str:
                if ch == '\\':
                    esc = True
                elif ch == '"':
                    in_str = False
            else:
                if ch == '"':
                    in_str = True
                elif ch == '{':
                    opens += 1
                elif ch == '}':
                    opens -= 1
                elif ch == '[':
                    open_sq += 1
                elif ch == ']':
                    open_sq -= 1

        # Remove trailing comma before closing
        attempt = candidate.rstrip()
        attempt = re.sub(r',\s*$', '', attempt)
        attempt += ']' * max(open_sq, 0)
        attempt += '}' * max(opens, 0)

        try:
            parsed = json.loads(attempt)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue

    return None


def decode_reasoning_payload(reasoning: Optional[str]) -> tuple[str, Optional[Dict[str, Any]], Optional[str]]:
    if not reasoning:
        return "", None, None

    try:
        payload = json.loads(reasoning)
    except json.JSONDecodeError:
        return reasoning, None, None

    if not isinstance(payload, dict):
        return reasoning, None, None

    reasoning_text = payload.get("reasoning_text")
    concept_map = payload.get("concept_map")
    markmap_markdown = payload.get("markmap_markdown")
    return (
        reasoning_text if isinstance(reasoning_text, str) else "",
        concept_map if isinstance(concept_map, dict) else None,
        markmap_markdown if isinstance(markmap_markdown, str) else None,
    )


def encode_reasoning_payload(
    reasoning_text: str,
    concept_map: Optional[Dict[str, Any]] = None,
    markmap_markdown: Optional[str] = None,
) -> str:
    if concept_map is None and not markmap_markdown:
        return reasoning_text

    return json.dumps(
        {
            "version": REASONING_ENVELOPE_VERSION,
            "reasoning_text": reasoning_text,
            "concept_map": concept_map,
            "markmap_markdown": markmap_markdown,
        },
        ensure_ascii=False,
    )


def build_fallback_concept_map(request: GenerateConceptContentRequest) -> Dict[str, Any]:
    root_id = "core-topic"
    return {
        "root": request.task_title,
        "chapter_order": [root_id],
        "nodes": [
            {
                "id": root_id,
                "title": request.task_title,
                "summary": request.description or f"围绕 {request.task_title} 的核心理解路径。",
                "examples": request.resources[:1] or [f"结合 {request.subject} 示例解释 {request.task_title}。"],
                "pitfalls": [f"避免只记结论而忽略 {request.task_title} 的适用边界。"],
                "prerequisites": [],
                "section_level": 2,
            }
        ],
        "edges": [],
    }


def ensure_string_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [item.strip() for item in value if isinstance(item, str) and item.strip()]
    if isinstance(value, str) and value.strip():
        normalized = value.replace("；", "\n").replace("。", "\n").replace("，", "\n")
        return [item.strip(" -•\t") for item in normalized.splitlines() if item.strip(" -•\t")]
    return []


_LATEX_TO_UNICODE: list[tuple[str, str]] = [
    # Greek letters
    (r"\varepsilon", "ε"), (r"\epsilon", "ε"), (r"\delta", "δ"),
    (r"\alpha", "α"), (r"\beta", "β"), (r"\gamma", "γ"),
    (r"\lambda", "λ"), (r"\mu", "μ"), (r"\sigma", "σ"),
    (r"\pi", "π"), (r"\theta", "θ"), (r"\phi", "φ"),
    (r"\omega", "ω"), (r"\Omega", "Ω"), (r"\Delta", "Δ"),
    (r"\Sigma", "Σ"), (r"\Pi", "Π"), (r"\Gamma", "Γ"),
    # Operators & symbols
    (r"\infty", "∞"), (r"\to", "→"), (r"\rightarrow", "→"),
    (r"\leftarrow", "←"), (r"\Rightarrow", "⇒"), (r"\Leftarrow", "⇐"),
    (r"\leftrightarrow", "↔"), (r"\Leftrightarrow", "⇔"),
    (r"\leq", "≤"), (r"\geq", "≥"), (r"\neq", "≠"),
    (r"\approx", "≈"), (r"\equiv", "≡"), (r"\sim", "∼"),
    (r"\pm", "±"), (r"\times", "×"), (r"\cdot", "·"),
    (r"\forall", "∀"), (r"\exists", "∃"), (r"\in", "∈"),
    (r"\notin", "∉"), (r"\subset", "⊂"), (r"\subseteq", "⊆"),
    (r"\cup", "∪"), (r"\cap", "∩"), (r"\emptyset", "∅"),
    (r"\partial", "∂"), (r"\nabla", "∇"),
    # Functions – replace with plain name
    (r"\lim", "lim"), (r"\sin", "sin"), (r"\cos", "cos"),
    (r"\tan", "tan"), (r"\log", "log"), (r"\ln", "ln"),
    (r"\exp", "exp"), (r"\max", "max"), (r"\min", "min"),
    # Escaped characters
    (r"\{", "{"), (r"\}", "}"), (r"\_", "_"), (r"\^", "^"),
]


def _latex_to_unicode(text: str) -> str:
    """Convert LaTeX math expressions to readable Unicode text for markmap nodes."""
    # Normalize newlines – markmap nodes must be single-line
    text = text.replace('\\n', ' ').replace('\n', ' ').replace('\r', ' ')
    # Process inline math $...$  – convert contents, strip delimiters
    def _convert_math(m: re.Match) -> str:
        inner = m.group(1)
        for cmd, repl in _LATEX_TO_UNICODE:
            inner = inner.replace(cmd, repl)
        # Clean up common LaTeX constructs
        inner = re.sub(r'\{([^{}]*)\}', r'\1', inner)   # {x} → x
        inner = re.sub(r'_([a-zA-Z0-9])', r'_\1', inner)  # keep simple subscripts
        inner = re.sub(r'\^([a-zA-Z0-9])', r'^\1', inner)  # keep simple superscripts
        inner = re.sub(r'\\[a-zA-Z]+', '', inner)  # remove any remaining commands
        inner = inner.replace('\\', '') # strip any leftover backslash
        inner = re.sub(r'\s+', ' ', inner).strip()
        return inner
    text = re.sub(r'\$\$([^$]+)\$\$', _convert_math, text)
    text = re.sub(r'\$([^$]+)\$', _convert_math, text)
    # Also convert bare LaTeX commands outside math delimiters
    for cmd, repl in _LATEX_TO_UNICODE:
        text = text.replace(cmd, repl)
    text = re.sub(r'\\[a-zA-Z]+', '', text)
    # Collapse whitespace and cleanup
    text = text.replace('\\', '') # strip any leftover backslash
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'[（(]\s*[)）]', '', text).strip()
    return text


def _is_id_like(value: str) -> bool:
    """Return True if the string looks like a snake_case identifier rather than a human title."""
    return bool(re.match(r'^[a-z][a-z0-9_]*$', value))


def export_concept_map_to_markmap(concept_map: Dict[str, Any], task_title: str = "") -> str:
    root = concept_map.get("root") or ""
    # If root looks like a code identifier, prefer task_title
    if _is_id_like(root) or not root:
        root = task_title or root.replace('_', ' ') or "概念学习"
    nodes = concept_map.get("nodes") or []
    chapter_order = concept_map.get("chapter_order") or [node.get("id") for node in nodes if isinstance(node, dict)]
    node_lookup = {
        node.get("id"): node for node in nodes if isinstance(node, dict) and isinstance(node.get("id"), str)
    }

    lines = [f"# {_latex_to_unicode(root)}"]
    for node_id in chapter_order:
        node = node_lookup.get(node_id)
        if not node:
            continue

        title = _latex_to_unicode(node.get("title") or node_id)
        lines.append(f"## {title}")

    return "\n".join(lines)


def derive_concept_map_from_markmap(markmap_markdown: str, task_title: str = "") -> Dict[str, Any]:
    """Derive a lightweight concept map structure from markmap markdown headings.
    
    This is the inverse of export_concept_map_to_markmap: given markdown with 
    `# Root`, `## Chapter`, `### Sub-topic` headings, produce a concept map dict
    that can be used for article generation and exercise building.
    """
    lines = markmap_markdown.strip().splitlines()
    root = task_title or "概念学习"
    nodes = []
    chapter_order = []
    current_chapter_id = None

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("# ") and not stripped.startswith("## "):
            root = stripped[2:].strip()
        elif stripped.startswith("## ") and not stripped.startswith("### "):
            title = stripped[3:].strip()
            node_id = f"section-{len(nodes) + 1}"
            chapter_order.append(node_id)
            current_chapter_id = node_id
            nodes.append({
                "id": node_id,
                "title": title,
                "summary": f'围绕「{title}」展开学习。',
                "examples": [],
                "pitfalls": [],
                "prerequisites": [chapter_order[-2]] if len(chapter_order) > 1 else [],
                "section_level": 2,
            })
        elif stripped.startswith("### "):
            sub_title = stripped[4:].strip()
            sub_id = f"sub-{len(nodes) + 1}"
            nodes.append({
                "id": sub_id,
                "title": sub_title,
                "summary": "",
                "examples": [],
                "pitfalls": [],
                "prerequisites": [current_chapter_id] if current_chapter_id else [],
                "section_level": 3,
            })

    edges = []
    for i in range(len(chapter_order) - 1):
        edges.append({
            "source": chapter_order[i],
            "target": chapter_order[i + 1],
            "relation_type": "prerequisite",
            "label": "前置",
        })

    return {
        "root": root,
        "chapter_order": chapter_order,
        "nodes": nodes,
        "edges": edges,
    }


def build_target_headings_json(target_headings: Optional[List[str]]) -> str:
    return json.dumps(target_headings or [], ensure_ascii=False)


def serialize_concept_map(concept_map: Optional[Dict[str, Any]]) -> str:
    return json.dumps(concept_map or {}, ensure_ascii=False, indent=2)


async def render_prompt_messages(prompt_name: str, variables: Dict[str, Any]) -> tuple[list[dict[str, str]], float, int]:
    registry = get_prompt_registry()
    try:
        messages = registry.render_messages(prompt_name, variables)
    except PromptRenderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    definition = registry.get_definition(prompt_name)
    max_tokens = clamp_llm_output_tokens(definition.max_tokens)
    return messages, definition.temperature, max_tokens

def parse_generated_exercises_json(raw_content: str) -> List[dict]:
    cleaned = _clean_llm_json_text(raw_content)

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.warning("习题 JSON 解析失败: %s", exc)
        return []

    if isinstance(payload, list):
        exercises = payload
    elif isinstance(payload, dict):
        exercises = payload.get("exercises", [])
    else:
        return []

    normalized: List[dict] = []
    for item in exercises:
        if not isinstance(item, dict):
            continue

        title = next(
            (
                value.strip()
                for value in [
                    item.get("title"),
                    item.get("question"),
                    item.get("stem"),
                ]
                if isinstance(value, str) and value.strip()
            ),
            "",
        )
        if not title:
            continue

        description = next(
            (
                value.strip()
                for value in [
                    item.get("description"),
                    item.get("prompt"),
                    item.get("content"),
                    item.get("body"),
                ]
                if isinstance(value, str) and value.strip()
            ),
            "",
        )

        raw_options = item.get("options", [])
        normalized_options: List[dict] = []
        if isinstance(raw_options, list):
            for index, option in enumerate(raw_options):
                fallback_label = chr(65 + index)
                if isinstance(option, str) and option.strip():
                    normalized_options.append({
                        "label": fallback_label,
                        "text": option.strip(),
                    })
                    continue
                if isinstance(option, dict):
                    text = next(
                        (
                            value.strip()
                            for value in [
                                option.get("text"),
                                option.get("content"),
                                option.get("value"),
                                option.get("description"),
                            ]
                            if isinstance(value, str) and value.strip()
                        ),
                        "",
                    )
                    if not text:
                        continue
                    label = option.get("label")
                    normalized_options.append({
                        "label": label.strip() if isinstance(label, str) and label.strip() else fallback_label,
                        "text": text,
                    })

        normalized_type = item.get("type", "coding")
        if normalized_options:
            normalized_type = "mcq"
        elif item.get("initial_code") or isinstance(item.get("test_cases"), list):
            normalized_type = "coding"
        elif isinstance(item.get("answer_key"), list):
            normalized_type = "fill_blank"
        elif normalized_type not in {"mcq", "fill_blank", "coding", "short_answer", "essay"}:
            normalized_type = "short_answer"

        normalized.append(
            {
                "type": normalized_type,
                "title": title,
                "description": description,
                "hint": item.get("hint", "") if isinstance(item.get("hint"), str) else "",
                "difficulty": int(item.get("difficulty", 2)) if str(item.get("difficulty", "")).isdigit() else 2,
                "answer": item.get("answer", "") if isinstance(item.get("answer"), str) else "",
                "answer_key": item.get("answer_key"),
                "options": normalized_options,
                "initial_code": item.get("initial_code"),
                "test_cases": item.get("test_cases", []) if isinstance(item.get("test_cases"), list) else [],
            }
        )

    return normalized


def build_fallback_exercises_from_concept_map(
    task_title: str,
    concept_map: Optional[Dict[str, Any]],
) -> List[dict]:
    nodes = concept_map.get("nodes", []) if isinstance(concept_map, dict) else []
    normalized_nodes = [node for node in nodes if isinstance(node, dict)][:3]

    if not normalized_nodes:
        return [
            {
                "type": "short_answer",
                "title": f"{task_title} 核心理解",
                "description": f"请用自己的话解释“{task_title}”的核心概念，并说明它适用于什么场景。",
                "hint": "可以从定义、适用场景和一个简单示例入手。",
                "difficulty": 2,
                "answer_key": "",
                "options": [],
                "initial_code": None,
                "test_cases": [],
                "answer": "",
            }
        ]

    fallback_exercises: List[dict] = []
    for index, node in enumerate(normalized_nodes, start=1):
        title = str(node.get("title", f"知识点 {index}")).strip()
        summary = str(node.get("summary", "")).strip()
        pitfalls = ensure_string_list(node.get("pitfalls"))
        examples = ensure_string_list(node.get("examples"))
        fallback_exercises.append(
            {
                "type": "short_answer",
                "title": f"{title} 理解题",
                "description": (
                    f"请结合本章节内容解释“{title}”。"
                    + (f"要求覆盖：{summary}" if summary else "")
                    + (f" 并说明一个常见误区：{pitfalls[0]}" if pitfalls else "")
                ),
                "hint": examples[0] if examples else "结合正文中的定义、示例和易错点组织答案。",
                "difficulty": min(4, 1 + index),
                "answer_key": summary or title,
                "options": [],
                "initial_code": None,
                "test_cases": [],
                "answer": "",
            }
        )

    return fallback_exercises


async def save_exercises_to_db(
    db: AsyncSession,
    exercises: List[dict],
    user_id: str,
    task_id: str,
    task_title: str,
    subject_key: str,
    learning_path_id: Optional[str] = None,
    learning_path_version: Optional[int] = None,
    learning_path_version_name: Optional[str] = None,
    source_day: Optional[int] = None,
    source_chapter_id: Optional[str] = None,
    source_chapter_title: Optional[str] = None,
    source_task_title: Optional[str] = None,
    source_scope_key: Optional[str] = None,
) -> Optional[str]:
    """将提取的练习题保存到数据库"""
    if not exercises:
        return None
    
    try:
        normalized_user_id = coerce_user_uuid(user_id)
        # 获取学科ID
        subject_result = await db.execute(
            select(Subject).where(Subject.key == subject_key.lower())
        )
        subject = subject_result.scalar_one_or_none()
        
        if not subject:
            # 默认使用 python 学科
            subject_result = await db.execute(
                select(Subject).where(Subject.key == "python")
            )
            subject = subject_result.scalar_one_or_none()
        
        if not subject:
            subject = (
                await db.execute(
                    select(Subject).where(Subject.name == subject_key)
                )
            ).scalar_one_or_none()

        if not subject:
            logger.warning(f"未找到学科: {subject_key}")
            return None

        scope_key = build_source_scope_key(
            task_id=task_id,
            learning_path_id=learning_path_id,
            learning_path_version=learning_path_version,
            source_chapter_id=source_chapter_id,
            source_day=source_day,
            source_scope_key=source_scope_key,
        )

        # 创建或更新题组
        group_result = await db.execute(
            select(QuestionGroup).where(
                QuestionGroup.user_id == normalized_user_id,
                QuestionGroup.source_type == "concept_learning",
                QuestionGroup.source_scope_key == scope_key,
            )
        )
        question_group = group_result.scalar_one_or_none()
        if question_group:
            question_group.subject_id = subject.id
            question_group.title = task_title
            question_group.source_annotation = source_chapter_title or task_title
            question_group.learning_path_id = learning_path_id
            question_group.learning_path_version = learning_path_version
            question_group.learning_path_version_name = learning_path_version_name
            question_group.source_day = source_day
            question_group.source_chapter_id = source_chapter_id
            question_group.source_chapter_title = source_chapter_title
            question_group.source_task_title = source_task_title or task_title
            question_group.source_scope_key = scope_key
            question_group.item_count = len(exercises)
            question_group.last_synced_at = datetime.now(timezone.utc)
        else:
            question_group = QuestionGroup(
                user_id=normalized_user_id,
                source_type="concept_learning",
                source_task_id=task_id,
                source_annotation=source_chapter_title or task_title,
                learning_path_id=learning_path_id,
                learning_path_version=learning_path_version,
                learning_path_version_name=learning_path_version_name,
                source_day=source_day,
                source_chapter_id=source_chapter_id,
                source_chapter_title=source_chapter_title,
                source_task_title=source_task_title or task_title,
                source_scope_key=scope_key,
                subject_id=subject.id,
                title=task_title,
                status="active",
                item_count=len(exercises),
                last_synced_at=utcnow_naive(),
            )
            db.add(question_group)
            await db.flush()

        # 先删除该任务之前生成的练习题（避免重复）
        await db.execute(
            delete(ExerciseItem).where(
                ExerciseItem.question_group_id == question_group.id
            )
        )
        
        # 保存新的练习题
        for ex in exercises:
            q_type = ex.get('type', 'coding')

            # 构建 answer_key 和 options 根据题型
            answer_key = None
            options = None
            initial_code = None
            test_cases = None
            expected_output = None

            if q_type == 'mcq':
                answer_key = ex.get('answer_key', '')  # e.g. "B"
                raw_options = ex.get('options', [])
                if raw_options:
                    options = []
                    answer_key_text = str(answer_key).strip().upper() if answer_key is not None else ""
                    for opt in raw_options:
                        if not isinstance(opt, dict):
                            continue
                        label = str(opt.get("label", "")).strip()
                        text = str(opt.get("text", "")).strip()
                        if not text:
                            continue
                        is_correct = False
                        if answer_key_text:
                            is_correct = label.upper() == answer_key_text or text == str(answer_key).strip()
                        options.append({
                            "label": label or text[:1].upper(),
                            "text": text,
                            "is_correct": is_correct,
                        })
            elif q_type == 'fill_blank':
                raw_ak = ex.get('answer_key', '')
                answer_key = [a.strip() for a in raw_ak.split(',') if a.strip()]
            elif q_type == 'coding':
                code_answer = ex.get('answer', '')
                answer_key = {"code": code_answer} if code_answer else None
                initial_code = ex.get('initial_code')
                test_cases = ex.get('test_cases')
                # 从 test_cases 提取第一个预期输出作为 expected_output
                if test_cases and len(test_cases) > 0:
                    expected_output = test_cases[0].get('expected_output', '')
            elif q_type in ('short_answer', 'essay'):
                answer_key = ex.get('answer_key', '')
            else:
                answer_key = ex.get('answer_key') or ex.get('answer')

            exercise_item = ExerciseItem(
                subject_id=subject.id,
                source_annotation=task_title,
                question_group_id=question_group.id,
                source_type="concept_learning",
                source_task_id=task_id,
                item_type=q_type,
                stem=f"**{ex.get('title', '练习题')}**\n\n{ex.get('description', '')}",
                answer_key=answer_key,
                options=options,
                initial_code=initial_code,
                test_cases=test_cases,
                expected_output=expected_output,
                hints=[ex.get('hint', '')] if ex.get('hint') else None,
                difficulty=ex.get('difficulty', 2),
                tags=["ai_generated", f"task:{task_title}"],
                llm_generation_meta={
                    "source": "concept_learning",
                    "task_id": task_id,
                    "task_title": task_title,
                    "user_id": user_id
                }
            )
            db.add(exercise_item)
        
        await db.commit()
        logger.info(f"已保存 {len(exercises)} 道练习题: task={task_id}")
        return str(question_group.id)
        
    except Exception as e:
        logger.error(f"保存练习题失败: {e}")
        await db.rollback()
        return None


async def get_user_llm_service(user_id: str, db: AsyncSession):
    """获取用户配置的LLM服务"""
    from ..core.config import settings
    
    try:
        result = await db.execute(
            select(UserLLMConfig).where(
                UserLLMConfig.user_id == user_id,
                UserLLMConfig.is_active == True
            )
        )
        config = result.scalar_one_or_none()
        
        if config:
            decrypted_key = decrypt_api_key(config.api_key_encrypted)
            return LLMServiceFactory.create_from_db_config(config, decrypted_key)
        
        # 使用系统默认配置（config.toml中的llm.system配置）
        if settings.use_system_llm and settings.deepseek_api_key:
            return LLMServiceFactory.create(
                api_base_url=settings.deepseek_base_url,
                api_key=settings.deepseek_api_key,
                model_name=settings.deepseek_model,
                timeout=settings.default_llm_timeout
            )
        
        return None
    except Exception as e:
        logger.error(f"获取LLM服务失败: {e}")
        return None


async def request_llm_completion(
    client: AsyncOpenAI,
    model_name: str,
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int,
) -> str:
    response = await client.chat.completions.create(
        model=model_name,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""


async def generate_concept_map_payload(
    client: AsyncOpenAI,
    model_name: str,
    request: GenerateConceptContentRequest,
) -> Dict[str, Any]:
    resources_text = "、".join(request.resources) if request.resources else "无"
    messages, temperature, max_tokens = await render_prompt_messages(
        "concept_learning.generate_map",
        {
            "subject": request.subject,
            "task_title": request.task_title,
            "description": request.description,
            "resources_text": resources_text,
            "duration_minutes": request.duration_minutes,
        },
    )
    raw_output = await request_llm_completion(client, model_name, messages, temperature, max_tokens)

    try:
        cleaned = _clean_llm_json_text(raw_output)
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            # Strategy 1: fix LaTeX backslash escapes (preserves full data)
            try:
                latex_fixed = _fix_latex_backslashes_in_json(cleaned)
                parsed = json.loads(latex_fixed)
                logger.info("concept map JSON LaTeX修复成功: task=%s", request.task_id)
            except (json.JSONDecodeError, Exception):
                # Strategy 2: repair truncated JSON (handles mid-string cuts)
                repaired = _try_repair_truncated_json(cleaned)
                if repaired is not None:
                    logger.info("concept map JSON 截断修复成功: task=%s", request.task_id)
                    parsed = repaired
                else:
                    # Strategy 3: LaTeX fix + truncation repair combined
                    try:
                        latex_fixed = _fix_latex_backslashes_in_json(cleaned)
                    except Exception:
                        latex_fixed = cleaned
                    repaired = _try_repair_truncated_json(latex_fixed)
                    if repaired is not None:
                        logger.info("concept map JSON LaTeX+截断修复成功: task=%s", request.task_id)
                        parsed = repaired
                    else:
                        raise
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning(
            "concept map JSON 解析失败，回退到默认结构: task=%s, error=%s, raw_output_preview=%.500s",
            request.task_id,
            exc,
            raw_output,
        )
        return build_fallback_concept_map(request)

    if not isinstance(parsed, dict):
        return build_fallback_concept_map(request)

    parsed.setdefault("root", request.task_title)
    parsed.setdefault("chapter_order", [])
    parsed.setdefault("nodes", [])
    parsed.setdefault("edges", [])
    return parsed


def build_diagram_seed_map(request: GenerateConceptContentRequest) -> Dict[str, Any]:
    if request.concept_map:
        return request.concept_map

    headings = request.target_headings or []
    if not headings:
        return {
            "root": request.task_title,
            "chapter_order": [],
            "nodes": [],
            "edges": [],
        }

    nodes = []
    chapter_order = []
    for index, heading in enumerate(headings, start=1):
        node_id = f"section-{index}"
        chapter_order.append(node_id)
        nodes.append(
            {
                "id": node_id,
                "title": heading,
                "summary": f"围绕“{heading}”生成图示。",
                "examples": [],
                "pitfalls": [],
                "prerequisites": [chapter_order[-2]] if len(chapter_order) > 1 else [],
                "section_level": 2,
            }
        )

    edges = []
    for prev_id, next_id in zip(chapter_order, chapter_order[1:]):
        edges.append(
            {
                "source": prev_id,
                "target": next_id,
                "relation_type": "prerequisite",
                "label": "先后理解关系",
            }
        )

    return {
        "root": request.task_title,
        "chapter_order": chapter_order,
        "nodes": nodes,
        "edges": edges,
    }


async def save_concept_content(
    db: AsyncSession,
    user_id: str,
    task_id: str,
    task_title: str,
    subject: str,
    content: str,
    reasoning: str = "",
    concept_map: Optional[Dict[str, Any]] = None,
    markmap_markdown: Optional[str] = None,
    learning_path_id: Optional[str] = None,
    learning_path_version: Optional[int] = None,
    learning_path_version_name: Optional[str] = None,
    source_day: Optional[int] = None,
    source_chapter_id: Optional[str] = None,
    source_chapter_title: Optional[str] = None,
    source_task_title: Optional[str] = None,
    source_scope_key: Optional[str] = None,
) -> bool:
    """保存生成的概念内容到数据库，返回是否成功"""
    try:
        reasoning_payload = encode_reasoning_payload(reasoning, concept_map, markmap_markdown)
        normalized_user_id = coerce_user_uuid(user_id)
        scope_key = build_source_scope_key(
            task_id=task_id,
            learning_path_id=learning_path_id,
            learning_path_version=learning_path_version,
            source_chapter_id=source_chapter_id,
            source_day=source_day,
            source_scope_key=source_scope_key,
        )
        # 检查是否已存在
        result = await db.execute(
            select(ConceptContent).where(
                ConceptContent.user_id == normalized_user_id,
                ConceptContent.source_scope_key == scope_key
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # 更新
            existing.content = content
            existing.reasoning = reasoning_payload
            existing.task_title = task_title
            existing.subject = subject
            existing.learning_path_id = learning_path_id
            existing.learning_path_version = learning_path_version
            existing.learning_path_version_name = learning_path_version_name
            existing.source_day = source_day
            existing.source_chapter_id = source_chapter_id
            existing.source_chapter_title = source_chapter_title
            existing.source_task_title = source_task_title or task_title
            existing.source_scope_key = scope_key
            existing.updated_at = utcnow_naive()
        else:
            # 新增
            new_content = ConceptContent(
                user_id=normalized_user_id,
                task_id=task_id,
                task_title=task_title,
                subject=subject,
                learning_path_id=learning_path_id,
                learning_path_version=learning_path_version,
                learning_path_version_name=learning_path_version_name,
                source_day=source_day,
                source_chapter_id=source_chapter_id,
                source_chapter_title=source_chapter_title,
                source_task_title=source_task_title or task_title,
                source_scope_key=scope_key,
                content=content,
                reasoning=reasoning_payload
            )
            db.add(new_content)

        await db.commit()
        logger.info(f"已保存概念内容: user={user_id}, task={task_id}")
        return True
    except Exception as e:
        logger.error(f"保存概念内容失败: {e}")
        await db.rollback()
        return False


async def stream_concept_content(
    user_id: str,
    request: GenerateConceptContentRequest,
):
    """流式生成概念学习内容（使用独立数据库会话，避免 StreamingResponse 生命周期问题）"""

    # 发送开始事件
    yield f"data: {json.dumps({'type': 'start', 'task_id': request.task_id})}\n\n"

    # 使用独立会话读取 LLM 配置（该会话在读取完成后即关闭）
    async with get_session() as db_read:
        llm_service = await get_user_llm_service(user_id, db_read)

    if not llm_service:
        yield f"data: {json.dumps({'type': 'error', 'content': '未配置AI服务，请在个人设置中配置LLM'})}\n\n"
        return

    try:
        # 使用更长的超时时间
        effective_timeout = max(int(getattr(llm_service, "timeout", 30)), 300)
        tmp_client = AsyncOpenAI(
            base_url=llm_service.api_base_url,
            api_key=llm_service.api_key,
            timeout=effective_timeout,
        )

        try:
            concept_map = request.concept_map
            markmap_markdown = None

            if request.diagram_only:
                concept_map = build_diagram_seed_map(request)
                messages, temperature, max_tokens = await render_prompt_messages(
                    "concept_learning.diagram_backfill",
                    {
                        "subject": request.subject,
                        "task_title": request.task_title,
                        "target_headings_json": build_target_headings_json(request.target_headings),
                        "concept_map_json": serialize_concept_map(concept_map),
                        "existing_content": request.existing_content or "",
                    },
                )
            else:
                yield f"data: {json.dumps({'type': 'map_start'}, ensure_ascii=False)}\n\n"

                # ── True streaming markmap generation ──
                # Stream the markmap markdown directly from the LLM
                map_messages, map_temperature, map_max_tokens = await render_prompt_messages(
                    "concept_learning.generate_markmap",
                    {
                        "subject": request.subject,
                        "task_title": request.task_title,
                        "description": request.description,
                        "resources_text": "、".join(request.resources) if request.resources else "无",
                        "duration_minutes": request.duration_minutes,
                    },
                )

                map_stream = await tmp_client.chat.completions.create(
                    model=llm_service.model_name,
                    messages=map_messages,
                    temperature=map_temperature,
                    max_tokens=map_max_tokens,
                    stream=True,
                )

                markmap_markdown = ""
                async for map_chunk in map_stream:
                    if not map_chunk.choices:
                        continue
                    delta = map_chunk.choices[0].delta
                    if delta.content:
                        markmap_markdown += delta.content
                        # Send each chunk to the frontend for real-time display
                        yield f"data: {json.dumps({'type': 'map_content', 'content': delta.content}, ensure_ascii=False)}\n\n"

                # Strip any accidental code fences from the output
                markmap_markdown = markmap_markdown.strip()
                if markmap_markdown.startswith("```"):
                    markmap_markdown = re.sub(r'^```\w*\s*', '', markmap_markdown)
                    markmap_markdown = re.sub(r'```\s*$', '', markmap_markdown).strip()

                # Derive structured concept map from the streamed markdown
                concept_map = derive_concept_map_from_markmap(markmap_markdown, task_title=request.task_title)

                yield f"data: {json.dumps({'type': 'map_ready', 'concept_map': concept_map, 'markmap_markdown': markmap_markdown}, ensure_ascii=False)}\n\n"

                resources_text = "、".join(request.resources) if request.resources else "无"
                messages, temperature, max_tokens = await render_prompt_messages(
                    "concept_learning.generate_article",
                    {
                        "subject": request.subject,
                        "task_title": request.task_title,
                        "description": request.description,
                        "resources_text": resources_text,
                        "duration_minutes": request.duration_minutes,
                        "concept_map_json": serialize_concept_map(concept_map),
                        "markmap_markdown": markmap_markdown,
                    },
                )

            stream = await tmp_client.chat.completions.create(
                model=llm_service.model_name,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True
            )

            full_content = ""
            full_reasoning = ""
            content_truncated = False

            async for chunk in stream:
                if not chunk.choices:
                    continue

                choice = chunk.choices[0]
                delta = choice.delta

                # 检测是否因 max_tokens 截断
                if choice.finish_reason == "length":
                    content_truncated = True
                    logger.warning(
                        f"概念学习内容因 max_tokens 截断: user={user_id}, task={request.task_id}, "
                        f"content_len={len(full_content)}"
                    )

                # 处理思维链内容
                if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                    full_reasoning += delta.reasoning_content
                    yield f"data: {json.dumps({'type': 'thinking', 'content': delta.reasoning_content})}\n\n"

                # 处理正常内容
                if delta.content:
                    full_content += delta.content
                    yield f"data: {json.dumps({'type': 'content', 'content': delta.content}, ensure_ascii=False)}\n\n"


            # 使用独立会话保存内容（流式完成后才执行）
            saved = False
            if not request.diagram_only:
                full_content = re.sub(r'```diagram-spec[\s\S]*?```', '', full_content).strip()
                
                async with get_session() as db_save:

                    saved = await save_concept_content(
                        db_save, user_id, request.task_id, request.task_title,
                        request.subject, full_content, full_reasoning,
                        concept_map=concept_map,
                        markmap_markdown=markmap_markdown,
                        learning_path_id=request.learning_path_id,
                        learning_path_version=request.learning_path_version,
                        learning_path_version_name=request.learning_path_version_name,
                        source_day=request.source_day,
                        source_chapter_id=request.source_chapter_id,
                        source_chapter_title=request.source_chapter_title,
                        source_task_title=request.source_task_title,
                        source_scope_key=request.source_scope_key,
                    )
                    if not saved:
                        logger.warning(f"内容保存失败，跳过练习题保存: user={user_id}, task={request.task_id}")

            # 发送完成事件
            yield f"data: {json.dumps({'type': 'done', 'full_content': full_content, 'full_reasoning': full_reasoning, 'concept_map': concept_map, 'markmap_markdown': markmap_markdown, 'saved': saved, 'truncated': content_truncated}, ensure_ascii=False)}\n\n"


        except asyncio.CancelledError:
            logger.info(f"客户端断开连接，中止流式生成: user={user_id}, task={request.task_id}")
            raise
        finally:
            try:
                await tmp_client.close()
            except Exception:
                pass

    except asyncio.CancelledError:
        logger.info(f"客户端断开连接: user={user_id}, task={request.task_id}")
        raise
    except Exception as e:
        logger.error(f"生成概念学习内容失败: {e}")
        yield f"data: {json.dumps({'type': 'error', 'content': f'生成失败: {str(e)}'})}\n\n"


@router.get("/{task_id}", summary="获取已缓存的概念学习内容")
async def get_concept_content(
    task_id: str,
    user_id: UUID = Query(..., description="用户ID"),
    learning_path_id: Optional[str] = Query(None, description="学习计划ID"),
    learning_path_version: Optional[int] = Query(None, description="学习计划版本"),
    source_chapter_id: Optional[str] = Query(None, description="章节ID"),
    source_day: Optional[int] = Query(None, description="学习日程天数"),
    source_scope_key: Optional[str] = Query(None, description="来源作用域键"),
    db: AsyncSession = Depends(get_db)
) -> ConceptContentResponse:
    """
    获取已缓存的概念学习内容
    
    如果内容存在，返回缓存的内容；否则返回 exists=False，前端需调用生成接口。
    """
    scope_key = build_source_scope_key(
        task_id=task_id,
        learning_path_id=learning_path_id,
        learning_path_version=learning_path_version,
        source_chapter_id=source_chapter_id,
        source_day=source_day,
        source_scope_key=source_scope_key,
    )
    result = await db.execute(
        select(ConceptContent).where(
            ConceptContent.user_id == user_id,
            ConceptContent.source_scope_key == scope_key
        )
    )
    content = result.scalar_one_or_none()
    
    if content:
        reasoning_text, concept_map, markmap_markdown = decode_reasoning_payload(content.reasoning)
        # Re-export markmap from concept_map to pick up improved formatting
        if concept_map and isinstance(concept_map, dict):
            markmap_markdown = export_concept_map_to_markmap(concept_map, task_title=content.task_title)
        return ConceptContentResponse(
            task_id=content.task_id,
            task_title=content.task_title,
            subject=content.subject or "Python",
            content=content.content,
            reasoning=reasoning_text,
            learning_path_id=content.learning_path_id,
            learning_path_version=content.learning_path_version,
            learning_path_version_name=content.learning_path_version_name,
            source_day=content.source_day,
            source_chapter_id=content.source_chapter_id,
            source_chapter_title=content.source_chapter_title,
            source_task_title=content.source_task_title,
            source_scope_key=content.source_scope_key,
            concept_map=concept_map,
            markmap_markdown=markmap_markdown,
            created_at=content.created_at,
            exists=True
        )
    
    return ConceptContentResponse(
        task_id=task_id,
        task_title="",
        subject="Python",
        exists=False
    )


@router.delete("/{task_id}", summary="删除缓存的概念学习内容")
async def delete_concept_content(
    task_id: str,
    user_id: UUID = Query(..., description="用户ID"),
    learning_path_id: Optional[str] = Query(None, description="学习计划ID"),
    learning_path_version: Optional[int] = Query(None, description="学习计划版本"),
    source_chapter_id: Optional[str] = Query(None, description="章节ID"),
    source_day: Optional[int] = Query(None, description="学习日程天数"),
    source_scope_key: Optional[str] = Query(None, description="来源作用域键"),
    db: AsyncSession = Depends(get_db)
):
    """
    删除缓存的概念学习内容
    
    用于用户想要重新生成内容的场景。
    """
    scope_key = build_source_scope_key(
        task_id=task_id,
        learning_path_id=learning_path_id,
        learning_path_version=learning_path_version,
        source_chapter_id=source_chapter_id,
        source_day=source_day,
        source_scope_key=source_scope_key,
    )
    await db.execute(
        delete(ConceptContent).where(
            ConceptContent.user_id == user_id,
            ConceptContent.source_scope_key == scope_key
        )
    )
    await db.commit()
    return {"success": True, "message": "内容已删除，可重新生成"}


@router.post("/generate-exercises", summary="基于 concept map 生成章节练习题")
async def generate_concept_exercises(
    request: GenerateConceptExercisesRequest,
    user_id: UUID = Query(..., description="用户ID"),
) -> GenerateConceptExercisesResponse:
    async with get_session() as db_read:
        llm_service = await get_user_llm_service(str(user_id), db_read)

    if not llm_service:
        raise HTTPException(status_code=400, detail="未配置AI服务，请在个人设置中配置LLM")

    effective_timeout = max(int(getattr(llm_service, "timeout", 30)), 120)
    client = AsyncOpenAI(
        base_url=llm_service.api_base_url,
        api_key=llm_service.api_key,
        timeout=effective_timeout,
    )

    try:
        concept_map = request.concept_map or {
            "root": request.task_title,
            "chapter_order": [],
            "nodes": [],
            "edges": [],
        }
        messages, temperature, max_tokens = await render_prompt_messages(
            "concept_learning.exercise_generate",
            {
                "subject": request.subject,
                "task_title": request.task_title,
                "description": request.description,
                "concept_map_json": serialize_concept_map(concept_map),
                "article_content": request.article_content,
            },
        )
        raw_content = await request_llm_completion(
            client,
            llm_service.model_name,
            messages,
            temperature,
            max_tokens,
        )
        exercises = parse_generated_exercises_json(raw_content)
        if not exercises:
            exercises = build_fallback_exercises_from_concept_map(request.task_title, concept_map)

        saved_group_id: Optional[str] = None
        async with get_session() as db_save:
            if exercises:
                saved_group_id = await save_exercises_to_db(
                    db_save,
                    exercises,
                    str(user_id),
                    request.task_id,
                    request.task_title,
                    request.subject_key or request.subject,
                    learning_path_id=request.learning_path_id,
                    learning_path_version=request.learning_path_version,
                    learning_path_version_name=request.learning_path_version_name,
                    source_day=request.source_day,
                    source_chapter_id=request.source_chapter_id,
                    source_chapter_title=request.source_chapter_title,
                    source_task_title=request.source_task_title,
                    source_scope_key=request.source_scope_key,
                )

        return GenerateConceptExercisesResponse(
            success=bool(exercises),
            exercises_count=len(exercises),
            raw_content=raw_content,
            group_id=saved_group_id,
            exercises=exercises,
        )
    finally:
        try:
            await client.close()
        except Exception:
            pass


@router.post("/generate/stream", summary="流式生成概念学习内容")
async def generate_concept_content_stream(
    request: GenerateConceptContentRequest,
    user_id: UUID = Query(..., description="用户ID"),
):
    """
    流式生成概念学习内容

    使用SSE (Server-Sent Events) 格式返回流式内容。
    生成完成后自动保存到数据库。

    事件类型：
    - start: 开始生成
    - thinking: 思维链内容（DeepSeek R1模型）
    - content: 正常内容
    - done: 生成完成
    - error: 发生错误
    """
    return StreamingResponse(
        stream_concept_content(str(user_id), request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
