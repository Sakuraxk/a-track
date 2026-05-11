"""
Re-enable all subjects that were previously disabled.
"""
import asyncio
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.subject import Subject


async def enable_all():
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as db:
        await db.execute(update(Subject).values(is_active=True))
        await db.commit()
        print("All subjects re-enabled (is_active=True)")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(enable_all())
