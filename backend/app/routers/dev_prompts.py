"""
Dev-only prompt management API.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..prompts.admin_service import PromptAdminService
from ..prompts.registry import PromptRenderError

router = APIRouter(prefix="/api/dev/prompts", tags=["dev-prompts"])


def get_prompt_admin_service() -> PromptAdminService:
    return PromptAdminService()


def is_prompt_lab_enabled() -> bool:
    import os

    try:
        from ..core.config import settings

        environment = settings.environment
    except Exception:
        environment = os.environ.get("APP_ENV", "local")

    if environment not in {"local", "development", "dev"}:
        raise HTTPException(status_code=403, detail="Prompt Lab 仅在开发环境可用")
    return True


class PromptRenderRequest(BaseModel):
    variables: Dict[str, Any] = {}
    system_template: Optional[str] = None
    user_template: Optional[str] = None


class PromptRunRequest(PromptRenderRequest):
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


class PromptSaveRequest(BaseModel):
    description: str
    system_template: Optional[str] = None
    user_template: str
    temperature: float
    max_tokens: int
    output_format: str
    note: str = ""


class PromptDiffRequest(BaseModel):
    left_version_id: str
    right_version_id: str


class PromptAnalyzeRequest(BaseModel):
    system_template: Optional[str] = None
    user_template: Optional[str] = None


class PromptOptimizeRequest(PromptAnalyzeRequest):
    focus: str = ""
    variables: Dict[str, Any] = {}


class PromptApplyIssueRequest(PromptAnalyzeRequest):
    issue_id: str


@router.get("")
def list_prompts(
    _: bool = Depends(is_prompt_lab_enabled),
    service: PromptAdminService = Depends(get_prompt_admin_service),
):
    return {"prompts": service.list_prompts()}


@router.post("/{prompt_name:path}/render")
def render_prompt(
    prompt_name: str,
    payload: PromptRenderRequest,
    _: bool = Depends(is_prompt_lab_enabled),
    service: PromptAdminService = Depends(get_prompt_admin_service),
):
    try:
        return service.render_prompt(
            prompt_name,
            variables=payload.variables,
            system_template=payload.system_template,
            user_template=payload.user_template,
        )
    except (PromptRenderError, KeyError) as exc:
        message = service.build_validation_error_message(
            prompt_name,
            payload.variables,
            payload.system_template,
            payload.user_template,
        )
        raise HTTPException(status_code=400, detail=f"{message}；{exc}") from exc


@router.post("/{prompt_name:path}/run")
async def run_prompt(
    prompt_name: str,
    payload: PromptRunRequest,
    _: bool = Depends(is_prompt_lab_enabled),
    service: PromptAdminService = Depends(get_prompt_admin_service),
):
    try:
        return await service.run_prompt(
            prompt_name,
            variables=payload.variables,
            system_template=payload.system_template,
            user_template=payload.user_template,
            temperature=payload.temperature,
            max_tokens=payload.max_tokens,
        )
    except (PromptRenderError, ValueError, KeyError) as exc:
        if isinstance(exc, PromptRenderError):
            message = service.build_validation_error_message(
                prompt_name,
                payload.variables,
                payload.system_template,
                payload.user_template,
            )
            raise HTTPException(status_code=400, detail=f"{message}；{exc}") from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{prompt_name:path}")
def save_prompt(
    prompt_name: str,
    payload: PromptSaveRequest,
    _: bool = Depends(is_prompt_lab_enabled),
    service: PromptAdminService = Depends(get_prompt_admin_service),
):
    return service.save_prompt(
        prompt_name=prompt_name,
        description=payload.description,
        system_template=payload.system_template,
        user_template=payload.user_template,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        output_format=payload.output_format,
        note=payload.note,
    )


@router.get("/{prompt_name:path}/versions/{version_id}")
def get_prompt_version(
    prompt_name: str,
    version_id: str,
    _: bool = Depends(is_prompt_lab_enabled),
    service: PromptAdminService = Depends(get_prompt_admin_service),
):
    return {"version": service.get_version(prompt_name, version_id)}


@router.post("/{prompt_name:path}/diff")
def diff_versions(
    prompt_name: str,
    payload: PromptDiffRequest,
    _: bool = Depends(is_prompt_lab_enabled),
    service: PromptAdminService = Depends(get_prompt_admin_service),
):
    return service.diff_versions(prompt_name, payload.left_version_id, payload.right_version_id)


@router.post("/{prompt_name:path}/analyze")
def analyze_prompt(
    prompt_name: str,
    payload: PromptAnalyzeRequest,
    _: bool = Depends(is_prompt_lab_enabled),
    service: PromptAdminService = Depends(get_prompt_admin_service),
):
    return service.analyze_prompt(
        prompt_name,
        system_template=payload.system_template,
        user_template=payload.user_template,
    )


@router.post("/{prompt_name:path}/optimize")
def optimize_prompt(
    prompt_name: str,
    payload: PromptOptimizeRequest,
    _: bool = Depends(is_prompt_lab_enabled),
    service: PromptAdminService = Depends(get_prompt_admin_service),
):
    return service.optimize_prompt(
        prompt_name,
        focus=payload.focus,
        variables=payload.variables,
        system_template=payload.system_template,
        user_template=payload.user_template,
    )


@router.post("/{prompt_name:path}/issues/apply")
def apply_issue(
    prompt_name: str,
    payload: PromptApplyIssueRequest,
    _: bool = Depends(is_prompt_lab_enabled),
    service: PromptAdminService = Depends(get_prompt_admin_service),
):
    try:
        return service.apply_issue(
            prompt_name,
            issue_id=payload.issue_id,
            system_template=payload.system_template,
            user_template=payload.user_template,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{prompt_name:path}/restore/{version_id}")
def restore_version(
    prompt_name: str,
    version_id: str,
    _: bool = Depends(is_prompt_lab_enabled),
    service: PromptAdminService = Depends(get_prompt_admin_service),
):
    return service.restore_version(prompt_name, version_id)


@router.get("/{prompt_name:path}")
def get_prompt_detail(
    prompt_name: str,
    _: bool = Depends(is_prompt_lab_enabled),
    service: PromptAdminService = Depends(get_prompt_admin_service),
):
    return {"prompt": service.get_prompt(prompt_name)}
