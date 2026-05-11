"""
学习路线工作台技术树 API。
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..schemas.ai_learning_path_workbench import (
    SubjectSkillMapResponse,
    SnapshotListResponse,
    SnapshotSummary,
    CreateSnapshotRequest,
    ActivateSnapshotRequest,
    RenameSnapshotRequest,
    ResetSnapshotRequest,
)
from ..services.ai_learning_path_service import AILearningPathService

router = APIRouter()


@router.get(
    "/{subject_key}",
    response_model=SubjectSkillMapResponse,
    summary="获取当前学科 active 技术树",
)
async def get_learning_path_map(
    subject_key: str,
    user_id: UUID | None = Query(default=None, description="可选用户ID，用于合并用户扩展节点"),
    db: AsyncSession = Depends(get_db),
) -> SubjectSkillMapResponse:
    """返回当前学科的 active 技术树。"""
    service = AILearningPathService(db)
    payload = await service.get_active_subject_skill_map(subject_key, str(user_id) if user_id else None)

    if payload is None:
        raise HTTPException(status_code=404, detail="未找到学科技术树")

    return SubjectSkillMapResponse.model_validate(payload)


# ── 星图快照管理 ──────────────────────────────────────────

@router.get(
    "/{subject_key}/snapshots",
    response_model=SnapshotListResponse,
    summary="列出用户星图快照",
)
async def list_snapshots(
    subject_key: str,
    user_id: UUID = Query(..., description="用户ID"),
    db: AsyncSession = Depends(get_db),
) -> SnapshotListResponse:
    """列出用户在某学科下的所有星图快照。"""
    service = AILearningPathService(db)
    items = await service.list_skill_tree_snapshots(str(user_id), subject_key)
    return SnapshotListResponse(
        snapshots=[SnapshotSummary.model_validate(item) for item in items]
    )


@router.post(
    "/{subject_key}/snapshots",
    response_model=SnapshotSummary,
    summary="创建星图快照",
)
async def create_snapshot(
    subject_key: str,
    body: CreateSnapshotRequest,
    db: AsyncSession = Depends(get_db),
) -> SnapshotSummary:
    """创建新的星图快照。source='system' 从默认树新建，'current' 复制当前方案。"""
    service = AILearningPathService(db)
    try:
        result = await service.create_skill_tree_snapshot(
            user_id=body.user_id,
            subject_key=subject_key,
            name=body.name,
            source=body.source,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return SnapshotSummary.model_validate(result)


@router.put(
    "/{subject_key}/snapshots/{snapshot_id}/activate",
    summary="切换 active 快照",
)
async def activate_snapshot(
    subject_key: str,
    snapshot_id: UUID,
    body: ActivateSnapshotRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """切换当前使用的星图方案。"""
    service = AILearningPathService(db)
    try:
        await service.activate_skill_tree_snapshot(
            user_id=body.user_id,
            subject_key=subject_key,
            snapshot_id=str(snapshot_id),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.put(
    "/{subject_key}/snapshots/{snapshot_id}/rename",
    summary="重命名快照",
)
async def rename_snapshot(
    subject_key: str,
    snapshot_id: UUID,
    body: RenameSnapshotRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """重命名星图快照。"""
    service = AILearningPathService(db)
    try:
        await service.rename_skill_tree_snapshot(
            user_id=body.user_id,
            snapshot_id=str(snapshot_id),
            name=body.name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.delete(
    "/{subject_key}/snapshots/{snapshot_id}",
    summary="删除快照",
)
async def delete_snapshot(
    subject_key: str,
    snapshot_id: UUID,
    user_id: UUID = Query(..., description="用户ID"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """删除星图快照。不允许删除唯一的快照。"""
    service = AILearningPathService(db)
    try:
        await service.delete_skill_tree_snapshot(
            user_id=str(user_id),
            subject_key=subject_key,
            snapshot_id=str(snapshot_id),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.post(
    "/{subject_key}/snapshots/{snapshot_id}/reset",
    response_model=SubjectSkillMapResponse,
    summary="重置快照为默认树",
)
async def reset_snapshot(
    subject_key: str,
    snapshot_id: UUID,
    body: ResetSnapshotRequest,
    db: AsyncSession = Depends(get_db),
) -> SubjectSkillMapResponse:
    """将指定快照重置为系统默认树，清除所有发散节点。"""
    service = AILearningPathService(db)
    try:
        result = await service.reset_skill_tree_snapshot(
            user_id=body.user_id,
            snapshot_id=str(snapshot_id),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return SubjectSkillMapResponse.model_validate(result)
