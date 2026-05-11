"""
启动脚本 - 修复 Windows 下 asyncpg/psycopg 的兼容性问题
"""
import sys
import os
from pathlib import Path

# 必须在导入 asyncio 之前设置环境变量
if sys.platform == "win32":
    # 强制 uvicorn 使用 asyncio 而不是 uvloop
    os.environ["UVICORN_LOOP"] = "asyncio"

import asyncio

# 必须在导入任何其他模块之前设置事件循环策略
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    print("[OK] Windows compatibility fix applied: WindowsSelectorEventLoopPolicy")


def _load_env_from_file() -> None:
    """Load BACKEND_PORT from .env files if it is not present in process env."""
    if os.getenv("BACKEND_PORT"):
        return

    for env_path in (Path(".env"), Path("../.env")):
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            if key.strip() == "BACKEND_PORT":
                os.environ["BACKEND_PORT"] = value.strip()
                return

if __name__ == "__main__":
    import uvicorn

    _load_env_from_file()
    backend_port = int(os.getenv("BACKEND_PORT", "8010"))

    # Windows 下使用 asyncio loop，支持热重载
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=backend_port,
        reload=True,  # 启用热重载
        loop="asyncio",  # 强制使用 asyncio 而不是 uvloop
        log_level="info",
        # Windows 下重要：确保子进程也使用正确的事件循环
        use_colors=True,
    )


