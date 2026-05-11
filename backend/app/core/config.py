import tomllib
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def load_toml_config() -> Dict[str, Any]:
    """Load configuration from config.toml if it exists"""
    config_path = Path(__file__).parent.parent.parent / "config.toml"
    if config_path.exists():
        with open(config_path, "rb") as f:
            return tomllib.load(f)
    return {}


# Load TOML config once at module level
_toml_config = load_toml_config()


class Settings(BaseSettings):
    app_name: str = _toml_config.get("app", {}).get("name", "AI-driven Python Adaptive Learning Platform")
    environment: str = Field(
        _toml_config.get("app", {}).get("environment", "local"),
        description="Deployment environment name"
    )

    # Database & cache (SQLite for development, PostgreSQL for production)
    database_url: str = Field(
        _toml_config.get("database", {}).get("url", "sqlite+aiosqlite:///./learning.db"),
        description="Async SQLAlchemy URL (SQLite for dev, PostgreSQL for prod)"
    )
    redis_url: str = Field("redis://localhost:6379/0", description="Redis connection URL")

    # PostgreSQL Connection Pool Configuration
    db_pool_size: int = Field(
        _toml_config.get("database", {}).get("pool_size", 20),
        description="Database connection pool size"
    )
    db_pool_max_overflow: int = Field(
        _toml_config.get("database", {}).get("pool_max_overflow", 10),
        description="Maximum overflow connections beyond pool_size"
    )
    db_pool_timeout: int = Field(
        _toml_config.get("database", {}).get("pool_timeout", 30),
        description="Connection pool timeout in seconds"
    )
    db_pool_recycle: int = Field(
        _toml_config.get("database", {}).get("pool_recycle", 3600),
        description="Recycle connections after N seconds (prevents stale connections)"
    )
    db_pool_pre_ping: bool = Field(
        _toml_config.get("database", {}).get("pool_pre_ping", True),
        description="Test connection health before using from pool"
    )
    db_echo: bool = Field(
        _toml_config.get("database", {}).get("echo", False),
        description="Echo SQL queries to console (debug only)"
    )

    # AI model endpoints (system defaults, users can override)
    default_model: str = Field("explainer", description="Default model routing key")
    explainer_model_endpoint: str = Field("http://llm/explainer", description="LLM endpoint for explanation-heavy mode")
    coder_model_endpoint: str = Field("http://llm/coder", description="LLM endpoint for code-heavy mode")

    # LLM default settings (from TOML or defaults)
    default_llm_timeout: int = Field(
        _toml_config.get("llm", {}).get("defaults", {}).get("timeout", 30),
        description="Default LLM request timeout in seconds"
    )
    default_llm_max_tokens: int = Field(
        _toml_config.get("llm", {}).get("defaults", {}).get("max_tokens", 2048),
        description="Default max tokens for LLM response"
    )
    default_llm_temperature: float = Field(
        _toml_config.get("llm", {}).get("defaults", {}).get("temperature", 0.7),
        description="Default temperature for LLM"
    )

    # Security
    jwt_secret: str = Field("dev-secret-change-in-production", description="Secret for signing JWTs")
    jwt_exp_minutes: int = Field(60 * 24, description="JWT expiration in minutes")

    # Encryption (for API keys) - prefer TOML, fallback to default
    encryption_key: str = Field(
        _toml_config.get("security", {}).get("encryption_key", "") or "dev-encryption-key-32-chars-xx",
        description="32-character key for encrypting sensitive data like API keys"
    )

    # Conversation limits
    max_conversation_history: int = Field(50, description="Max messages per conversation session")
    max_message_length: int = Field(4000, description="Max characters per message")

    # DeepSeek System Default LLM Configuration (from TOML)
    deepseek_api_key: str = Field(
        _toml_config.get("llm", {}).get("system", {}).get("api_key", ""),
        description="DeepSeek API key for system default LLM"
    )
    deepseek_base_url: str = Field(
        _toml_config.get("llm", {}).get("system", {}).get("base_url", "https://api.deepseek.com/v1"),
        description="DeepSeek API base URL"
    )
    deepseek_model: str = Field(
        _toml_config.get("llm", {}).get("system", {}).get("model", "deepseek-chat"),
        description="DeepSeek model name"
    )
    use_system_llm: bool = Field(
        _toml_config.get("llm", {}).get("system", {}).get("enabled", True),
        description="Enable system-level LLM for users without their own config"
    )
    llm_startup_check: bool = Field(
        _toml_config.get("llm", {}).get("system", {}).get("startup_check", False),
        description="Whether to probe system LLM connectivity during app startup"
    )

    # 优先读取当前目录的 .env；若从 backend 目录运行，则再回退读取项目根目录的 ../.env
    # 这样 docker-compose 使用的根目录 .env（含 POSTGRES_PORT / DATABASE_URL）也能被后端与 alembic 识别到
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        # 允许 `.env` 中包含 docker-compose 使用的 POSTGRES_* 等变量，避免 Settings 初始化时报错
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
