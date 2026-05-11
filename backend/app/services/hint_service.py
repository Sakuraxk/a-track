"""
Hint service - AI hint generation and caching.
"""
import hashlib
import logging
import re
from typing import Any, Dict, Optional
from uuid import UUID

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.subject import ExerciseHintCache, ExerciseItem
from ..prompts import get_prompt_registry
from ..routers.concept_learning import get_user_llm_service

logger = logging.getLogger(__name__)

_HINT_LEVEL_GUIDE = {
    1: "给出非常含蓄的方向提示",
    2: "指出关键概念或思路",
    3: "给出更具体的解题方向但不直接给答案",
}


def _coerce_uuid(value: object) -> UUID:
    if isinstance(value, UUID):
        return value
    return UUID(str(value))


def _format_options(options: Any) -> str:
    if not options:
        return ""
    if isinstance(options, list):
        lines = []
        for option in options:
            if isinstance(option, dict):
                label = option.get("label") or option.get("key")
                text = option.get("text") or option.get("content") or ""
                if label:
                    lines.append(f"{label}. {text}")
                elif text:
                    lines.append(str(text))
            else:
                lines.append(str(option))
        return "\n".join(lines)
    return str(options)


def _build_prompt(item: ExerciseItem, hint_level: int) -> str:
    prompt_registry = get_prompt_registry()
    level_hint = _HINT_LEVEL_GUIDE.get(hint_level, _HINT_LEVEL_GUIDE[1])
    options_text = _format_options(item.options)
    options_block = f"\n选项:\n{options_text}" if options_text else ""
    messages = prompt_registry.render_messages(
        "hint.generate",
        {
            "item_type": item.item_type,
            "stem": item.stem,
            "options_block": options_block,
            "hint_level": hint_level,
            "level_hint": level_hint,
        },
    )
    return messages[-1]["content"]


def _prompt_hash(prompt: str, model_name: Optional[str]) -> str:
    base = f"{model_name or 'unknown'}|{prompt}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def _sanitize_hint(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = [line for line in cleaned.splitlines() if not line.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()
    cleaned = cleaned.strip("\"'")
    parts = re.split(r"(?<=[。！？!?])", cleaned)
    if len(parts) > 2:
        cleaned = "".join(parts[:2]).strip()
    return cleaned


def _fallback_hint(item: ExerciseItem, hint_level: int) -> str:
    if isinstance(item.hints, list) and item.hints:
        index = min(max(hint_level - 1, 0), len(item.hints) - 1)
        return str(item.hints[index])
    if isinstance(item.hints, str) and item.hints.strip():
        return item.hints.strip()
    return "可以先回忆该题涉及的核心概念，再从条件中找线索哦 😊"


async def get_hint(
    db: AsyncSession,
    user_id: str,
    exercise_item_id: str,
    hint_level: int,
) -> Optional[Dict[str, Any]]:
    """Get or generate AI hint, with caching."""
    try:
        hint_level_int = int(hint_level)
    except (TypeError, ValueError):
        raise ValueError("hint_level 必须是 1-3 的整数")

    if hint_level_int not in (1, 2, 3):
        raise ValueError("hint_level 必须在 1-3 之间")

    item_uuid = _coerce_uuid(exercise_item_id)
    item_result = await db.execute(
        select(ExerciseItem).where(ExerciseItem.id == item_uuid)
    )
    item = item_result.scalar_one_or_none()
    if not item:
        return None

    llm_service = await get_user_llm_service(user_id, db)
    model_name = getattr(llm_service, "model_name", None) if llm_service else None
    prompt = _build_prompt(item, hint_level_int)
    prompt_hash = _prompt_hash(prompt, model_name)

    cache_result = await db.execute(
        select(ExerciseHintCache).where(
            ExerciseHintCache.exercise_item_id == item_uuid,
            ExerciseHintCache.hint_level == hint_level_int,
            ExerciseHintCache.prompt_hash == prompt_hash,
        )
    )
    cache = cache_result.scalar_one_or_none()
    if cache:
        return {
            "hint_text": cache.hint_text,
            "hint_level": cache.hint_level,
            "cached": True,
            "model": cache.model,
        }

    hint_text = ""
    if llm_service:
        try:
            prompt_definition = get_prompt_registry().get_definition("hint.generate")
            client = AsyncOpenAI(
                base_url=llm_service.api_base_url,
                api_key=llm_service.api_key,
                timeout=60,
            )
            response = await client.chat.completions.create(
                model=model_name or "gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": get_prompt_registry()
                        .render_messages("hint.generate", {
                            "item_type": item.item_type,
                            "stem": item.stem,
                            "options_block": f"\n选项:\n{_format_options(item.options)}" if _format_options(item.options) else "",
                            "hint_level": hint_level_int,
                            "level_hint": _HINT_LEVEL_GUIDE.get(hint_level_int, _HINT_LEVEL_GUIDE[1]),
                        })[0]["content"],
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=getattr(llm_service, "temperature", 0.7) or 0.7,
                max_tokens=prompt_definition.max_tokens,
            )
            hint_text = _sanitize_hint(response.choices[0].message.content or "")
        except Exception as exc:
            logger.warning(f"[Hint Service] LLM 生成失败: {exc}")
            hint_text = _fallback_hint(item, hint_level_int)
    else:
        hint_text = _fallback_hint(item, hint_level_int)

    if not hint_text:
        return None

    cache_entry = ExerciseHintCache(
        exercise_item_id=item_uuid,
        hint_level=hint_level_int,
        hint_text=hint_text,
        model=model_name,
        prompt_hash=prompt_hash,
    )
    db.add(cache_entry)

    return {
        "hint_text": hint_text,
        "hint_level": hint_level_int,
        "cached": False,
        "model": model_name,
    }
