"""
LLM配置相关的Pydantic模型
"""
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator

from app.core.llm_limits import MAX_LLM_OUTPUT_TOKENS, MIN_LLM_OUTPUT_TOKENS


class LLMConfigBase(BaseModel):
    """LLM配置基础模型"""
    model_role: str = Field(
        default="default",
        description="模型角色标识（统一配置模式下为 default）"
    )
    api_base_url: str = Field(
        ...,
        min_length=1,
        description="OpenAI兼容的API基础URL，如 https://api.openai.com/v1"
    )
    model_name: str = Field(
        ...,
        min_length=1,
        description="模型名称，如 gpt-4, gpt-3.5-turbo, deepseek-chat"
    )

    # 高级参数
    temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="温度参数，控制输出随机性，0-2之间"
    )
    max_tokens: int = Field(
        default=2048,
        ge=MIN_LLM_OUTPUT_TOKENS,
        le=MAX_LLM_OUTPUT_TOKENS,
        description="最大输出token数"
    )
    timeout_seconds: int = Field(
        default=30,
        ge=5,
        le=120,
        description="请求超时时间（秒）"
    )


class LLMConfigCreate(LLMConfigBase):
    """创建LLM配置请求"""
    api_key: str = Field(
        ...,
        min_length=10,
        description="API密钥"
    )


class LLMConfigUpdate(BaseModel):
    """更新LLM配置请求（所有字段可选）"""
    api_base_url: Optional[str] = Field(default=None, min_length=1)
    api_key: Optional[str] = Field(default=None, min_length=10)
    model_name: Optional[str] = Field(default=None, min_length=1)
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(
        default=None,
        ge=MIN_LLM_OUTPUT_TOKENS,
        le=MAX_LLM_OUTPUT_TOKENS,
    )
    timeout_seconds: Optional[int] = Field(default=None, ge=5, le=120)
    is_active: Optional[bool] = None

    @field_validator("api_key", "api_base_url", "model_name", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        """将空字符串转换为None，允许用户保留原值"""
        if v == "":
            return None
        return v


class LLMConfigResponse(BaseModel):
    """LLM配置响应（不包含完整API Key）"""
    id: str
    user_id: str
    model_role: str
    api_base_url: str
    model_name: str
    temperature: float
    max_tokens: int
    timeout_seconds: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    api_key_masked: str = Field(description="API Key掩码，如 sk-xx...xxxx")

    model_config = {"from_attributes": True}

    @field_validator("id", "user_id", mode="before")
    @classmethod
    def convert_uuid_to_str(cls, v):
        """将UUID对象转换为字符串，修复pydantic验证错误"""
        if v is not None and not isinstance(v, str):
            return str(v)
        return v

    @field_validator("temperature", mode="before")
    @classmethod
    def convert_temperature(cls, v):
        """将数据库存储的整数转换为浮点数"""
        if isinstance(v, int) and v > 2:
            return v / 100
        return v


class LLMConfigListResponse(BaseModel):
    """LLM配置列表响应"""
    configs: list[LLMConfigResponse]
    total: int


class LLMConfigTestRequest(BaseModel):
    """测试LLM配置请求"""
    # 测试已保存的配置
    config_id: Optional[str] = None

    # 或者直接测试未保存的配置
    api_base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(
        default=None,
        ge=MIN_LLM_OUTPUT_TOKENS,
        le=MAX_LLM_OUTPUT_TOKENS,
    )
    timeout_seconds: Optional[int] = Field(default=None, ge=5, le=120)

    @field_validator(
        "config_id",
        "api_base_url",
        "api_key",
        "model_name",
        mode="before",
    )
    @classmethod
    def empty_str_to_none(cls, v):
        """将空字符串转换为None"""
        if v == "":
            return None
        return v


class LLMConfigTestResponse(BaseModel):
    """测试LLM配置响应"""
    success: bool
    message: str
    latency_ms: Optional[int] = None
    model_info: Optional[Dict[str, Any]] = None
