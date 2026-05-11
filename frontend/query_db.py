import asyncio
import sys
import os
import json

# Add backend to path
sys.path.append(r'd:\文档\GitHub\study\backend')
from app.core.database import get_db

async def run():
    # Because get_db is an async generator, we need to iterate it
    async for db in get_db():
        from sqlalchemy import text
        res = await db.execute(text("SELECT id, stem, options, item_type FROM exercise_items WHERE item_type='mcq' OR stem LIKE '%scanf%'"))
        rows = res.fetchall()
        print(f"Found {len(rows)} matching exercises.")
        for r in rows[:10]:
            print(f"ID: {r.id}")
            print(f"Stem: {r.stem[:100]}")
            print(f"Options: {r.options}")
            print("-" * 50)
        break

if __name__ == '__main__':
    from app.core.config import settings
    # Setup asyncio gracefully on Windows
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run())
