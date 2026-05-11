from typing import List, Optional
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field


class PostAuthor(BaseModel):
    id: UUID
    nickname: str
    avatar: str
    role: str


class PostComment(BaseModel):
    id: UUID
    post_id: UUID
    author: PostAuthor
    content: str
    created_at: datetime
    likes: int = 0
    is_liked: bool = False
    parent_id: Optional[UUID] = None
    replies: List["PostComment"] = Field(default_factory=list)

PostComment.model_rebuild()

class CommunityPost(BaseModel):
    id: UUID
    author: PostAuthor
    title: str
    content: str
    tags: List[str] = Field(default_factory=list)
    likes: int = 0
    comments_count: int = 0
    is_liked: bool = False
    created_at: datetime


class PostListResponse(BaseModel):
    posts: List[CommunityPost]
    total: int
    page: int
    page_size: int


class CreatePostRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    content: str = Field(..., min_length=10)
    tags: List[str] = Field(default_factory=list)


class CreateCommentRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)
    parent_id: Optional[UUID] = None


class LikeResponse(BaseModel):
    post_id: UUID
    likes: int
    is_liked: bool


class CommentListResponse(BaseModel):
    comments: List[PostComment]
    total: int


class UpdatePostRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=5, max_length=200)
    content: Optional[str] = Field(None, min_length=10)
    tags: Optional[List[str]] = None


class DeletePostResponse(BaseModel):
    success: bool
    message: str
