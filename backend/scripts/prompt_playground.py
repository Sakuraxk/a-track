"""
Manual prompt playground for rendering and testing prompt templates.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any, Dict

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.prompts import get_prompt_registry  # noqa: E402


def _load_fixture(path: str) -> Dict[str, Any]:
    fixture_path = (PROJECT_ROOT / path).resolve()
    with fixture_path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Render or run prompt templates manually.")
    parser.add_argument("--prompt", required=True, help="Prompt key, e.g. question_bank.generate")
    parser.add_argument(
        "--fixture",
        required=True,
        help="Fixture path relative to backend/, e.g. prompts/fixtures/question_bank_generate.json",
    )
    parser.add_argument(
        "--run",
        action="store_true",
        help="Call the configured system model after rendering the prompt.",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=None,
        help="Override catalog temperature when using --run.",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=None,
        help="Override catalog max_tokens when using --run.",
    )
    return parser


async def _run_prompt(
    prompt_name: str,
    fixture_path: str,
    run_model: bool,
    temperature: float | None,
    max_tokens: int | None,
) -> int:
    registry = get_prompt_registry()
    definition = registry.get_definition(prompt_name)
    variables = _load_fixture(fixture_path)
    messages = registry.render_messages(prompt_name, variables)

    print("=== Prompt Definition ===")
    print(json.dumps({
        "name": definition.name,
        "description": definition.description,
        "temperature": definition.temperature,
        "max_tokens": definition.max_tokens,
        "output_format": definition.output_format,
    }, ensure_ascii=False, indent=2))
    print()

    print("=== Rendered Messages ===")
    print(json.dumps(messages, ensure_ascii=False, indent=2))
    print()

    if not run_model:
        return 0

    from app.core.config import settings
    if not settings.use_system_llm or not settings.deepseek_api_key:
        print("系统级 LLM 未配置，无法执行真实调用。请先在 backend/config.toml 或环境变量中配置 llm.system。")
        return 1

    from openai import AsyncOpenAI

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

    print("=== Model Response ===")
    print(response.choices[0].message.content or "")
    return 0


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()
    return asyncio.run(
        _run_prompt(
            prompt_name=args.prompt,
            fixture_path=args.fixture,
            run_model=args.run,
            temperature=args.temperature,
            max_tokens=args.max_tokens,
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())
