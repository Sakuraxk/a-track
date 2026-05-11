"""
AI学习路线API
"""
import json
import logging
import re
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..schemas.ai_learning_path_workbench import (
    ClarificationReplyRequest,
    ClarificationSessionStartRequest,
    ClarificationSessionResponse,
    ExpandSkillNodeRequest,
    ExpandSkillNodeResponse,
    GenerationContextResponse,
    PreferenceSnapshotRequest,
    PreferenceSnapshotResponse,
    ReadyCheckResponse,
    SessionGenerateResponse,
)
from ..services.ai_learning_path_service import (
    AILearningPathService,
    LearningPath,
    LearningDay,
    LearningTask
)
from ..services.llm_service import LLMServiceError

router = APIRouter()
logger = logging.getLogger(__name__)

# 脱敏：移除 base_url、原始响应片段等内部信息，仅保留用户可理解的错误描述
_SENSITIVE_PATTERNS = re.compile(
    r"(base_url=[^\s；;]+|原始内容repr前\d+=[^\s；;]+|api_key[^\s；;]*)", re.IGNORECASE
)


def _sanitize_reason(reason: str | None) -> str | None:
    if not reason:
        return reason
    return _SENSITIVE_PATTERNS.sub("", reason).strip().rstrip("；;")


class GeneratePathRequest(BaseModel):
    """生成学习路线请求"""
    goal: str = "掌握编程基础"
    subject_key: str = "python"  # python, machine_learning, advanced_math
    total_days: int = 14
    daily_minutes: int = 60
    level: str = "初级"
    ability_tags: Optional[dict] = None
    version_name: Optional[str] = None  # 可选版本名称


class GeneratePathResponse(BaseModel):
    """生成学习路线响应"""
    success: bool
    message: str
    # 当 source != "ai" 时，用于透传失败原因（便于前端展示/排查）
    reason: Optional[str] = None
    # AI 可公开展示的规划思考摘要（非逐步推理）
    thinking_summary: Optional[str] = None
    path: Optional[LearningPath] = None
    source: str = "unknown"  # "ai" | "error"


# ── 版本管理请求模型 ──────────────────────────────────

class ActivateVersionRequest(BaseModel):
    subject_key: str
    version: int

class ArchiveVersionRequest(BaseModel):
    subject_key: str
    version: int
    permanent: bool = False  # 是否物理删除

class RenameVersionRequest(BaseModel):
    subject_key: str
    version: int
    new_name: str


@router.post(
    "/session/start",
    response_model=ClarificationSessionResponse,
    summary="创建学习路线澄清会话",
)
async def start_clarification_session(
    user_id: UUID,
    request: ClarificationSessionStartRequest,
    db: AsyncSession = Depends(get_db),
) -> ClarificationSessionResponse:
    """创建新的学习路线澄清会话，并返回首轮 AI 提问。"""
    service = AILearningPathService(db)
    return ClarificationSessionResponse.model_validate(
        await service.start_clarification_session(str(user_id), request.subject_key)
    )


@router.get(
    "/session/{session_id}",
    response_model=ClarificationSessionResponse,
    summary="获取学习路线澄清会话详情",
)
async def get_clarification_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ClarificationSessionResponse:
    """获取澄清会话详情及消息历史。"""
    service = AILearningPathService(db)
    payload = await service.get_clarification_session(str(session_id))
    if payload is None:
        raise HTTPException(status_code=404, detail="澄清会话不存在")
    return ClarificationSessionResponse.model_validate(payload)


@router.post(
    "/session/{session_id}/reply",
    response_model=ClarificationSessionResponse,
    summary="回复学习路线澄清会话",
)
async def reply_clarification_session(
    session_id: UUID,
    request: ClarificationReplyRequest,
    db: AsyncSession = Depends(get_db),
) -> ClarificationSessionResponse:
    """提交用户回复并返回下一轮 AI 提问。"""
    service = AILearningPathService(db)
    try:
        payload = await service.reply_clarification_session(str(session_id), request.content)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ClarificationSessionResponse.model_validate(payload)


