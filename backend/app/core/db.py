from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional, Dict, Any
import sys
import asyncio
import time
import logging

# Windows asyncpg compatibility fix - 必须在创建引擎之前设置
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker, AsyncEngine
from sqlalchemy.engine import make_url
from sqlalchemy.pool import NullPool
from sqlalchemy import text

from app.core.config import settings
from app.models.base import Base

logger = logging.getLogger(__name__)

# Lazy initialization globals
_engine: Optional[AsyncEngine] = None
_engine_lock: Optional[asyncio.Lock] = None
_session_factory: Optional[async_sessionmaker] = None
_session_factory_lock: Optional[asyncio.Lock] = None


def _get_engine_lock() -> asyncio.Lock:
    """Get or create the engine lock.

    Lock must be created after event loop is initialized, not at module import time.
    """
    global _engine_lock
    if _engine_lock is None:
        _engine_lock = asyncio.Lock()
    return _engine_lock


def _get_session_factory_lock() -> asyncio.Lock:
    """Get or create the session factory lock (separate from engine lock to avoid deadlock)."""
    global _session_factory_lock
    if _session_factory_lock is None:
        _session_factory_lock = asyncio.Lock()
    return _session_factory_lock


def get_engine_config():
    """Configure engine based on database type and environment."""
    config = {
        "future": True,
        "echo": settings.db_echo or settings.environment == "local",
    }

    # PostgreSQL-specific optimizations
    if not settings.database_url.startswith("sqlite"):
        # Async engines use AsyncAdaptedQueuePool by default; do not force QueuePool (sync-only).
        base_config = {
            "pool_size": settings.db_pool_size,
            "max_overflow": settings.db_pool_max_overflow,
            "pool_timeout": settings.db_pool_timeout,
            "pool_recycle": settings.db_pool_recycle,
            "pool_pre_ping": True,  # Enable connection health check to prevent using stale connections
        }

        # Driver-specific connection arguments
        if "psycopg" in settings.database_url:
            # psycopg (psycopg3) connection arguments
            base_config["connect_args"] = {
                "options": "-c application_name=ai-learning-platform -c jit=off",
                "connect_timeout": 60,  # Connection timeout in seconds
            }
            try:
                parsed_url = make_url(settings.database_url)
                if parsed_url.host == "localhost":
                    # On Windows, psycopg may spend a long time on localhost name resolution.
                    # Supplying hostaddr skips that slow path while preserving the visible host.
                    base_config["connect_args"]["hostaddr"] = "127.0.0.1"
            except Exception:
                pass
        else:
            # asyncpg connection arguments
            base_config["connect_args"] = {
                "server_settings": {
                    "application_name": "ai-learning-platform",
                    "jit": "off",  # Disable JIT for better connection pool performance
                },
                "command_timeout": 60,  # Query timeout
                "timeout": 60,  # Connection timeout (increased for Windows compatibility)
                "ssl": False,  # Disable SSL for local development
            }

        config.update(base_config)
    else:
        # SQLite uses NullPool for development
        config["poolclass"] = NullPool

    return config


async def get_engine() -> AsyncEngine:
    """Get or create the async engine (lazy initialization).

    This ensures the event loop policy is set before engine creation,
    fixing Windows asyncpg compatibility issues.
    """
    global _engine
    if _engine is None:
        lock = _get_engine_lock()
        async with lock:
            if _engine is None:  # Double-check locking
                # Log event loop info on Windows (warning only, don't block startup)
                if sys.platform == "win32":
                    policy = asyncio.get_event_loop_policy()
                    loop = asyncio.get_running_loop()
                    logger.info(f"Event loop: {type(loop).__name__}, Policy: {type(policy).__name__}")

                logger.info("Creating async database engine (lazy initialization)...")
                start_time = time.time()
                _engine = create_async_engine(
                    settings.database_url,
                    **get_engine_config()
                )
                elapsed = time.time() - start_time
                logger.info(f"[OK] Engine created in {elapsed:.3f}s")

    return _engine


async def get_session_factory() -> async_sessionmaker:
    """Get or create the session factory.

    NOTE: Uses a separate lock from get_engine() to avoid deadlock.
    asyncio.Lock is NOT reentrant, so if we used the same lock here and
    then called get_engine() (which also acquires the lock), we would deadlock.
    Instead, we acquire the engine first (outside our lock), then create the factory.
    """
    global _session_factory
    if _session_factory is None:
        # First ensure engine exists (uses its own lock internally)
        engine = await get_engine()
        # Then create session factory under a separate lock
        lock = _get_session_factory_lock()
        async with lock:
            if _session_factory is None:  # Double-check locking
                _session_factory = async_sessionmaker(
                    bind=engine,
                    class_=AsyncSession,
                    expire_on_commit=False,
                    autocommit=False,
                    autoflush=False,
                )
    return _session_factory


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """上下文管理器方式获取会话"""
    factory = await get_session_factory()
    session = factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI依赖注入方式获取数据库会话 - 默认无自动提交，适用于读操作或需手动提交的写操作"""
    factory = await get_session_factory()
    session = factory()
    try:
        yield session
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_write_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI依赖注入方式获取数据库会话 - 自动提交，适用于简单的写操作"""
    factory = await get_session_factory()
    session = factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def init_models() -> None:
    """初始化数据库表"""
    engine = await get_engine()  # Lazy initialization ensures event loop is ready
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """关闭数据库连接池"""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
        logger.info("[OK] Database connection pool disposed")


async def verify_connection() -> Dict[str, Any]:
    """Verify database connection is working.

    Returns connection info or raises descriptive error.
    """
    try:
        # Use session instead of raw engine connection to avoid greenlet issues
        async with get_session() as session:
            # Test query
            result = await session.execute(text("SELECT 1 as test"))
            test_value = result.scalar()

            # Get PostgreSQL version if available
            version_result = await session.execute(text("SELECT version()"))
            version = version_result.scalar()

            # Get engine for URL display
            engine = await get_engine()
            url_str = str(engine.url)
            if '@' in url_str:
                url_display = url_str.split('@')[0] + '@***'
            else:
                url_display = "***"

            return {
                "success": True,
                "message": "Database connection successful",
                "version": version,
                "url": url_display,
                "test_query": f"SELECT 1 returned {test_value}"
            }
    except asyncio.TimeoutError as e:
        raise RuntimeError(
            f"Database connection timeout. Possible issues:\n"
            f"  1. PostgreSQL container not running (check: docker ps)\n"
            f"  2. Wrong host/port in DATABASE_URL\n"
            f"  3. Windows firewall blocking connection\n"
            f"Original error: {e}"
        ) from e
    except Exception as e:
        raise RuntimeError(
            f"Database connection failed: {type(e).__name__}: {e}\n"
            f"Check DATABASE_URL in config.toml"
        ) from e
