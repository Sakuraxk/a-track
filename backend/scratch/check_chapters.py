import asyncio
import uuid
from app.core.db import get_session, close_db
from app.models.subject import Subject, Chapter
from sqlalchemy import select

async def check():
    async with get_session() as db:
        s = await db.execute(select(Subject).where(Subject.key == 'python'))
        sub = s.scalar_one_or_none()
        if sub:
            print(f"Subject found: {sub.name} ({sub.id})")
            c = await db.execute(select(Chapter).where(Chapter.subject_id == sub.id).order_by(Chapter.order_index))
            chapters = c.scalars().all()
            for ch in chapters:
                print(f"{ch.order_index}: {ch.title} ({ch.code}) - {ch.id}")
        else:
            print("Subject 'python' not found")

if __name__ == "__main__":
    try:
        asyncio.run(check())
    finally:
        asyncio.run(close_db())
