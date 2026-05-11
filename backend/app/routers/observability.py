from fastapi import APIRouter
from fastapi.responses import JSONResponse
from ..core.db import verify_connection

router = APIRouter()


@router.get("/healthz")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/readiness")
async def readiness() -> dict:
    return {"status": "ready"}


@router.get("/db-health")
async def database_health_check():
    """
    数据库健康检查

    验证数据库连接是否正常工作。

    Returns:
    - **status**: 健康状态 (healthy/unhealthy)
    - **database**: 数据库连接详情
    """
    try:
        result = await verify_connection()
        return {
            "status": "healthy",
            "status_cn": "数据库正常",
            "database": result
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "status_cn": "数据库异常",
                "database": {
                    "success": False,
                    "error": str(e),
                    "error_type": type(e).__name__
                }
            }
        )
