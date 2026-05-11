"""
JWT 认证依赖

提供可重用的 JWT token 验证依赖
"""
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security.http import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from ..core.config import settings


# HTTP Bearer 认证方案
security = HTTPBearer()


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UUID:
    """
    从 JWT token 中提取当前用户 ID

    Args:
        credentials: HTTP Bearer token

    Returns:
        UUID: 当前用户的 ID

    Raises:
        HTTPException: 如果 token 无效或过期
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # 解码 JWT token
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=["HS256"]
        )

        # 提取用户 ID
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception

        # 转换为 UUID
        user_id = UUID(user_id_str)
        return user_id

    except JWTError:
        raise credentials_exception
    except ValueError:
        raise credentials_exception
