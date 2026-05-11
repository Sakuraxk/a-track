"""FastAPI backend package for the AI-driven adaptive learning platform."""

# 修复 Windows 下 asyncpg 兼容性问题
# 必须在任何异步操作之前设置,包括导入其他模块之前
import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
