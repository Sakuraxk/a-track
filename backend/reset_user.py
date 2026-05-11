import asyncio
import uuid
from datetime import datetime, timezone
from sqlalchemy import text
from app.core.db import get_db
from app.models.user import User, UserProfile
from app.routers.auth import hash_password

async def reset_user(email):
    async for db in get_db():
        # Clear existing data manually via SQL to avoid relationship/type issues
        await db.execute(text("DELETE FROM user_profiles WHERE user_id IN (SELECT id FROM users WHERE email = :email)"), {"email": email})
        await db.execute(text("DELETE FROM users WHERE email = :email"), {"email": email})
        await db.commit()
        
        # Create fresh
        user = User(
            id=uuid.uuid4(),
            email=email,
            hashed_password=hash_password("123456"),
            pace_preference="medium",
            created_at=datetime.now(timezone.utc),
            ability_tags={},
            survey_answers={}
        )
        db.add(user)
        
        # We need the user committed to have the ID for the profile relationship if not using FK directly
        await db.flush() 

        profile = UserProfile(
            id=uuid.uuid4(),
            user_id=user.id,
            preferences={},
            portrait={
                "nickname": "测试用户",
                "learning_stage": "",
                "learning_goals": "",
                "onboarding_completed": "false"
            },
            updated_at=datetime.now(timezone.utc)
        )
        db.add(profile)
        await db.commit()
        print(f"Success: User {email} has been reset. Password is now: 123456")
        break

if __name__ == "__main__":
    asyncio.run(reset_user("3089484538@qq.com"))
