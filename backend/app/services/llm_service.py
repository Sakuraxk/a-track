"""
LLM服务模块
封装与OpenAI兼容API的交互
"""
import asyncio
import time
from typing import List, Dict, Any, Optional, AsyncGenerator

import logging

from openai import AsyncOpenAI, APIError, APIConnectionError, RateLimitError

from app.core.config import settings
from app.core.llm_limits import clamp_llm_output_tokens
from app.prompts import get_prompt_registry

logger = logging.getLogger(__name__)

# 全局并发限制：防止同时发起过多 LLM 请求
_LLM_SEMAPHORE = asyncio.Semaphore(10)

# 重试配置
_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 1.0  # 秒


class LLMServiceError(Exception):
    """LLM服务错误"""
    pass


class LLMService:
    """
    LLM调用服务 - 支持OpenAI兼容API

    支持的API包括：
    - OpenAI API
    - Azure OpenAI
    - DeepSeek API
    - 通义千问 API
    - 其他OpenAI兼容格式的API
    """

    def __init__(
        self,
        api_base_url: str,
        api_key: str,
        model_name: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        timeout: int = 30
    ):
        """
        初始化LLM服务

        Args:
            api_base_url: API基础URL
            api_key: API密钥
            model_name: 模型名称
            temperature: 温度参数
            max_tokens: 最大token数
            timeout: 超时时间（秒）
        """
        self.api_base_url = api_base_url
        self.api_key = api_key
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = clamp_llm_output_tokens(
            max_tokens,
            settings.default_llm_max_tokens,
        )
        self.timeout = timeout

        # 初始化OpenAI客户端
        self.client = AsyncOpenAI(
            base_url=api_base_url,
            api_key=api_key,
            timeout=timeout
        )

    async def chat(
        self,
        messages: List[Dict[str, str]],
        role: str = "explainer",
        context: Optional[Dict[str, Any]] = None,
        request_direct_answer: bool = False
    ) -> Dict[str, Any]:
        """
        发送聊天请求（带重试和并发限制）

        Args:
            messages: 消息历史 [{"role": "user", "content": "..."}]
            role: tutor角色 (explainer | code_reviewer)
            context: 上下文信息
            request_direct_answer: 是否请求直接答案

        Returns:
            包含响应内容、模型信息、token使用量的字典
        """
        # 构建系统提示
        system_prompt = self._build_system_prompt(role, context, request_direct_answer)

        # 构建完整消息列表
        full_messages = [{"role": "system", "content": system_prompt}]
        full_messages.extend(messages)

        last_error = None
        for attempt in range(_MAX_RETRIES):
            try:
                async with _LLM_SEMAPHORE:
                    response = await self.client.chat.completions.create(
                        model=self.model_name,
                        messages=full_messages,
                        temperature=self.temperature,
                        max_tokens=self.max_tokens
                    )

                return {
                    "content": response.choices[0].message.content,
                    "model": response.model or self.model_name,
                    "tokens_used": response.usage.total_tokens if response.usage else None,
                    "finish_reason": response.choices[0].finish_reason
                }
            except RateLimitError as e:
                last_error = e
                delay = _RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning("[LLM] Rate limited (attempt %d/%d), retrying in %.1fs", attempt + 1, _MAX_RETRIES, delay)
                await asyncio.sleep(delay)
            except APIConnectionError as e:
                last_error = e
                delay = _RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning("[LLM] Connection error (attempt %d/%d), retrying in %.1fs", attempt + 1, _MAX_RETRIES, delay)
                await asyncio.sleep(delay)
            except APIError as e:
                raise LLMServiceError(f"API调用失败: {str(e)}")
            except Exception as e:
                raise LLMServiceError(f"LLM调用出错: {str(e)}")

        # 所有重试都失败
        if isinstance(last_error, RateLimitError):
            raise LLMServiceError(f"API请求频率超限，已重试{_MAX_RETRIES}次: {str(last_error)}")
        raise LLMServiceError(f"无法连接到API服务器，已重试{_MAX_RETRIES}次: {str(last_error)}")

    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        role: str = "explainer",
        context: Optional[Dict[str, Any]] = None,
        request_direct_answer: bool = False
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        流式发送聊天请求，支持 DeepSeek R1 思维链

        Args:
            messages: 消息历史 [{"role": "user", "content": "..."}]
            role: tutor角色 (explainer | code_reviewer)
            context: 上下文信息
            request_direct_answer: 是否请求直接答案

        Yields:
            包含 type 和 content 的字典:
            - type: "thinking" - 思维链内容（DeepSeek R1）
            - type: "content" - 正常回复内容
            - type: "done" - 流结束
            - type: "error" - 错误信息
        """
        # 构建系统提示
        system_prompt = self._build_system_prompt(role, context, request_direct_answer)

        # 构建完整消息列表
        full_messages = [{"role": "system", "content": system_prompt}]
        full_messages.extend(messages)

        total_content = ""
        total_reasoning = ""

        # 流式请求带重试（连接失败时最多重试 _MAX_RETRIES 次）
        last_conn_error = None
        for attempt in range(_MAX_RETRIES):
            try:
                async with _LLM_SEMAPHORE:
                    stream = await self.client.chat.completions.create(
                        model=self.model_name,
                        messages=full_messages,
                        temperature=self.temperature,
                        max_tokens=self.max_tokens,
                        stream=True  # 启用流式
                    )

                async for chunk in stream:
                    if not chunk.choices:
                        continue

                    delta = chunk.choices[0].delta

                    # DeepSeek R1 推理模型会返回 reasoning_content
                    if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                        total_reasoning += delta.reasoning_content
                        yield {
                            "type": "thinking",
                            "content": delta.reasoning_content
                        }

                    # 正常内容
                    if delta.content:
                        total_content += delta.content
                        yield {
                            "type": "content",
                            "content": delta.content
                        }

                # 流结束
                yield {
                    "type": "done",
                    "content": "",
                    "full_content": total_content,
                    "full_reasoning": total_reasoning,
                    "model": self.model_name
                }
                return  # 成功完成，退出重试循环

            except (APIConnectionError, RateLimitError) as e:
                last_conn_error = e
                if attempt < _MAX_RETRIES - 1:
                    delay = _RETRY_BASE_DELAY * (2 ** attempt)
                    err_type = "Rate limited" if isinstance(e, RateLimitError) else "Connection error"
                    logger.warning(
                        "[LLM stream] %s (attempt %d/%d), retrying in %.1fs",
                        err_type, attempt + 1, _MAX_RETRIES, delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                # 所有重试耗尽
                if isinstance(e, RateLimitError):
                    yield {"type": "error", "content": f"API请求频率超限，已重试{_MAX_RETRIES}次: {str(e)}"}
                else:
                    yield {"type": "error", "content": f"无法连接到API服务器，已重试{_MAX_RETRIES}次: {str(e)}"}
                return
            except APIError as e:
                yield {"type": "error", "content": f"API调用失败: {str(e)}"}
                return
            except Exception as e:
                yield {"type": "error", "content": f"LLM调用出错: {str(e)}"}
                return

    def get_client(self, timeout_override: Optional[int] = None) -> AsyncOpenAI:
        """
        获取 AsyncOpenAI 客户端实例。

        如果 timeout_override 为 None 或与当前 timeout 一致，复用已有客户端；
        否则创建并缓存一个新的超时版本。

        Args:
            timeout_override: 自定义超时时间（秒），None 表示使用默认值
        """
        effective_timeout = timeout_override if timeout_override is not None else self.timeout
        if effective_timeout == self.timeout:
            return self.client

        # 按超时值缓存额外客户端，避免重复创建
        cache = getattr(self, "_timeout_clients", None)
        if cache is None:
            cache = {}
            self._timeout_clients = cache

        if effective_timeout not in cache:
            cache[effective_timeout] = AsyncOpenAI(
                base_url=self.api_base_url,
                api_key=self.api_key,
                timeout=effective_timeout,
            )
        return cache[effective_timeout]

    async def raw_completion(
        self,
        messages: List[Dict[str, str]],
        *,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_override: Optional[int] = None,
        use_json_mode: bool = True,
    ) -> tuple:
        """
        执行一次非流式补全调用，返回 (raw_content, finish_reason)。

        当 use_json_mode=True 时会先尝试 response_format=json_object，
        如果模型/网关不支持则自动降级。

        Args:
            messages: 完整消息列表
            temperature: 温度（None 则用实例默认值）
            max_tokens: 最大 token 数（None 则用实例默认值）
            timeout_override: 自定义超时（秒）
            use_json_mode: 是否尝试 JSON 强制模式

        Returns:
            (raw_content: str, finish_reason: str | None)
        """
        client = self.get_client(timeout_override)
        create_params: Dict[str, Any] = {
            "model": self.model_name,
            "messages": messages,
            "temperature": temperature if temperature is not None else self.temperature,
            "max_tokens": clamp_llm_output_tokens(max_tokens, self.max_tokens),
        }

        response = None
        if use_json_mode:
            try:
                response = await client.chat.completions.create(
                    **create_params,
                    response_format={"type": "json_object"},
                )
            except Exception:
                response = None

        if response is None:
            response = await client.chat.completions.create(**create_params)

        # 提取原始内容（兼容 DeepSeek R1 reasoning_content / refusal）
        message = response.choices[0].message
        raw_content = (
            getattr(message, "content", None)
            or getattr(message, "reasoning_content", None)
            or getattr(message, "refusal", None)
            or ""
        )

        try:
            finish_reason = response.choices[0].finish_reason
        except Exception:
            finish_reason = None

        return (str(raw_content), finish_reason)

    async def raw_completion_stream(
        self,
        messages: List[Dict[str, str]],
        *,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_override: Optional[int] = None,
        use_json_mode: bool = True,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        执行流式补全调用，逐块 yield delta 内容。

        Yields:
            {"type": "delta", "content": str}  — 正常文本增量
            {"type": "done"}                    — 流结束

        Args:
            messages: 完整消息列表
            temperature: 温度
            max_tokens: 最大 token 数
            timeout_override: 自定义超时（秒）
            use_json_mode: 是否尝试 JSON 强制模式
        """
        client = self.get_client(timeout_override)
        create_params: Dict[str, Any] = {
            "model": self.model_name,
            "messages": messages,
            "temperature": temperature if temperature is not None else self.temperature,
            "max_tokens": clamp_llm_output_tokens(max_tokens, self.max_tokens),
            "stream": True,
        }

        stream = None
        if use_json_mode:
            try:
                stream = await client.chat.completions.create(
                    **create_params,
                    response_format={"type": "json_object"},
                )
            except Exception:
                stream = None

        if stream is None:
            stream = await client.chat.completions.create(**create_params)

        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            delta_content = getattr(delta, "content", None) or ""
            if delta_content:
                yield {"type": "delta", "content": delta_content}

        yield {"type": "done"}

    async def test_connection(self) -> Dict[str, Any]:
        """
        测试API连接

        Returns:
            包含测试结果的字典
        """
        try:
            start_time = time.time()
            response = await self.client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": "Hello, respond with 'OK' only."}],
                max_tokens=10,
                temperature=0
            )
            latency = int((time.time() - start_time) * 1000)

            return {
                "success": True,
                "message": "连接成功",
                "latency_ms": latency,
                "model_info": {
                    "model": response.model or self.model_name,
                    "response": response.choices[0].message.content
                }
            }
        except RateLimitError:
            return {
                "success": False,
                "message": "API请求频率超限，但连接正常",
                "latency_ms": None,
                "model_info": None
            }
        except APIConnectionError as e:
            return {
                "success": False,
                "message": f"无法连接到API服务器: {str(e)}",
                "latency_ms": None,
                "model_info": None
            }
        except APIError as e:
            return {
                "success": False,
                "message": f"API错误: {str(e)}",
                "latency_ms": None,
                "model_info": None
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"连接测试失败: {str(e)}",
                "latency_ms": None,
                "model_info": None
            }

    def _build_system_prompt(
        self,
        role: str,
        context: Optional[Dict[str, Any]],
        request_direct_answer: bool
    ) -> str:
        """
        构建系统提示

        Args:
            role: tutor角色
            context: 上下文信息
            request_direct_answer: 是否请求直接答案

        Returns:
            完整的系统提示
        """
        # 填充上下文
        context = context or {}
        registry = get_prompt_registry()
        role_prompt_key = {
            "explainer": "llm_service.role_explainer",
            "code_reviewer": "llm_service.role_code_reviewer",
        }.get(role, "llm_service.role_explainer")
        prompt = registry.render_messages(
            role_prompt_key,
            {
                "ability_tags": context.get("ability_tags", "未知"),
                "knowledge_node": context.get("knowledge_node", "通用学习"),
                "recent_errors": context.get("recent_errors", "无"),
            },
        )[0]["content"]

        # ── 注入学习上下文（概念学习页面传入） ──
        learning_parts: list[str] = []
        if context.get("subject"):
            learning_parts.append(f"- 学科: {context['subject']}")
        if context.get("chapter_title"):
            learning_parts.append(f"- 当前章节: {context['chapter_title']}")
        if context.get("chapter_summary"):
            learning_parts.append(f"- 章节内容摘要:\n{context['chapter_summary']}")
        if context.get("section_title"):
            learning_parts.append(f"- 当前所在小节: {context['section_title']}")
        if context.get("selected_text"):
            learning_parts.append(f"- 用户选中的文本:\n\"\"\"\n{context['selected_text']}\n\"\"\"")

        if learning_parts:
            prompt += "\n\n## 当前学习上下文\n用户正在概念学习页面学习以下内容，请结合这些信息回答问题：\n" + "\n".join(learning_parts)

        # ── 注入做题上下文（PracticeAIPanel 传入） ──
        question_parts: list[str] = []
        if context.get("question_type"):
            type_labels = {
                "mcq": "选择题", "coding": "编程题", "fill_blank": "填空题",
                "short_answer": "简答题", "essay": "论述题",
            }
            question_parts.append(f"- 题目类型: {type_labels.get(context['question_type'], context['question_type'])}")
        if context.get("question_stem"):
            question_parts.append(f"- 题目内容:\n\"\"\"\n{context['question_stem']}\n\"\"\"")

        if question_parts:
            prompt += "\n\n## 当前做题上下文\n用户正在练习以下题目，请结合题目内容进行回答和指导：\n" + "\n".join(question_parts)

        # 添加引导/直接答案指令
        if request_direct_answer:
            prompt += "\n\n" + registry.render_messages("llm_service.direct_answer_instruction")[0]["content"]
        else:
            prompt += "\n\n" + registry.render_messages("llm_service.guidance_instruction")[0]["content"]

        return prompt


