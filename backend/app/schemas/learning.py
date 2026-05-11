from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field
from uuid import UUID


class KnowledgeNode(BaseModel):
    code: str
    title: str
    difficulty: int = Field(ge=1, le=5)
    duration_minutes: int
    prerequisites: List[str] = Field(default_factory=list)
    attributes: Dict[str, str] = Field(default_factory=dict)


class UserNodeState(BaseModel):
    node_code: str
    status: str
    mastery: int = Field(ge=0, le=100)
    latest_errors: List[str] = Field(default_factory=list)


class LearningPathItem(BaseModel):
    node: KnowledgeNode
    status: UserNodeState


class TaskItem(BaseModel):
    id: UUID
    title: str
    task_type: str
    payload: Dict[str, object] = Field(default_factory=dict)
    due_date: Optional[datetime] = None
    status: str


class TaskCreate(BaseModel):
    title: str
    task_type: str
    payload: Dict[str, object] = Field(default_factory=dict)
    due_date: Optional[datetime] = None
