import asyncio
import sys
import os
import json

# Add backend to path
sys.path.append(r'd:\文档\GitHub\study\backend')
from app.core.database import get_db

async def run():
    async for db in get_db():
        from sqlalchemy import text
        # Fetch the specific item
        res = await db.execute(text("SELECT id, stem, options FROM exercise_items WHERE stem LIKE '%获取用户输入%'"))
        rows = res.fetchall()
        for r in rows:
            if 'scanf()' in str(r.options):
                print(f"Updating ID: {r.id}")
                
                # Correct the stem if it has a typo "用于从获取" -> "用于获取"
                new_stem = r.stem.replace("用于从获取", "用于获取")
                
                # Correct the options
                new_options = [
                    {'label': 'A', 'text': 'print()', 'is_correct': False},
                    {'label': 'B', 'text': 'input()', 'is_correct': True},
                    {'label': 'C', 'text': 'read()', 'is_correct': False},
                    {'label': 'D', 'text': 'scanf()', 'is_correct': False}
                ]
                
                # Update the database
                await db.execute(text("UPDATE exercise_items SET stem = :stem, options = :options WHERE id = :id"), 
                                 {"stem": new_stem, "options": json.dumps(new_options), "id": r.id})
                await db.commit()
                print("Update successful!")
        break

if __name__ == '__main__':
    from app.core.config import settings
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run())
