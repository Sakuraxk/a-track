"""
Database module (compatibility layer)

Legacy code uses `app.core.database` / `..core.database` as import path.
Current implementation is in `app.core.db`, this provides compatibility forwarding.
"""

from .db import get_db, get_session, init_models, get_engine, verify_connection, close_db

__all__ = [
    "get_db",
    "get_session",
    "init_models",
    "get_engine",
    "verify_connection",
    "close_db",
]

# BREAKING CHANGE: 'engine' and 'AsyncSessionLocal' are no longer exported
# - Use `await get_engine()` for engine access
# - Use `get_db()` or `get_session()` for sessions
# This change fixes Windows asyncpg timeout issues by ensuring proper
# event loop initialization before engine creation.
