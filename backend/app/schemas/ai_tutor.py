from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TutorRequest(BaseModel):
    prompt: str
    role: str = Field(default="explainer", description="explainer|code_reviewer")
    model: Optional[str] = Field(default=None, description="explainer|coder")
    context_nodes: List[str] = Field(default_factory=list)
    recent_errors: List[str] = Field(default_factory=list)


class TutorResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    message: str
    model_used: str
    guidance_only: bool = True
    tips: List[str] = Field(default_factory=list)
    references: List[str] = Field(default_factory=list)
