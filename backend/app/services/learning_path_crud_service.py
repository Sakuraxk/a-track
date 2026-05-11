"""
学习路线 CRUD 与版本管理服务

从 ai_learning_path_service.py 拆分而来，包含所有数据库
CRUD 操作和版本管理逻辑。
"""
import uuid
import logging
from datetime import datetime, timezone

from ..models.base import utcnow_naive
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from ..models.learning_path import UserLearningPath
from ..services.learning_path_models import LearningPath
from ..services.user_memory_service import UserMemoryService

logger = logging.getLogger(__name__)


class LearningPathCRUDService:
    """学习路线数据库 CRUD 与版本管理"""

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _recompute_progress(path: LearningPath) -> None:
        total_tasks = sum(len(d.tasks) for d in path.days)
        completed_tasks = sum(1 for d in path.days for t in d.tasks if t.completed)
        path.progress_percent = (completed_tasks / max(total_tasks, 1)) * 100
        # 更新当前天数：找到第一天未完成的任务
        path.current_day = 1
        for day_item in path.days:
            if any(not t.completed for t in day_item.tasks):
                path.current_day = day_item.day
                break
            path.current_day = day_item.day  # 全完成时落在最后一天

    async def upsert_learning_path(
        self,
        path: LearningPath,
        subject_key: Optional[str] = None,
        version: Optional[int] = None,
        version_name: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> None:
        """将学习路线保存到数据库（存在则更新，不存在则插入），支持版本参数"""
        result = await self.db.execute(
            select(UserLearningPath).where(UserLearningPath.id == path.id)
        )
        record = result.scalar_one_or_none()

        payload = path.model_dump()
        if record is None:
            record = UserLearningPath(
                id=path.id,
                user_id=path.user_id,
                subject_key=subject_key or "python",
                goal=path.goal,
                total_days=path.total_days,
                daily_minutes=path.daily_minutes,
                data=payload,
                version=version or 1,
                version_name=version_name,
                is_active=is_active if is_active is not None else True
            )
            self.db.add(record)
        else:
            record.user_id = path.user_id
            if subject_key is not None:
                record.subject_key = subject_key
            record.goal = path.goal
            record.total_days = path.total_days
            record.daily_minutes = path.daily_minutes
            record.data = payload
            record.updated_at = utcnow_naive()

            # 更新版本信息（如果提供）
            if version is not None:
                record.version = version
            if version_name is not None:
                record.version_name = version_name
            if is_active is not None:
                record.is_active = is_active

        # 让错误尽早暴露（例如主键冲突/字段类型问题），并确保真正落库
        try:
            await self.db.flush()
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise

    async def get_learning_path(self, path_id: str) -> Optional[LearningPath]:
        """按ID获取学习路线（不存在返回None）"""
        try:
            valid_path_id = uuid.UUID(path_id)
        except (ValueError, TypeError):
            return None

        result = await self.db.execute(
            select(UserLearningPath).where(UserLearningPath.id == valid_path_id)
        )
        record = result.scalar_one_or_none()
        if not record or not record.data:
            return None
        path = LearningPath(**record.data)
        # 将数据库字段同步到 path 对象中，确保 metadata 最新
        path.version = record.version
        path.version_name = record.version_name
        path.is_active = record.is_active
        path.archived_at = record.archived_at.isoformat() if record.archived_at else None

        # 兼容历史数据：若未写入 generated_days，则用当前 days 数推导
        if not path.generated_days:
            path.generated_days = len(path.days or [])
        return path

    async def get_learning_path_subject_key(self, path_id: str) -> str:
        """获取学习路线对应的 subject_key（默认 python）"""
        try:
            valid_path_id = uuid.UUID(path_id)
        except (ValueError, TypeError):
            logger.warning(f"[AI Path] 无效 path_id={path_id}，subject_key 回退为 python")
            return "python"
        result = await self.db.execute(
            select(UserLearningPath.subject_key).where(UserLearningPath.id == valid_path_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            logger.warning(f"[AI Path] path_id={path_id} 无 subject_key 记录，回退为 python")
        return row or "python"

    async def list_user_paths(
        self,
        user_id: str,
        subject_key: Optional[str] = None,
        include_archived: bool = False
    ) -> List[LearningPath]:
        """获取用户的学习路线版本列表（按版本号降序），可按学科过滤"""
        stmt = (
            select(UserLearningPath)
            .where(UserLearningPath.user_id == user_id)
            .order_by(UserLearningPath.version.desc())  # 按版本号降序
        )
        if subject_key:
            stmt = stmt.where(UserLearningPath.subject_key == subject_key)
        if not include_archived:
            stmt = stmt.where(UserLearningPath.archived_at.is_(None))

        result = await self.db.execute(stmt)
        records = result.scalars().all()
        paths: List[LearningPath] = []
        for record in records:
            if record.data:
                path = LearningPath(**record.data)
                if not path.generated_days:
                    path.generated_days = len(path.days or [])
                # 附加版本元信息
                path.version = record.version
                path.version_name = record.version_name
                path.is_active = record.is_active
                path.archived_at = record.archived_at.isoformat() if record.archived_at else None
                paths.append(path)
        return paths

    async def delete_user_paths(self, user_id: str, subject_key: Optional[str] = None) -> int:
        """删除用户的学习路线记录（用于重新规划路线），可按学科过滤"""
        stmt = delete(UserLearningPath).where(UserLearningPath.user_id == user_id)
        if subject_key:
            stmt = stmt.where(UserLearningPath.subject_key == subject_key)
        result = await self.db.execute(stmt)
        try:
            await self.db.flush()
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise
        return int(getattr(result, "rowcount", 0) or 0)

    async def get_active_learning_path(
        self,
        user_id: str,
        subject_key: str
    ) -> Optional[LearningPath]:
        """获取用户某学科的当前激活版本"""
        stmt = (
            select(UserLearningPath)
            .where(
                UserLearningPath.user_id == uuid.UUID(user_id),
                UserLearningPath.subject_key == subject_key,
                UserLearningPath.is_active == True,
                UserLearningPath.archived_at.is_(None)
            )
        )
        result = await self.db.execute(stmt)
        record = result.scalar_one_or_none()

        if not record or not record.data:
            return None

        path = LearningPath(**record.data)
        if not path.generated_days:
            path.generated_days = len(path.days or [])
        # 附加版本元信息
        path.version = record.version
        path.version_name = record.version_name
        path.is_active = record.is_active

        return path

    async def activate_version(
        self,
        user_id: str,
        subject_key: str,
        version: int
    ) -> Optional[LearningPath]:
        """切换激活版本"""
        import sqlalchemy as sa

        # 1. 验证目标版本存在且未归档
        target_stmt = (
            select(UserLearningPath)
            .where(
                UserLearningPath.user_id == uuid.UUID(user_id),
                UserLearningPath.subject_key == subject_key,
                UserLearningPath.version == version,
                UserLearningPath.archived_at.is_(None)
            )
        )
        result = await self.db.execute(target_stmt)
        target_record = result.scalar_one_or_none()

        if not target_record:
            raise ValueError(f"版本 {version} 不存在或已归档")

        # 2. 停用所有版本
        await self.db.execute(
            sa.update(UserLearningPath)
            .where(
                UserLearningPath.user_id == uuid.UUID(user_id),
                UserLearningPath.subject_key == subject_key
            )
            .values(is_active=False)
        )

        # 3. 激活目标版本
        await self.db.execute(
            sa.update(UserLearningPath)
            .where(UserLearningPath.id == target_record.id)
            .values(is_active=True, updated_at=utcnow_naive())
        )

        await self.db.commit()

        # 4. 返回激活后的版本
        path = LearningPath(**target_record.data)
        if not path.generated_days:
            path.generated_days = len(path.days or [])
        path.version = target_record.version
        path.version_name = target_record.version_name
        path.is_active = True

        return path

    async def archive_version(
        self,
        user_id: str,
        subject_key: str,
        version: int,
        permanent_delete: bool = False
    ) -> bool:
        """归档或删除指定版本"""
        stmt = (
            select(UserLearningPath)
            .where(
                UserLearningPath.user_id == uuid.UUID(user_id),
                UserLearningPath.subject_key == subject_key,
                UserLearningPath.version == version
            )
        )
        result = await self.db.execute(stmt)
        record = result.scalars().first()

        if not record:
            raise ValueError(f"版本 {version} 不存在")

        is_was_active = record.is_active

        if permanent_delete:
            await self.db.delete(record)
        else:
            record.archived_at = utcnow_naive()
            record.is_active = False

        try:
            await self.db.flush()

            # 如果删除了当前激活版本，尝试激活最新的一个其他版本
            if is_was_active:
                latest_stmt = (
                    select(UserLearningPath)
                    .where(
                        UserLearningPath.user_id == uuid.UUID(user_id),
                        UserLearningPath.subject_key == subject_key,
                        UserLearningPath.archived_at.is_(None)
                    )
                    .order_by(UserLearningPath.version.desc())
                    .limit(1)
                )
                latest_result = await self.db.execute(latest_stmt)
                latest_record = latest_result.scalars().first()
                if latest_record:
                    latest_record.is_active = True
                    latest_record.updated_at = utcnow_naive()

            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise
        return True

    async def rename_version(
        self,
        user_id: str,
        subject_key: str,
        version: int,
        new_name: str
    ) -> bool:
        """重命名版本"""
        import sqlalchemy as sa
        # 1. 查找现有记录
        result = await self.db.execute(
            select(UserLearningPath).where(
                UserLearningPath.user_id == uuid.UUID(user_id),
                UserLearningPath.subject_key == subject_key,
                UserLearningPath.version == version
            )
        )
        record = result.scalar_one_or_none()
        if not record:
            return False

        # 2. 更新列和 JSON blob 中的 version_name
        record.version_name = new_name
        if record.data:
            data = dict(record.data)
            data["version_name"] = new_name
            record.data = data
        
        record.updated_at = utcnow_naive()

        try:
            await self.db.flush()
            await self.db.commit()
            return True
        except Exception:
            await self.db.rollback()
            raise

    async def update_path_progress(
        self,
        path_id: str,
        day: int,
        task_id: str,
        completed: bool,
    ) -> Optional[LearningPath]:
        """更新学习进度并持久化（不存在返回None）"""
        path = await self.get_learning_path(path_id)
        if path is None:
            return None

        # 更新指定任务完成状态
        for day_item in path.days:
            if day_item.day != day:
                continue
            for task in day_item.tasks:
                if task.id == task_id:
                    task.completed = completed
                    break
            break

        # 重新计算进度
        self._recompute_progress(path)
        # 兼容历史数据：保持 generated_days 与 days 数一致
        path.generated_days = max(int(path.generated_days or 0), len(path.days or []))

        await self.upsert_learning_path(path)

        # 如果标记为完成，记录行为到用户记忆
        if completed:
            try:
                # 获取 subject_key
                subject_key = await self.get_learning_path_subject_key(path_id)
                await UserMemoryService.record_behavior(
                    self.db,
                    uuid.UUID(path.user_id),
                    behavior_type="learning_task_complete",
                    context=task_id,
                    event_metadata={
                        "path_id": path_id,
                        "day": day,
                        "subject_key": subject_key,
                        "progress_percent": path.progress_percent
                    }
                )
            except Exception as e:
                logger.warning(f"[AI Path] 记录学习行为到记忆系统失败: {e}")

        return path

