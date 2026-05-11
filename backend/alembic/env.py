import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection

from alembic import context

# Windows asyncpg compatibility fix - 必须在创建引擎之前设置
import sys
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Import your app config and models
from pathlib import Path

# Add the parent directory to the path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.models.base import Base

# Import all models to ensure they're registered
from app.models.user import User, UserProfile
from app.models.learning import KnowledgeNode, UserNodeState, LearningTask
from app.models.practice import Exercise, ExerciseResult, Weakness
from app.models.llm_config import UserLLMConfig, ConversationSession, ConversationMessage
from app.models.learning_path import UserLearningPath
from app.models.community import CommunityPost, CommunityComment, CommunityPostLike

# this is the Alembic Config object
config = context.config

# Override sqlalchemy.url with settings from app config
# For Windows compatibility, use psycopg2 (synchronous) instead of asyncpg or psycopg
# Also replace localhost with 127.0.0.1 to force IPv4 connection
database_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
database_url = database_url.replace("postgresql+psycopg://", "postgresql+psycopg2://")
database_url = database_url.replace("localhost", "127.0.0.1")
config.set_main_option("sqlalchemy.url", database_url)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode using synchronous connection."""
    # Use synchronous engine for better Windows compatibility
    from sqlalchemy import engine_from_config

    configuration = config.get_section(config.config_ini_section, {})

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()

    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
