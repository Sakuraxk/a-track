import json
from typing import Any, Optional

async def get_cache(key: str) -> Optional[Any]:
    """Get value from cache."""
    from .redis import redis_client
    if not redis_client:
        return None
    try:
        data = await redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        print(f"[ERROR] Redis get_cache failed for key {key}: {e}")
    return None

async def set_cache(key: str, value: Any, expire: int = 3600) -> None:
    """Set value in cache with expiration time (seconds)."""
    from .redis import redis_client
    if not redis_client:
        return
    try:
        await redis_client.set(key, json.dumps(value), ex=expire)
    except Exception as e:
        print(f"[ERROR] Redis set_cache failed for key {key}: {e}")

async def delete_cache(key: str) -> None:
    """Delete value from cache."""
    from .redis import redis_client
    if not redis_client:
        return
    try:
        await redis_client.delete(key)
    except Exception as e:
        print(f"[ERROR] Redis delete_cache failed for key {key}: {e}")
