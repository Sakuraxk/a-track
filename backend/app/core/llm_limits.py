"""Shared limits for OpenAI-compatible LLM requests."""

MAX_LLM_OUTPUT_TOKENS = 8192
MIN_LLM_OUTPUT_TOKENS = 100


def clamp_llm_output_tokens(value: int | None, default: int = 2048) -> int:
    """Clamp max output tokens to the platform-safe request range."""
    if value is None:
        value = default
    return max(MIN_LLM_OUTPUT_TOKENS, min(int(value), MAX_LLM_OUTPUT_TOKENS))
