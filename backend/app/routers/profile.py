import uuid
from datetime import datetime, timezone
from uuid import UUID

from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..schemas.user import SurveySubmission, AbilityTags, ProfileResponse, ProfileUpdate, PasswordChangeRequest
from ..core.db import get_db
from ..models.user import User, UserProfile
from ..models.llm_config import UserLLMConfig
from ..models.user_memory import (
    UserBehaviorMemory,
    UserPreferenceMemory,
    UserInteractionMemory,
    UserLearningPattern,
    UserContextMemory
)
from ..dependencies.auth import get_current_user_id
from .auth import verify_password, hash_password
from sqlalchemy import delete


router = APIRouter()


@router.get("", response_model=ProfileResponse)
async def get_profile(
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> ProfileResponse:
    """
    获取当前用户档案
    - 从 JWT token 中提取用户 ID
    - 从数据库查询用户信息
    """
    # 查询用户
    user_query = select(User).where(User.id == current_user_id)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 查询用户档案
    profile_query = select(UserProfile).where(UserProfile.user_id == current_user_id)
    profile_result = await db.execute(profile_query)
    profile = profile_result.scalar_one_or_none()

    return ProfileResponse(
        user_id=user.id,
        email=user.email,
        phone=user.phone,
        pace_preference=user.pace_preference,
        ability_tags=user.ability_tags or {},
        portrait=profile.portrait if profile else {},
        created_at=user.created_at,
        last_login=user.last_login
    )


@router.put("", response_model=ProfileResponse)
async def update_profile(
    payload: ProfileUpdate,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> ProfileResponse:
    """
    更新用户档案（入门数据）
    - 更新昵称、学习阶段、学习目标等
    """
    # 查询用户
    user_query = select(User).where(User.id == current_user_id)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 查询或创建用户档案
    profile_query = select(UserProfile).where(UserProfile.user_id == current_user_id)
    profile_result = await db.execute(profile_query)
    profile = profile_result.scalar_one_or_none()

    if not profile:
        profile = UserProfile(
            id=uuid.uuid4(),
            user_id=current_user_id,
            preferences={},
            portrait={},
            updated_at=datetime.now(timezone.utc)
        )
        db.add(profile)

    # 更新档案信息
    if profile.portrait is None:
        profile.portrait = {}

    # 创建新的 portrait 字典（这样 SQLAlchemy 能检测到变化）
    new_portrait = dict(profile.portrait)

    if payload.nickname is not None:
        new_portrait["nickname"] = payload.nickname
    if payload.learning_stage is not None:
        new_portrait["learning_stage"] = payload.learning_stage
    if payload.learning_goals is not None:
        new_portrait["learning_goals"] = ",".join(payload.learning_goals)
    if payload.onboarding_completed is not None:
        new_portrait["onboarding_completed"] = str(payload.onboarding_completed).lower()

    # 重新赋值整个对象，这样 SQLAlchemy 能检测到变化
    profile.portrait = new_portrait
    profile.updated_at = datetime.now(timezone.utc)

    await db.commit()

    return ProfileResponse(
        user_id=user.id,
        email=user.email,
        phone=user.phone,
        pace_preference=user.pace_preference,
        ability_tags=user.ability_tags or {},
        portrait=profile.portrait,
        created_at=user.created_at,
        last_login=user.last_login
    )


@router.post("/survey", response_model=ProfileResponse)
async def submit_survey(
    payload: SurveySubmission,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> ProfileResponse:
    """
    提交问卷调查
    - 保存问卷答案到用户表
    """
    if not payload.answers:
        raise HTTPException(status_code=400, detail="Survey cannot be empty")

    # 查询用户
    user_query = select(User).where(User.id == current_user_id)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 更新问卷答案
    user.survey_answers = payload.answers

    # 查询或创建用户档案
    profile_query = select(UserProfile).where(UserProfile.user_id == current_user_id)
    profile_result = await db.execute(profile_query)
    profile = profile_result.scalar_one_or_none()

    if not profile:
        profile = UserProfile(
            id=uuid.uuid4(),
            user_id=current_user_id,
            preferences={},
            portrait={},
            updated_at=datetime.now(timezone.utc)
        )
        db.add(profile)

    # 更新档案
    if profile.portrait is None:
        profile.portrait = {}
    profile.portrait["survey_questions"] = len(payload.answers)
    profile.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(user)
    await db.refresh(profile)

    return ProfileResponse(
        user_id=user.id,
        email=user.email,
        phone=user.phone,
        pace_preference=user.pace_preference,
        ability_tags=user.ability_tags or {},
        portrait=profile.portrait,
        created_at=user.created_at,
        last_login=user.last_login
    )


@router.post("/pace", response_model=ProfileResponse)
async def set_pace(
    pace: str,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> ProfileResponse:
    """
    设置学习节奏
    - 更新用户的学习节奏偏好
    """
    # 查询用户
    user_query = select(User).where(User.id == current_user_id)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 更新节奏
    user.pace_preference = pace

    await db.commit()
    await db.refresh(user)

    # 查询档案
    profile_query = select(UserProfile).where(UserProfile.user_id == current_user_id)
    profile_result = await db.execute(profile_query)
    profile = profile_result.scalar_one_or_none()

    return ProfileResponse(
        user_id=user.id,
        email=user.email,
        phone=user.phone,
        pace_preference=user.pace_preference,
        ability_tags=user.ability_tags or {},
        portrait=profile.portrait if profile else {},
        created_at=user.created_at,
        last_login=user.last_login
    )


@router.post("/abilities", response_model=ProfileResponse)
async def update_abilities(
    payload: AbilityTags,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> ProfileResponse:
    """
    更新能力标签
    - 保存用户的能力评估结果
    """
    # 查询用户
    user_query = select(User).where(User.id == current_user_id)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 更新能力标签
    user.ability_tags = payload.tags

    await db.commit()
    await db.refresh(user)

    # 查询档案
    profile_query = select(UserProfile).where(UserProfile.user_id == current_user_id)
    profile_result = await db.execute(profile_query)
    profile = profile_result.scalar_one_or_none()

    return ProfileResponse(
        user_id=user.id,
        email=user.email,
        phone=user.phone,
        pace_preference=user.pace_preference,
        ability_tags=user.ability_tags,
        portrait=profile.portrait if profile else {},
        created_at=user.created_at,
        last_login=user.last_login
    )


@router.post("/password")
async def change_password(
    payload: PasswordChangeRequest,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    修改密码
    - 验证旧密码
    - 哈希并保存新密码
    """
    query = select(User).where(User.id == current_user_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="当前密码错误")

    user.hashed_password = hash_password(payload.new_password)
    await db.commit()

    return {"message": "密码修改成功"}


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    上传头像
    - 验证文件类型
    - 保存到 uploads/avatars/
    - 更新用户档案中的 avatar_url
    """
    # 1. 验证文件扩展名
    ext = Path(file.filename).suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        raise HTTPException(status_code=400, detail="不支持的文件格式")

    # 2. 确保目录存在
    save_dir = Path("uploads") / "avatars"
    save_dir.mkdir(parents=True, exist_ok=True)

    # 3. 生成唯一文件名
    filename = f"{current_user_id}_{int(datetime.now().timestamp())}{ext}"
    save_path = save_dir / filename

    # 4. 保存文件 (异步读取写入)
    try:
        content = await file.read()
        with open(save_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存文件失败: {str(e)}")

    # 5. 更新用户档案
    profile_query = select(UserProfile).where(UserProfile.user_id == current_user_id)
    profile_result = await db.execute(profile_query)
    profile = profile_result.scalar_one_or_none()

    if not profile:
        profile = UserProfile(
            id=uuid.uuid4(),
            user_id=current_user_id,
            preferences={},
            portrait={},
            updated_at=datetime.now(timezone.utc)
        )
        db.add(profile)

    if profile.portrait is None:
        profile.portrait = {}

    # 重新赋值以触发 SQLAlchemy 检测
    new_portrait = dict(profile.portrait)
    avatar_url = f"/uploads/avatars/{filename}"
    new_portrait["avatar_url"] = avatar_url
    profile.portrait = new_portrait
    profile.updated_at = datetime.now(timezone.utc)

    await db.commit()

    return {"avatar_url": avatar_url}


@router.delete("/account")
async def delete_account(
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    注销账号
    - 删除用户及相关联的所有数据 (Profile, LLMConfigs, Memories)
    """
    # 1. 删除用户记忆
    memory_models = [
        UserBehaviorMemory,
        UserPreferenceMemory,
        UserInteractionMemory,
        UserLearningPattern,
        UserContextMemory
    ]
    for model in memory_models:
        await db.execute(delete(model).where(model.user_id == current_user_id))

    # 2. 删除LLM配置
    await db.execute(delete(UserLLMConfig).where(UserLLMConfig.user_id == current_user_id))

    # 3. 删除用户档案
    await db.execute(delete(UserProfile).where(UserProfile.user_id == current_user_id))

    # 4. 删除用户本身
    await db.execute(delete(User).where(User.id == current_user_id))

    await db.commit()

    return {"message": "账号已成功注销"}
