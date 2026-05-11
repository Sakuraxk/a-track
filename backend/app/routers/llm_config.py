"""
LLM配置路由
管理用户的LLM API配置
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.db import get_db
from app.core.config import settings
from app.dependencies.auth import get_current_user_id
from app.models.llm_config import UserLLMConfig
from app.schemas.llm_config import (
    LLMConfigCreate, LLMConfigUpdate, LLMConfigResponse,
    LLMConfigListResponse, LLMConfigTestRequest, LLMConfigTestResponse
)
from app.services.encryption import encryption_service
from app.services.llm_service import LLMServiceFactory
from app.services.llm_json_utils import parse_llm_json


router = APIRouter()


class SystemLLMStatusResponse(BaseModel):
    """System LLM status response"""
    connected: bool
    model: str
    message: str
    latency_ms: float = 0


async def _probe_learning_path_runtime(service) -> dict:
    """使用接近学习星图的 raw_completion 参数探测运行时兼容性。"""
    effective_timeout = max(int(getattr(service, "timeout", 30) or 30), 30)
    effective_max_tokens = max(100, min(int(getattr(service, "max_tokens", 128) or 128), 128))
    finish_reason = None
    raw_content = ""

    try:
        raw_content, finish_reason = await service.raw_completion(
            [
                {"role": "system", "content": "You are a JSON-only assistant."},
                {
                    "role": "user",
                    "content": (
                        'Return a compact JSON object exactly like {"status":"ok","mode":"json"}. '
                        "Do not add markdown fences or any extra text."
                    ),
                },
            ],
            temperature=0,
            max_tokens=effective_max_tokens,
            timeout_override=effective_timeout,
            use_json_mode=True,
        )
        data = parse_llm_json(str(raw_content or ""))
        if str(data.get("status") or "").strip().lower() != "ok":
            raise ValueError(f"unexpected json payload: {data}")
        return {
            "success": True,
            "message": "连接成功，且已通过学习星图运行时兼容性检测",
            "details": {
                "runtime_probe": {
                    "success": True,
                    "effective_timeout": effective_timeout,
                    "effective_max_tokens": effective_max_tokens,
                    "use_json_mode": True,
                    "finish_reason": finish_reason,
                }
            },
        }
    except Exception as exc:
        return {
            "success": False,
            "message": (
                "连接成功，但学习星图运行时兼容性检测失败："
                f"{type(exc).__name__}: {exc}"
            ),
            "details": {
                "runtime_probe": {
                    "success": False,
                    "effective_timeout": effective_timeout,
                    "effective_max_tokens": effective_max_tokens,
                    "use_json_mode": True,
                    "finish_reason": finish_reason,
                    "raw_preview": str(raw_content or "")[:200],
                    "error_type": type(exc).__name__,
                    "error": str(exc),
                }
            },
        }


@router.get("/status", response_model=SystemLLMStatusResponse, summary="🔌 检测系统 LLM 连接状态")
async def get_system_llm_status() -> SystemLLMStatusResponse:
    """
    检测系统默认 LLM API 的连接状态

    此端点用于检查配置在 config.toml 中的系统默认 LLM 是否可用。
    无需用户认证即可调用。
    """
    if not settings.use_system_llm or not settings.deepseek_api_key:
        return SystemLLMStatusResponse(
            connected=False,
            model="",
            message="系统 LLM 未启用或未配置 API Key"
        )

    try:
        service = LLMServiceFactory.create(
            api_base_url=settings.deepseek_base_url,
            api_key=settings.deepseek_api_key,
            model_name=settings.deepseek_model,
            timeout=10  # Shorter timeout for status check
        )
        result = await service.test_connection()

        return SystemLLMStatusResponse(
            connected=result.get("success", False),
            model=settings.deepseek_model,
            message=result.get("message", "连接成功"),
            latency_ms=result.get("latency_ms", 0)
        )
    except Exception as e:
        return SystemLLMStatusResponse(
            connected=False,
            model=settings.deepseek_model,
            message=f"连接失败: {str(e)}"
        )


@router.get("/", response_model=LLMConfigListResponse, summary="📋 获取所有配置")
async def list_configs(
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> LLMConfigListResponse:
    """
    获取用户的所有LLM配置

    返回用户配置的所有模型信息，API Key 会以掩码形式显示（如 `sk-****abcd`）。
    """
    stmt = select(UserLLMConfig).where(UserLLMConfig.user_id == current_user_id)
    result = await db.execute(stmt)
    configs = result.scalars().all()

    responses = []
    for config in configs:
        # 解密API Key用于生成掩码，如果解密失败则按明文或空处理
        try:
            if config.api_key_encrypted:
                decrypted_key = encryption_service.decrypt(config.api_key_encrypted)
            else:
                decrypted_key = ""
        except ValueError:
            # 解密失败时返回空字符串，避免泄露密文
            decrypted_key = ""
            
        responses.append(LLMConfigResponse(
            id=str(config.id),
            user_id=str(config.user_id),
            model_role=config.model_role,
            api_base_url=config.api_base_url,
            model_name=config.model_name,
            temperature=config.temperature / 100,  # 转换为浮点数
            max_tokens=config.max_tokens,
            timeout_seconds=config.timeout_seconds,
            is_active=config.is_active,
            created_at=config.created_at,
            updated_at=config.updated_at,
            api_key_masked=encryption_service.mask_api_key(decrypted_key)
        ))

    return LLMConfigListResponse(configs=responses, total=len(responses))


@router.get("/{config_id}", response_model=LLMConfigResponse, summary="🔍 获取单个配置")
async def get_config(
    config_id: str,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> LLMConfigResponse:
    """获取指定ID的LLM配置详情"""
    stmt = select(UserLLMConfig).where(
        and_(
            UserLLMConfig.id == config_id,
            UserLLMConfig.user_id == current_user_id
        )
    )
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="未找到该配置")

    try:
        decrypted_key = encryption_service.decrypt(config.api_key_encrypted) if config.api_key_encrypted else ""
    except ValueError:
        decrypted_key = ""

    return LLMConfigResponse(
        id=str(config.id),
        user_id=str(config.user_id),
        model_role=config.model_role,
        api_base_url=config.api_base_url,
        model_name=config.model_name,
        temperature=config.temperature / 100,
        max_tokens=config.max_tokens,
        timeout_seconds=config.timeout_seconds,
        is_active=config.is_active,
        created_at=config.created_at,
        updated_at=config.updated_at,
        api_key_masked=encryption_service.mask_api_key(decrypted_key)
    )


@router.post("/", response_model=LLMConfigResponse, status_code=status.HTTP_201_CREATED, summary="➕ 创建新配置")
async def create_config(
    payload: LLMConfigCreate,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> LLMConfigResponse:
    """
    创建新的LLM配置

    ## 📌 说明
    - 每个用户只保留一份统一配置
    - 如果已存在配置，请使用 PUT 方法更新
    - API Key 会被加密存储
    """
    # 检查是否已存在配置（每个用户只保留一份）
    stmt = select(UserLLMConfig).where(
        UserLLMConfig.user_id == current_user_id
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"已存在AI配置（ID: {existing.id}），请使用PUT更新"
        )

    # 加密API Key
    encrypted_key = encryption_service.encrypt(payload.api_key)

    config = UserLLMConfig(
        user_id=current_user_id,
        model_role=payload.model_role,
        api_base_url=payload.api_base_url,
        api_key_encrypted=encrypted_key,
        model_name=payload.model_name,
        temperature=int(payload.temperature * 100),  # 转换为整数存储
        max_tokens=payload.max_tokens,
        timeout_seconds=payload.timeout_seconds
    )

    db.add(config)
    await db.commit()
    await db.refresh(config)

    return LLMConfigResponse(
        id=str(config.id),
        user_id=str(config.user_id),
        model_role=config.model_role,
        api_base_url=config.api_base_url,
        model_name=config.model_name,
        temperature=payload.temperature,
        max_tokens=config.max_tokens,
        timeout_seconds=config.timeout_seconds,
        is_active=config.is_active,
        created_at=config.created_at,
        updated_at=config.updated_at,
        api_key_masked=encryption_service.mask_api_key(payload.api_key)
    )


@router.put("/{config_id}", response_model=LLMConfigResponse, summary="✏️ 更新配置")
async def update_config(
    config_id: str,
    payload: LLMConfigUpdate,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> LLMConfigResponse:
    """更新指定的LLM配置，只需传入要修改的字段"""
    stmt = select(UserLLMConfig).where(
        and_(
            UserLLMConfig.id == config_id,
            UserLLMConfig.user_id == current_user_id
        )
    )
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")

    # 更新字段
    if payload.api_base_url is not None:
        config.api_base_url = payload.api_base_url
    if payload.api_key is not None:
        config.api_key_encrypted = encryption_service.encrypt(payload.api_key)
    if payload.model_name is not None:
        config.model_name = payload.model_name
    if payload.temperature is not None:
        config.temperature = int(payload.temperature * 100)
    if payload.max_tokens is not None:
        config.max_tokens = payload.max_tokens
    if payload.timeout_seconds is not None:
        config.timeout_seconds = payload.timeout_seconds
    if payload.is_active is not None:
        config.is_active = payload.is_active

    await db.commit()
    await db.refresh(config)

    try:
        decrypted_key = encryption_service.decrypt(config.api_key_encrypted) if config.api_key_encrypted else ""
    except ValueError:
        decrypted_key = ""
    return LLMConfigResponse(
        id=str(config.id),
        user_id=str(config.user_id),
        model_role=config.model_role,
        api_base_url=config.api_base_url,
        model_name=config.model_name,
        temperature=config.temperature / 100,
        max_tokens=config.max_tokens,
        timeout_seconds=config.timeout_seconds,
        is_active=config.is_active,
        created_at=config.created_at,
        updated_at=config.updated_at,
        api_key_masked=encryption_service.mask_api_key(decrypted_key)
    )


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT, summary="🗑️ 删除配置")
async def delete_config(
    config_id: str,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """删除指定的LLM配置"""
    stmt = select(UserLLMConfig).where(
        and_(
            UserLLMConfig.id == config_id,
            UserLLMConfig.user_id == current_user_id
        )
    )
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")

    await db.delete(config)
    await db.commit()


@router.post("/test", response_model=LLMConfigTestResponse, summary="🧪 测试API连接")
async def test_config(
    payload: LLMConfigTestRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> LLMConfigTestResponse:
    """
    测试LLM API连接

    ## 📝 使用方式

    **方式一**：测试已保存的配置
    ```json
    { "config_id": "your-config-id" }
    ```

    **方式二**：测试未保存的配置
    ```json
    {
      "api_base_url": "https://api.deepseek.com/v1",
      "api_key": "sk-xxx",
      "model_name": "deepseek-chat"
    }
    ```
    """
    if payload.config_id:
        # 测试已保存的配置
        stmt = select(UserLLMConfig).where(
            and_(
                UserLLMConfig.id == payload.config_id,
                UserLLMConfig.user_id == current_user_id
            )
        )
        result = await db.execute(stmt)
        config = result.scalar_one_or_none()

        if not config:
            raise HTTPException(status_code=404, detail="配置不存在")

        api_base_url = payload.api_base_url or config.api_base_url
        model_name = payload.model_name or config.model_name
        temperature = payload.temperature if payload.temperature is not None else (config.temperature / 100)
        max_tokens = payload.max_tokens if payload.max_tokens is not None else config.max_tokens
        timeout_seconds = payload.timeout_seconds if payload.timeout_seconds is not None else config.timeout_seconds

        if payload.api_key:
            api_key = payload.api_key
        else:
            try:
                api_key = encryption_service.decrypt(config.api_key_encrypted) if config.api_key_encrypted else ""
            except ValueError:
                api_key = ""
        service = LLMServiceFactory.create(
            api_base_url=api_base_url,
            api_key=api_key,
            model_name=model_name,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout_seconds,
        )
    else:
        # 测试未保存的配置
        if not all([payload.api_base_url, payload.api_key, payload.model_name]):
            raise HTTPException(
                status_code=400,
                detail="需要提供 api_base_url, api_key 和 model_name，或者提供 config_id"
            )

        service = LLMServiceFactory.create(
            api_base_url=payload.api_base_url,
            api_key=payload.api_key,
            model_name=payload.model_name,
            temperature=payload.temperature,
            max_tokens=payload.max_tokens,
            timeout=payload.timeout_seconds,
        )

    result = await service.test_connection()
    model_info = result.get("model_info")
    if not isinstance(model_info, dict):
        model_info = {}

    model_info["effective_config"] = {
        "api_base_url": getattr(service, "api_base_url", ""),
        "model_name": getattr(service, "model_name", ""),
        "temperature": getattr(service, "temperature", None),
        "max_tokens": getattr(service, "max_tokens", None),
        "timeout_seconds": getattr(service, "timeout", None),
    }

    if result.get("success"):
        runtime_probe = await _probe_learning_path_runtime(service)
        result["success"] = runtime_probe["success"]
        result["message"] = runtime_probe["message"]
        model_info.update(runtime_probe["details"])

    result["model_info"] = model_info
    return LLMConfigTestResponse(**result)