class LLMServiceFactory:
    """LLM服务工厂 - 根据配置创建服务实例"""

    @staticmethod
    def create(
        api_base_url: str,
        api_key: str,
        model_name: str,
        temperature: float = None,
        max_tokens: int = None,
        timeout: int = None
    ) -> LLMService:
        """
        创建LLM服务实例

        Args:
            api_base_url: API基础URL
            api_key: API密钥
            model_name: 模型名称
            temperature: 温度参数（可选，使用默认值）
            max_tokens: 最大token数（可选，使用默认值）
            timeout: 超时时间（可选，使用默认值）

        Returns:
            LLMService实例
        """
        return LLMService(
            api_base_url=api_base_url,
            api_key=api_key,
            model_name=model_name,
            temperature=temperature if temperature is not None else settings.default_llm_temperature,
            max_tokens=max_tokens if max_tokens is not None else settings.default_llm_max_tokens,
            timeout=timeout if timeout is not None else settings.default_llm_timeout
        )

    @staticmethod
    def create_from_db_config(config, decrypted_api_key: str) -> LLMService:
        """
        从数据库配置创建LLM服务

        Args:
            config: UserLLMConfig模型实例
            decrypted_api_key: 解密后的API密钥

        Returns:
            LLMService实例
        """
        return LLMService(
            api_base_url=config.api_base_url,
            api_key=decrypted_api_key,
            model_name=config.model_name,
            temperature=config.temperature / 100,  # 从整数还原为浮点数
            max_tokens=config.max_tokens,
            timeout=config.timeout_seconds
        )
