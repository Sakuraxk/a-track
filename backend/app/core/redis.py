import redis.asyncio as redis
from typing import AsyncGenerator
from fastapi import Request
from .config import settings

# Global Redis client
redis_client: redis.Redis | None = None

async def init_redis() -> None:
    """Initialize Redis connection pool."""
    global redis_client
    if redis_client is None:
        try:
            redis_client = redis.from_url(
                settings.redis_url, 
                encoding="utf-8", 
                decode_responses=True
            )
            # Test connection
            await redis_client.ping()
            print("[OK] Redis connected successfully.")
        except Exception as e:
            print(f"[ERROR] Redis connection failed: {e}")
            redis_client = None

async def close_redis() -> None:
    """Close Redis connection pool."""
    global redis_client
    if redis_client:
        await redis_client.close()
        redis_client = None
        print("[OK] Redis connection closed.")

async def get_redis() -> AsyncGenerator[redis.Redis, None]:
    """FastAPI dependency to get Redis client."""
    if redis_client is None:
        raise Exception("Redis not initialized")
    yield redis_client
