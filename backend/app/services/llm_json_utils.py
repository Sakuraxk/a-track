"""
LLM JSON 解析与清理工具函数

从 ai_learning_path_service.py 拆分而来，包含将 LLM 返回内容
解析为 Python dict 的纯函数集合（无状态、无副作用）。
"""
import json
import re
from typing import Optional


def truncate_reason(text: str, limit: int = 400) -> str:
    """截断错误原因字符串，保持可读性。"""
    if not text:
        return ""
    cleaned = " ".join(str(text).split())
    return cleaned if len(cleaned) <= limit else f"{cleaned[:limit]}..."


def strip_invisible_chars(text: str) -> str:
    """
    移除常见不可见字符，避免出现"看起来为空但其实是零宽字符"的情况导致 JSON 解析失败。
    """
    if not text:
        return ""
    invisible_chars = [
        "\ufeff",  # BOM
        "\u200b",  # zero width space
        "\u200c",  # zero width non-joiner
        "\u200d",  # zero width joiner
        "\u2060",  # word joiner
        "\u180e",  # mongolian vowel separator (deprecated)
    ]
    for ch in invisible_chars:
        text = text.replace(ch, "")
    return text


def extract_json_object_from_text(text: str) -> Optional[str]:
    """从文本中提取第一个完整的 JSON 对象（花括号包裹）。"""
    if not text:
        return None
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start:end + 1]
    return None


def fix_common_json_issues(text: str) -> str:
    """修复 LLM 常见的 JSON 格式问题（尾逗号、注释等）。"""
    if not text:
        return text
    # 移除尾随逗号 (trailing commas) - JSON 不允许但 LLM 常犯
    # 匹配 ,] 或 ,} 前的逗号
    text = re.sub(r',(\s*[}\]])', r'\1', text)
    # 移除注释 (// 或 /* */) - JSON 不支持注释
    text = re.sub(r'//[^\n]*', '', text)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    return text


def parse_llm_json(raw_content: str) -> dict:
    """
    将 LLM 返回内容解析为 dict，并在失败时尽可能提供可诊断信息。
    """
    content = strip_invisible_chars(str(raw_content or ""))
    content = content.strip()
    if not content:
        raise json.JSONDecodeError("empty content", doc="", pos=0)

    # 处理 markdown 代码块
    if content.startswith("```"):
        lines = content.split("\n")
        json_lines = []
        in_json = False
        for line in lines:
            if line.startswith("```"):
                in_json = not in_json
                continue
            if in_json:
                json_lines.append(line)
        content = "\n".join(json_lines)
        content = strip_invisible_chars(content).strip()

    # 修复常见 JSON 问题
    content = fix_common_json_issues(content)

    try:
        data = json.loads(content)
        if isinstance(data, dict):
            return data
        raise json.JSONDecodeError("not a json object", doc=content[:200], pos=0)
    except json.JSONDecodeError:
        # 尝试提取 JSON 对象
        extracted = extract_json_object_from_text(content)
        if extracted:
            extracted = fix_common_json_issues(extracted)
            try:
                data = json.loads(extracted)
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                pass
        raise


def normalize_clarification_text(text: str | None) -> str:
    """将澄清文本归一化（去除多余空白）。"""
    return re.sub(r"\s+", " ", (text or "").strip())