@router.post(
    "/session/{session_id}/expand-node",
    response_model=ExpandSkillNodeResponse,
    summary="为想学习节点继续发散学习路径子节点",
)
async def expand_learning_path_node(
    session_id: UUID,
    request: ExpandSkillNodeRequest,
    db: AsyncSession = Depends(get_db),
) -> ExpandSkillNodeResponse:
    """基于当前会话上下文，为目标学习节点扩展一批用户级子节点。"""
    service = AILearningPathService(db)
    try:
        payload = await service.expand_skill_node_for_session(str(session_id), request.node_id, request.mode)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LLMServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception(
            "[AI Path Router] expand-node unexpected failure: session_id=%s node_id=%s mode=%s",
            session_id,
            request.node_id,
            request.mode,
        )
        raise HTTPException(
            status_code=500,
            detail=f"学习星图继续发散失败：{type(exc).__name__}: {exc}",
        ) from exc

    return ExpandSkillNodeResponse.model_validate(payload)


@router.post(
    "/session/start/stream",
    summary="流式创建学习路线澄清会话",
)
async def start_clarification_session_stream(
    user_id: UUID,
    request: ClarificationSessionStartRequest,
    db: AsyncSession = Depends(get_db),
):
    """通过 SSE 流式返回首轮 AI 澄清问题。"""

    async def event_stream():
        service = AILearningPathService(db)
        try:
            async for event in service.stream_start_clarification_session(str(user_id), request.subject_key):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except ValueError as exc:
            yield f"data: {json.dumps({'type': 'error', 'content': str(exc)}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'content': f'流式澄清失败: {exc}'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/session/{session_id}/reply/stream",
    summary="流式回复学习路线澄清会话",
)
async def reply_clarification_session_stream(
    session_id: UUID,
    request: ClarificationReplyRequest,
    db: AsyncSession = Depends(get_db),
):
    """通过 SSE 流式返回下一轮 AI 澄清问题。"""

    async def event_stream():
        service = AILearningPathService(db)
        try:
            async for event in service.stream_reply_clarification_session(str(session_id), request.content):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except ValueError as exc:
            yield f"data: {json.dumps({'type': 'error', 'content': str(exc)}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'content': f'流式澄清失败: {exc}'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.put(
    "/session/{session_id}/preference-snapshot",
    response_model=PreferenceSnapshotResponse,
    summary="保存学习路线三态偏好快照",
)
async def save_preference_snapshot(
    session_id: UUID,
    request: PreferenceSnapshotRequest,
    db: AsyncSession = Depends(get_db),
) -> PreferenceSnapshotResponse:
    """保存工作台左侧技术树的三态偏好快照。"""
    service = AILearningPathService(db)

    try:
        payload = await service.save_preference_snapshot(
            str(session_id),
            request.known_node_ids,
            request.target_node_ids,
            request.avoid_node_ids,
            request.free_text_notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return PreferenceSnapshotResponse.model_validate(payload)


@router.get(
    "/session/{session_id}/ready-check",
    response_model=ReadyCheckResponse,
    summary="检查当前会话是否可生成学习路线",
)
async def get_ready_check(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ReadyCheckResponse:
    """返回当前会话的生成就绪状态。"""
    service = AILearningPathService(db)
    try:
        payload = await service.get_ready_check(str(session_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ReadyCheckResponse.model_validate(payload)


@router.post(
    "/session/{session_id}/generate",
    response_model=SessionGenerateResponse,
    summary="基于会话上下文生成新的学习路线版本",
)
async def generate_learning_path_from_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> SessionGenerateResponse:
    """基于澄清会话和偏好快照创建新的学习路线版本。"""
    service = AILearningPathService(db)
    try:
        payload = await service.generate_learning_path_from_session(str(session_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return SessionGenerateResponse.model_validate(
        {
            "session_id": payload["session_id"],
            "ready_check": payload["ready_check"],
            "context": GenerationContextResponse.model_validate(payload["context"]),
            "path": payload["path"],
        }
    )


@router.post("/generate", response_model=GeneratePathResponse, summary="生成AI学习路线")
async def generate_learning_path(
    user_id: UUID,
    request: GeneratePathRequest,
    db: AsyncSession = Depends(get_db)
) -> GeneratePathResponse:
    """
    使用AI生成个性化的学习路线

    - 根据用户水平和目标生成学习计划
    - 每天包含2-4个学习任务
    - 包含里程碑和进度追踪

    需要用户配置 LLM 或系统启用默认 LLM。
    若无可用 LLM，返回 success=False 并附带失败原因。

    返回的 source 字段说明：
    - "ai": AI 个性化生成
    - "error": 生成失败（无 LLM 配置或 LLM 调用异常）
    """
    service = AILearningPathService(db)

    path = await service.generate_learning_path(
        user_id=str(user_id),
        goal=request.goal,
        subject_key=request.subject_key,
        total_days=request.total_days,
        daily_minutes=request.daily_minutes,
        level=request.level,
        ability_tags=request.ability_tags,
        version_name=request.version_name
    )

    if path:
        return GeneratePathResponse(
            success=True,
            message="AI 已为您生成个性化学习路线",
            reason=_sanitize_reason(service.last_generation_reason),
            thinking_summary=service.last_generation_thinking_summary,
            path=path,
            source=path.source
        )
    else:
        return GeneratePathResponse(
            success=False,
            message="学习路线生成失败，请检查 LLM 配置后重试",
            reason=_sanitize_reason(service.last_generation_reason),
            path=None,
            source="error"
        )


@router.post("/save", summary="保存学习路线")
async def save_learning_path(
    path: LearningPath,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """保存生成的学习路线"""
    service = AILearningPathService(db)
    await service.upsert_learning_path(path)
    return {"success": True, "message": "学习路线已保存", "path_id": path.id}


@router.get("/{path_id}", response_model=LearningPath, summary="获取学习路线")
async def get_learning_path(
    path_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> LearningPath:
    """获取指定ID的学习路线"""
    service = AILearningPathService(db)
    path = await service.get_learning_path(str(path_id))
    if path is None:
        raise HTTPException(status_code=404, detail="学习路线不存在")
    return path


@router.get("/user/{user_id}", summary="获取用户的学习路线列表")
async def get_user_paths(
    user_id: UUID,
    subject_key: Optional[str] = Query(None, description="按学科筛选"),
    db: AsyncSession = Depends(get_db)
) -> list:
    """获取用户的所有学习路线，可按学科过滤"""
    service = AILearningPathService(db)
    return await service.list_user_paths(str(user_id), subject_key=subject_key)


# ── 版本管理端点 ──────────────────────────────────

@router.get("/user/{user_id}/versions", summary="获取用户的学习路线版本列表")
async def get_user_versions(
    user_id: UUID,
    subject_key: str = Query(..., description="学科标识"),
    include_archived: bool = Query(False, description="是否包含已归档版本"),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """获取用户某学科的所有版本（按版本号降序），返回简化版本列表"""
    service = AILearningPathService(db)
    paths = await service.list_user_paths(
        str(user_id),
        subject_key=subject_key,
        include_archived=include_archived
    )

    versions = [
        {
            "id": p.id,
            "version": p.version,
            "version_name": p.version_name,
            "is_active": p.is_active,
            "goal": p.goal,
            "total_days": p.total_days,
            "daily_minutes": p.daily_minutes,
            "progress_percent": p.progress_percent,
            "current_day": p.current_day,
            "generated_days": p.generated_days,
            "created_at": p.created_at,
            "archived_at": getattr(p, 'archived_at', None)
        }
        for p in paths
    ]

    return {
        "success": True,
        "versions": versions,
        "active_version": next((v for v in versions if v.get("is_active")), None)
    }


@router.get("/user/{user_id}/active", response_model=LearningPath, summary="获取用户当前激活的学习路线")
async def get_active_path(
    user_id: UUID,
    subject_key: str = Query(..., description="学科标识"),
    db: AsyncSession = Depends(get_db)
) -> LearningPath:
    """获取用户某学科当前激活的学习路线（含完整数据）"""
    service = AILearningPathService(db)
    path = await service.get_active_learning_path(str(user_id), subject_key)

    if path is None:
        raise HTTPException(status_code=404, detail="未找到激活的学习路线")

    return path


@router.post("/user/{user_id}/activate", summary="切换激活版本")
async def activate_version(
    user_id: UUID,
    request: ActivateVersionRequest,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """切换用户某学科的激活版本"""
    service = AILearningPathService(db)

    try:
        path = await service.activate_version(
            str(user_id),
            request.subject_key,
            request.version
        )

        return {
            "success": True,
            "message": f"已切换到版本 {request.version}",
            "path": path
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/user/{user_id}/version", summary="归档/删除指定版本")
async def archive_version(
    user_id: UUID,
    request: ArchiveVersionRequest,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """归档或删除指定版本（不能操作激活版本）"""
    service = AILearningPathService(db)

    try:
        await service.archive_version(
            str(user_id),
            request.subject_key,
            request.version,
            permanent_delete=request.permanent
        )

        action = "删除" if request.permanent else "归档"
        return {
            "success": True,
            "message": f"已{action}版本 {request.version}"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/user/{user_id}/version/rename", summary="重命名版本")
async def rename_version(
    user_id: UUID,
    request: RenameVersionRequest,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """重命名指定版本"""
    service = AILearningPathService(db)

    success = await service.rename_version(
        str(user_id),
        request.subject_key,
        request.version,
        request.new_name
    )

    if not success:
        raise HTTPException(status_code=404, detail="版本不存在")

    return {
        "success": True,
        "message": "版本名称已更新"
    }


@router.delete("/user/{user_id}", summary="删除用户的学习路线（重新规划用）")
async def delete_user_paths(
    user_id: UUID,
    subject_key: Optional[str] = Query(None, description="按学科删除，不传则删除全部"),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """删除用户的学习路线记录（用于重新规划路线），可按学科过滤"""
    service = AILearningPathService(db)
    deleted_count = await service.delete_user_paths(str(user_id), subject_key=subject_key)
    return {"success": True, "deleted_count": deleted_count}


class UpdateProgressRequest(BaseModel):
    """更新进度请求"""
    day: int
    task_id: str
    completed: bool


class ExtendPathRequest(BaseModel):
    """续写学习路线请求（分阶段解锁）"""
    chunk_days: int = 7


@router.put("/{path_id}/progress", summary="更新学习进度")
async def update_progress(
    path_id: UUID,
    request: UpdateProgressRequest,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """更新学习任务的完成状态"""
    service = AILearningPathService(db)
    path = await service.update_path_progress(
        path_id=str(path_id),
        day=request.day,
        task_id=request.task_id,
        completed=request.completed,
    )
    if path is None:
        raise HTTPException(status_code=404, detail="学习路线不存在")

    return {
        "success": True,
        "progress_percent": path.progress_percent,
        "current_day": path.current_day,
    }


@router.post("/{path_id}/extend", response_model=GeneratePathResponse, summary="续写学习路线（学完解锁后）")
async def extend_learning_path(
    path_id: UUID,
    request: ExtendPathRequest,
    db: AsyncSession = Depends(get_db)
) -> GeneratePathResponse:
    """
    分阶段生成学习路线：当用户完成当前已生成阶段后，调用此接口生成后续若干天。

    - 成功：返回更新后的 path（在末尾追加新 days）
    - 失败：success=false，并透传 reason（便于前端展示/排查）
    """
    service = AILearningPathService(db)
    existing_path = await service.get_learning_path(str(path_id))
    if existing_path is None:
        raise HTTPException(status_code=404, detail="学习路线不存在")

    try:
        path = await service.extend_learning_path(
            path_id=str(path_id),
            chunk_days=request.chunk_days,
        )
        if path is None:
            raise HTTPException(status_code=404, detail="学习路线不存在")

        return GeneratePathResponse(
            success=True,
            message="已生成后续学习内容",
            reason=_sanitize_reason(service.last_generation_reason),
            thinking_summary=service.last_generation_thinking_summary,
            path=path,
            source=path.source
        )
    except ValueError as e:
        # 解锁条件不满足：返回现有路线并告知原因
        return GeneratePathResponse(
            success=False,
            message=str(e),
            reason=str(e),
            thinking_summary=None,
            path=existing_path,
            source=existing_path.source
        )
    except Exception as e:
        reason = service.last_generation_reason or f"{type(e).__name__}: {e}"
        return GeneratePathResponse(
            success=False,
            message="续写失败，请稍后重试",
            reason=reason,
            thinking_summary=service.last_generation_thinking_summary,
            path=existing_path,
            source=existing_path.source
        )

