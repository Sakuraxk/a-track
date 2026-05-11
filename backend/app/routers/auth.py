import uuid
import asyncio
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from jose import jwt

from ..schemas.user import RegisterRequest, LoginRequest, ProfileResponse
from ..core.db import get_db
from ..core.config import settings
from ..models.user import User, UserProfile


router = APIRouter()

# 密码加密配置（使用 Argon2）
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    """哈希密码"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    """创建 JWT token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_exp_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm="HS256")


@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    用户注册端点
    - 验证邮箱/电话是否已存在
    - 创建用户并保存到数据库
    - 返回 JWT token 和用户信息
    """
    # 验证必填字段
    if not payload.email and not payload.phone:
        raise HTTPException(status_code=400, detail="Email or phone is required")
    if not payload.password:
        raise HTTPException(status_code=400, detail="Password is required")

    # 检查用户是否已存在
    query = select(User)
    if payload.email:
        query = query.where(User.email == payload.email)
    else:
        query = query.where(User.phone == payload.phone)

    result = await db.execute(query)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        # 返回特殊的错误码，前端可以识别并引导用户登录
        raise HTTPException(
            status_code=409,  # 409 Conflict 表示资源冲突
            detail={
                "message": "该邮箱已被注册",
                "suggestion": "您可以直接登录，或使用其他邮箱注册",
                "action": "redirect_to_login",
                "email": payload.email or payload.phone
            }
        )

    # 创建新用户
    user = User(
        id=uuid.uuid4(),
        email=payload.email,
        phone=payload.phone,
        hashed_password=await asyncio.to_thread(hash_password, payload.password),
        pace_preference=payload.pace_preference or "medium",
        created_at=datetime.now(timezone.utc),
        ability_tags={},
        survey_answers={}
    )
    db.add(user)

    # 创建用户档案
    profile = UserProfile(
        id=uuid.uuid4(),
        user_id=user.id,
        preferences={},
        portrait={
            "nickname": "",
            "learning_stage": "",
            "learning_goals": "",
            "onboarding_completed": "false",
            "message": "Onboarding pending survey & diagnostics"
        },
        updated_at=datetime.now(timezone.utc)
    )
    db.add(profile)

    # 设置最后登录时间
    user.last_login = datetime.now(timezone.utc)

    # 一次性提交到数据库
    await db.commit()

    # 生成 JWT token
    token = create_access_token({"sub": str(user.id)})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "user_id": user.id,
            "email": user.email,
            "pace_preference": user.pace_preference,
            "ability_tags": user.ability_tags or {},
            "portrait": profile.portrait or {},
            "created_at": user.created_at,
            "last_login": user.last_login
        }
    }


@router.post("/login", response_model=dict)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    用户登录端点
    - 验证邮箱/电话和密码
    - 返回 JWT token 和用户信息
    """
    # 验证必填字段
    if not payload.email and not payload.phone:
        raise HTTPException(status_code=400, detail="Email or phone is required")
    if not payload.password:
        raise HTTPException(status_code=400, detail="Password is required")

    # 查询用户
    query = select(User)
    if payload.email:
        query = query.where(User.email == payload.email)
    else:
        query = query.where(User.phone == payload.phone)

    result = await db.execute(query)
    user = result.scalar_one_or_none()

    # 用户不存在
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email/phone or password"
        )

    # 验证密码
    if not await asyncio.to_thread(verify_password, payload.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid email/phone or password"
        )

    # 查询用户档案
    profile_query = select(UserProfile).where(UserProfile.user_id == user.id)
    profile_result = await db.execute(profile_query)
    profile = profile_result.scalar_one_or_none()

    # 如果档案不存在，创建一个
    if not profile:
        profile = UserProfile(
            id=uuid.uuid4(),
            user_id=user.id,
            preferences={},
            portrait={
                "nickname": "",
                "learning_stage": "",
                "learning_goals": "",
                "onboarding_completed": "false",
                "message": "Onboarding pending survey & diagnostics"
            },
            updated_at=datetime.now(timezone.utc)
        )
        db.add(profile)

    # 更新最后登录时间
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    # 生成 JWT token
    token = create_access_token({"sub": str(user.id)})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "user_id": user.id,
            "email": user.email,
            "pace_preference": user.pace_preference,
            "ability_tags": user.ability_tags or {},
            "portrait": profile.portrait or {},
            "created_at": user.created_at,
            "last_login": user.last_login
        }
    }
