from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class SkillTreeNode(BaseModel):
    id: str
    label: str
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    children: list["SkillTreeNode"] = Field(default_factory=list)


SkillTreeNode.model_rebuild()


class SubjectSkillMapResponse(BaseModel):
    subject_key: str
    version: int
    is_active: bool
    tree: SkillTreeNode
    snapshot_id: Optional[str] = None
    snapshot_name: Optional[str] = None


class ExpandSkillNodeRequest(BaseModel):
    node_id: str
    mode: str = "curriculum"


class ExpandSkillNodeResponse(SubjectSkillMapResponse):
    expanded_parent_id: str
    new_node_ids: list[str] = Field(default_factory=list)


class ClarificationSessionStartRequest(BaseModel):
    subject_key: str


class ClarificationMessageResponse(BaseModel):
    role: str
    message_type: str
    content: str
    structured_payload: Optional[dict[str, Any]] = None


class ClarificationSessionResponse(BaseModel):
    session_id: str
    user_id: str
    subject_key: str
    status: str
    current_turn_index: int
    messages: list[ClarificationMessageResponse] = Field(default_factory=list)


class PreferenceSnapshotRequest(BaseModel):
    known_node_ids: list[str] = Field(default_factory=list)
    target_node_ids: list[str] = Field(default_factory=list)
    avoid_node_ids: list[str] = Field(default_factory=list)
    free_text_notes: Optional[str] = None


class PreferenceSnapshotResponse(BaseModel):
    session_id: str
    known_node_ids: list[str] = Field(default_factory=list)
    target_node_ids: list[str] = Field(default_factory=list)
    avoid_node_ids: list[str] = Field(default_factory=list)
    free_text_notes: Optional[str] = None


class ClarificationReplyRequest(BaseModel):
    content: str


class ReadyCheckResponse(BaseModel):
    session_id: str
    ready: bool
    missing_items: list[str] = Field(default_factory=list)
    summary: str = ""


class GenerationContextResponse(BaseModel):
    session_id: str
    goal_summary: str
    constraints_json: dict[str, Any] = Field(default_factory=dict)
    prompt_inputs_json: dict[str, Any] = Field(default_factory=dict)


class SessionGenerateResponse(BaseModel):
    session_id: str
    ready_check: ReadyCheckResponse
    context: GenerationContextResponse
    path: dict[str, Any]


# ── 星图快照 Schemas ──────────────────────────────────

class SnapshotSummary(BaseModel):
    id: str
    name: str
    is_active: bool
    base_version: int
    node_count: int = 0
    expansion_count: int = 0
    created_at: str
    updated_at: str


class SnapshotListResponse(BaseModel):
    snapshots: list[SnapshotSummary] = Field(default_factory=list)


class CreateSnapshotRequest(BaseModel):
    user_id: str
    name: str = "我的探索"
    source: str = "system"  # "system" | "current"


class ActivateSnapshotRequest(BaseModel):
    user_id: str


class RenameSnapshotRequest(BaseModel):
    user_id: str
    name: str


class ResetSnapshotRequest(BaseModel):
    user_id: str
