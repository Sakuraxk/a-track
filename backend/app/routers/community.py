"""Community router – database-backed implementation.

All data is persisted in PostgreSQL tables:
  - community_posts
  - community_comments
  - community_post_likes
"""

from uuid import UUID, uuid4
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, update, and_, case, literal

from ..core.db import get_db, get_write_db
from ..models.community import (
    CommunityPost as PostModel, 
    CommunityComment as CommentModel, 
    CommunityPostLike as LikeModel,
    CommunityCommentLike as CommentLikeModel
)
from ..models.community_notification import CommunityNotification as NotifModel
from ..models.user import UserProfile
from ..schemas.community import (
    CommunityPost,
    PostAuthor,
    PostComment,
    PostListResponse,
    CreatePostRequest,
    CreateCommentRequest,
    LikeResponse,
    CommentListResponse,
    UpdatePostRequest,
    DeletePostResponse,
)


router = APIRouter()


# ────────────────────── GET /tags/stats ──────────────────────

@router.get("/tags/stats")
async def get_tag_stats(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated tag usage statistics across all community posts."""
    from sqlalchemy import text as sa_text
    try:
        raw = await db.execute(sa_text(
            "SELECT t.tag, COUNT(*) as count "
            "FROM community_posts p, jsonb_array_elements_text(p.tags) AS t(tag) "
            "WHERE p.tags IS NOT NULL AND jsonb_array_length(p.tags) > 0 "
            "GROUP BY t.tag "
            "ORDER BY count DESC "
            f"LIMIT {int(limit)}"
        ))
        rows = raw.all()
    except Exception:
        # Table may not exist, or no posts with tags yet
        return {"tags": []}

    # Assign colors for visual display
    TAG_COLORS = [
        "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-blue-500",
        "bg-pink-500", "bg-cyan-500", "bg-amber-500", "bg-indigo-500",
        "bg-red-500", "bg-teal-500",
    ]

    tags = []
    for i, row in enumerate(rows):
        count = row[1]
        # Format count for display (e.g., 1200 -> "1.2k")
        if count >= 1000:
            display = f"{count / 1000:.1f}k"
        else:
            display = str(count)
        tags.append({
            "tag": row[0],
            "count": count,
            "display": f"{display} 帖子",
            "color": TAG_COLORS[i % len(TAG_COLORS)],
        })

    return {"tags": tags}


# ────────────────────── helpers ──────────────────────

async def _get_author_info(db: AsyncSession, author_id: UUID) -> PostAuthor:
    """Resolve author_id to PostAuthor from real user profiles."""
    # Look up real user profile
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == author_id)
        )
        profile = result.scalar_one_or_none()
        if profile and profile.portrait:
            nickname = profile.portrait.get("nickname", "用户") or "用户"
            avatar_url = profile.portrait.get("avatar_url")
            avatar = avatar_url if avatar_url else (nickname[0] if nickname else "U")
            return PostAuthor(id=author_id, nickname=nickname, avatar=avatar, role="学习者")
    except Exception:
        pass

    # Fallback
    return PostAuthor(id=author_id, nickname="用户", avatar="U", role="学习者")


# ────────────────────── GET /posts ──────────────────────

@router.get("/posts", response_model=PostListResponse)
async def get_posts(
    user_id: Optional[str] = Query(None),
    author_id: Optional[str] = Query(None, description="Filter posts by author user ID"),
    filter: Optional[str] = Query(None, description="Filter: all|latest|hot|tutorial|showcase"),
    tag: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> PostListResponse:
    """Get community posts with optional filtering."""
    print(f"[DEBUG] GET /posts called with author_id={author_id!r}, user_id={user_id!r}, filter={filter!r}", flush=True)

    query = select(PostModel)

    # Filter by author
    if author_id:
        try:
            author_uuid = UUID(author_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid author_id format")
        query = query.where(PostModel.author_id == author_uuid)
        print(f"[DEBUG] Applied author_id filter: {author_uuid}", flush=True)
        print(f"[DEBUG] Query after filter: {query}", flush=True)

    # Filter by tag (JSON contains)
    if tag:
        # PostgreSQL JSON array containment: tags @> '["tag"]'
        query = query.where(PostModel.tags.op("@>")(f'["{tag}"]'))

    # Filter by tag-based categories
    if filter == "tutorial":
        query = query.where(PostModel.tags.op("@>")('["教程"]'))
    elif filter == "showcase":
        query = query.where(PostModel.tags.op("@>")('["作品展示"]'))

    # Count total before pagination
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Ordering
    if filter == "hot":
        query = query.order_by(PostModel.likes_count.desc(), PostModel.created_at.desc())
    else:
        query = query.order_by(PostModel.created_at.desc())

    # Pagination
    query = query.offset((page - 1) * page_size).limit(page_size)

    print(f"[DEBUG] Final query: {query}", flush=True)
    result = await db.execute(query)
    rows = result.scalars().all()
    print(f"[DEBUG] Query returned {len(rows)} rows, total={total}", flush=True)

    # Batch check which posts the current user has liked
    liked_post_ids: set[UUID] = set()
    if user_id:
        try:
            user_uuid = UUID(user_id)
            post_ids = [r.id for r in rows]
            if post_ids:
                like_result = await db.execute(
                    select(LikeModel.post_id).where(
                        and_(LikeModel.user_id == user_uuid, LikeModel.post_id.in_(post_ids))
                    )
                )
                liked_post_ids = {row[0] for row in like_result.all()}
        except ValueError:
            pass

    # Build response
    posts = []
    for row in rows:
        author = await _get_author_info(db, row.author_id)
        posts.append(CommunityPost(
            id=row.id,
            author=author,
            title=row.title,
            content=row.content,
            tags=row.tags or [],
            likes=row.likes_count,
            comments_count=row.comments_count,
            is_liked=row.id in liked_post_ids,
            created_at=row.created_at,
        ))

    return PostListResponse(posts=posts, total=total, page=page, page_size=page_size)


# ────────────────────── POST /posts ──────────────────────

@router.post("/posts", response_model=CommunityPost)
async def create_post(
    payload: CreatePostRequest,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_write_db),
) -> CommunityPost:
    """Create a new community post."""
    user_uuid = UUID(user_id)
    now = datetime.now(timezone.utc)

    new_post = PostModel(
        id=uuid4(),
        author_id=user_uuid,
        title=payload.title,
        content=payload.content,
        tags=payload.tags,
        likes_count=0,
        comments_count=0,
        created_at=now,
    )
    db.add(new_post)
    await db.flush()

    author = await _get_author_info(db, user_uuid)

    return CommunityPost(
        id=new_post.id,
        author=author,
        title=new_post.title,
        content=new_post.content,
        tags=new_post.tags or [],
        likes=0,
        comments_count=0,
        is_liked=False,
        created_at=now,
    )


# ────────────────────── PUT /posts/{post_id} ──────────────────────

@router.put("/posts/{post_id}", response_model=CommunityPost)
async def update_post(
    post_id: UUID,
    payload: UpdatePostRequest,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_write_db),
) -> CommunityPost:
    """Update an existing post. Only the author can edit."""
    result = await db.execute(select(PostModel).where(PostModel.id == post_id))
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if str(post.author_id) != user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own posts")

    if payload.title is not None:
        post.title = payload.title
    if payload.content is not None:
        post.content = payload.content
    if payload.tags is not None:
        post.tags = payload.tags
    post.updated_at = datetime.now(timezone.utc)

    await db.flush()

    author = await _get_author_info(db, post.author_id)
    return CommunityPost(
        id=post.id,
        author=author,
        title=post.title,
        content=post.content,
        tags=post.tags or [],
        likes=post.likes_count,
        comments_count=post.comments_count,
        is_liked=False,
        created_at=post.created_at,
    )


# ────────────────────── DELETE /posts/{post_id} ──────────────────────

@router.delete("/posts/{post_id}", response_model=DeletePostResponse)
async def delete_post(
    post_id: UUID,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_write_db),
) -> DeletePostResponse:
    """Delete a post. Only the author can delete. Cascades to comments and likes."""
    result = await db.execute(select(PostModel).where(PostModel.id == post_id))
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if str(post.author_id) != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")

    await db.delete(post)
    await db.flush()

    return DeletePostResponse(success=True, message="帖子已删除")


# ────────────────────── POST /posts/{post_id}/like ──────────────────────

@router.post("/posts/{post_id}/like", response_model=LikeResponse)
async def toggle_like(
    post_id: UUID,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_write_db),
) -> LikeResponse:
    """Toggle like on a post."""
    # Check post exists
    post_result = await db.execute(select(PostModel).where(PostModel.id == post_id))
    post = post_result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    user_uuid = UUID(user_id)

    # Check existing like
    like_result = await db.execute(
        select(LikeModel).where(
            and_(LikeModel.post_id == post_id, LikeModel.user_id == user_uuid)
        )
    )
    existing_like = like_result.scalar_one_or_none()

    if existing_like:
        # Unlike
        await db.delete(existing_like)
        post.likes_count = max(0, post.likes_count - 1)
        is_liked = False
    else:
        # Like
        new_like = LikeModel(id=uuid4(), post_id=post_id, user_id=user_uuid)
        db.add(new_like)
        post.likes_count = post.likes_count + 1
        is_liked = True

    await db.flush()

    return LikeResponse(post_id=post_id, likes=post.likes_count, is_liked=is_liked)


# ────────────────────── GET /posts/{post_id}/comments ──────────────────────

@router.get("/posts/{post_id}/comments", response_model=CommentListResponse)
async def get_comments(
    post_id: UUID,
    user_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> CommentListResponse:
    """Get comments for a post, threaded by parent_id."""
    # Verify post exists
    post_result = await db.execute(select(PostModel.id).where(PostModel.id == post_id))
    if not post_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Post not found")

    # Fetch ALL comments for this post (needed for threading)
    all_result = await db.execute(
        select(CommentModel)
        .where(CommentModel.post_id == post_id)
        .order_by(CommentModel.created_at.asc())
    )
    all_comments = all_result.scalars().all()

    # Separate top-level and replies
    top_level = [c for c in all_comments if c.parent_id is None]
    reply_map: dict[UUID, list] = {}
    for c in all_comments:
        if c.parent_id is not None:
            reply_map.setdefault(c.parent_id, []).append(c)

    liked_comment_ids: set[UUID] = set()
    if user_id:
        try:
            user_uuid = UUID(user_id)
            c_ids = [c.id for c in all_comments]
            if c_ids:
                like_res = await db.execute(
                    select(CommentLikeModel.comment_id).where(
                        and_(CommentLikeModel.user_id == user_uuid, CommentLikeModel.comment_id.in_(c_ids))
                    )
                )
                liked_comment_ids = {row[0] for row in like_res.all()}
        except ValueError:
            pass

    # Build threaded comment tree
    async def build_comment(c) -> PostComment:
        author = await _get_author_info(db, c.author_id)
        replies_raw = reply_map.get(c.id, [])
        replies = []
        for r in replies_raw:
            replies.append(await build_comment(r))
        return PostComment(
            id=c.id,
            post_id=c.post_id,
            author=author,
            content=c.content,
            created_at=c.created_at,
            likes=c.likes_count,
            is_liked=c.id in liked_comment_ids,
            parent_id=c.parent_id,
            replies=replies,
        )

    total = len(top_level)
    start = (page - 1) * page_size
    end = start + page_size
    paginated = top_level[start:end]

    comments = []
    for c in paginated:
        comments.append(await build_comment(c))

    return CommentListResponse(comments=comments, total=total)


# ────────────────────── POST /posts/{post_id}/comments ──────────────────────

@router.post("/posts/{post_id}/comments", response_model=PostComment)
async def create_comment(
    post_id: UUID,
    payload: CreateCommentRequest,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_write_db),
) -> PostComment:
    """Create a comment on a post, optionally as a reply."""
    # Verify post exists
    post_result = await db.execute(select(PostModel).where(PostModel.id == post_id))
    post = post_result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    user_uuid = UUID(user_id)
    now = datetime.now(timezone.utc)

    new_comment = CommentModel(
        id=uuid4(),
        post_id=post_id,
        author_id=user_uuid,
        content=payload.content,
        parent_id=payload.parent_id,
        likes_count=0,
        created_at=now,
    )
    db.add(new_comment)

    # Update post comment count
    post.comments_count = post.comments_count + 1

    # ── Create notifications ──
    comment_preview = payload.content[:100] if payload.content else ""

    if payload.parent_id:
        # This is a REPLY to an existing comment
        parent_result = await db.execute(
            select(CommentModel.author_id).where(CommentModel.id == payload.parent_id)
        )
        parent_author = parent_result.scalar_one_or_none()

        # 1) Always notify the parent comment author with "reply_to_comment"
        #    (unless replying to yourself)
        if parent_author and parent_author != user_uuid:
            reply_notif = NotifModel(
                id=uuid4(),
                recipient_id=parent_author,
                actor_id=user_uuid,
                notification_type="reply_to_comment",
                post_id=post_id,
                comment_id=new_comment.id,
                post_title=post.title,
                comment_preview=comment_preview,
                is_read=False,
                created_at=now,
            )
            db.add(reply_notif)

        # 2) Also notify the post author with "reply_to_comment"
        #    (reply action = reply notification, regardless of recipient)
        #    BUT only if they're different from the parent comment author
        #    (to avoid double-notifying the same person)
        if (post.author_id != user_uuid
                and (not parent_author or post.author_id != parent_author)):
            notif = NotifModel(
                id=uuid4(),
                recipient_id=post.author_id,
                actor_id=user_uuid,
                notification_type="reply_to_comment",
                post_id=post_id,
                comment_id=new_comment.id,
                post_title=post.title,
                comment_preview=comment_preview,
                is_read=False,
                created_at=now,
            )
            db.add(notif)
    else:
        # This is a TOP-LEVEL comment on the post
        # Notify the post author (if commenter is not the post author)
        if post.author_id != user_uuid:
            notif = NotifModel(
                id=uuid4(),
                recipient_id=post.author_id,
                actor_id=user_uuid,
                notification_type="comment_on_post",
                post_id=post_id,
                comment_id=new_comment.id,
                post_title=post.title,
                comment_preview=comment_preview,
                is_read=False,
                created_at=now,
            )
            db.add(notif)

    await db.flush()

    author = await _get_author_info(db, user_uuid)

    return PostComment(
        id=new_comment.id,
        post_id=post_id,
        author=author,
        content=new_comment.content,
        created_at=now,
        likes=0,
        is_liked=False,
        parent_id=new_comment.parent_id,
        replies=[],
    )


# ────────────────────── POST /comments/{comment_id}/like ──────────────────────

@router.post("/comments/{comment_id}/like", response_model=dict)
async def toggle_comment_like(
    comment_id: UUID,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_write_db),
):
    """Toggle like on a comment."""
    # Check comment exists
    result = await db.execute(select(CommentModel).where(CommentModel.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    user_uuid = UUID(user_id)

    # Check existing like
    like_result = await db.execute(
        select(CommentLikeModel).where(
            and_(CommentLikeModel.comment_id == comment_id, CommentLikeModel.user_id == user_uuid)
        )
    )
    existing_like = like_result.scalar_one_or_none()

    if existing_like:
        await db.delete(existing_like)
        comment.likes_count = max(0, comment.likes_count - 1)
        is_liked = False
    else:
        new_like = CommentLikeModel(id=uuid4(), comment_id=comment_id, user_id=user_uuid)
        db.add(new_like)
        comment.likes_count = comment.likes_count + 1
        is_liked = True

    await db.flush()

    return {"comment_id": str(comment_id), "likes": comment.likes_count, "is_liked": is_liked}


# ────────────────────── DELETE /comments/{comment_id} ──────────────────────

@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: UUID,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_write_db),
):
    """Delete a comment. The comment author OR the post author can delete."""
    result = await db.execute(select(CommentModel).where(CommentModel.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    user_uuid = UUID(user_id)

    # Check the post to see if user is the post author
    post_result = await db.execute(select(PostModel).where(PostModel.id == comment.post_id))
    post = post_result.scalar_one_or_none()

    is_comment_author = comment.author_id == user_uuid
    is_post_author = post and post.author_id == user_uuid

    if not is_comment_author and not is_post_author:
        raise HTTPException(status_code=403, detail="只有评论作者或帖子作者可以删除评论")

    # Count this comment and all its nested replies to update post comment count
    # (cascade delete will handle the DB rows, but we need to update the counter)
    reply_count_result = await db.execute(
        select(func.count()).where(CommentModel.parent_id == comment_id)
    )
    direct_reply_count = reply_count_result.scalar() or 0

    await db.delete(comment)

    # Update post comment count
    if post:
        post.comments_count = max(0, post.comments_count - 1 - direct_reply_count)

    await db.flush()

    return {"success": True, "message": "评论已删除"}


# ────────────────────── GET /notifications ──────────────────────

@router.get("/notifications")
async def get_notifications(
    user_id: str = Query(...),
    unread_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get community notifications for a user."""
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        return {"notifications": [], "total": 0, "unread_count": 0}

    try:
        query = select(NotifModel).where(NotifModel.recipient_id == user_uuid)
        if unread_only:
            query = query.where(NotifModel.is_read == False)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Unread count (always)
        unread_query = select(func.count()).where(
            and_(NotifModel.recipient_id == user_uuid, NotifModel.is_read == False)
        )
        unread_result = await db.execute(unread_query)
        unread_count = unread_result.scalar() or 0

        # Ordered by newest first
        query = query.order_by(NotifModel.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await db.execute(query)
        rows = result.scalars().all()

        # Resolve actor info
        notifications = []
        for row in rows:
            actor = await _get_author_info(db, row.actor_id)
            notifications.append({
                "id": str(row.id),
                "recipient_id": str(row.recipient_id),
                "actor": {
                    "id": str(actor.id),
                    "nickname": actor.nickname,
                    "avatar": actor.avatar,
                },
                "notification_type": row.notification_type,
                "post_id": str(row.post_id),
                "comment_id": str(row.comment_id) if row.comment_id else None,
                "post_title": row.post_title,
                "comment_preview": row.comment_preview,
                "is_read": row.is_read,
                "created_at": row.created_at.isoformat(),
            })

        return {
            "notifications": notifications,
            "total": total,
            "unread_count": unread_count,
        }
    except Exception:
        # Table may not exist yet
        return {"notifications": [], "total": 0, "unread_count": 0}


# ────────────────────── POST /notifications/mark-read ──────────────────────

@router.post("/notifications/mark-read")
async def mark_notifications_read(
    user_id: str = Query(...),
    notification_ids: Optional[list[str]] = None,
    db: AsyncSession = Depends(get_write_db),
):
    """Mark notifications as read. If notification_ids is empty/null, mark all as read."""
    user_uuid = UUID(user_id)

    if notification_ids:
        # Mark specific notifications
        uuids = [UUID(nid) for nid in notification_ids]
        await db.execute(
            update(NotifModel)
            .where(and_(NotifModel.recipient_id == user_uuid, NotifModel.id.in_(uuids)))
            .values(is_read=True)
        )
    else:
        # Mark all as read
        await db.execute(
            update(NotifModel)
            .where(and_(NotifModel.recipient_id == user_uuid, NotifModel.is_read == False))
            .values(is_read=True)
        )

    return {"success": True}
