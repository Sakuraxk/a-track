"""
Achievement Tree API routes.

Provides endpoints for:
- Getting full achievement tree data for a subject
- Getting summary stats for dashboard card
"""
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from app.models.subject import Subject, Chapter, UserNodeMastery
from app.models.learning import KnowledgeNode

router = APIRouter()
logger = logging.getLogger(__name__)


class TreeNodeResponse(BaseModel):
    id: UUID
    code: str
    title: str
    difficulty: int
    duration_minutes: Optional[int] = None
    prerequisites: list[str] = []
    chapter_id: Optional[UUID] = None
    chapter_code: Optional[str] = None
    order_index: int = 0
    # User state
    status: str = "locked"  # locked, unlocked, learning, mastered
    mastery: int = 0

    class Config:
        from_attributes = True


class ChapterWithNodes(BaseModel):
    id: UUID
    code: str
    title: str
    order_index: int
    nodes: list[TreeNodeResponse]


class AchievementTreeResponse(BaseModel):
    subject_id: UUID
    subject_name: str
    subject_icon: str
    chapters: list[ChapterWithNodes]
    # Summary stats
    total_nodes: int
    mastered_nodes: int
    learning_nodes: int
    unlocked_nodes: int
    locked_nodes: int


class TreeSummaryResponse(BaseModel):
    subject_id: UUID
    subject_name: str
    subject_icon: str
    total_nodes: int
    mastered_nodes: int
    learning_nodes: int
    progress_percent: float


class RebuildTreeResponse(BaseModel):
    success: bool
    message: str
    total_nodes: int


@router.post("/rebuild", response_model=RebuildTreeResponse, summary="Rebuild or initialize achievement tree for a subject")
async def rebuild_achievement_tree(
    subject_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    subject_result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = subject_result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    from app.services.knowledge_graph_service import KnowledgeGraphService

    service = KnowledgeGraphService(db)
    generation_ok = await service.get_or_generate_graph(subject_id, user_id)

    total_result = await db.execute(
        select(func.count(KnowledgeNode.id)).where(KnowledgeNode.subject_id == subject_id)
    )
    total_nodes = total_result.scalar() or 0

    if generation_ok and total_nodes > 0:
        return RebuildTreeResponse(
            success=True,
            message=f"图谱已准备完成，共 {total_nodes} 个知识点",
            total_nodes=total_nodes,
        )

    return RebuildTreeResponse(
        success=False,
        message="未能构建知识图谱，请检查 AI 配置或稍后重试",
        total_nodes=total_nodes,
    )


@router.get("", response_model=AchievementTreeResponse, summary="Get full achievement tree for a subject")
async def get_achievement_tree(
    subject_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    # Auto-generate graph disabled for debugging/stability
    # try:
    #     from app.services.knowledge_graph_service import KnowledgeGraphService
    #     kg_service = KnowledgeGraphService(db)
    #     await kg_service.get_or_generate_graph(subject_id, user_id)
    # except Exception as e:
    #     logger.error(f"Generate graph failed but continuing: {e}")

    # Get subject
    subject_result = await db.execute(
        select(Subject).where(Subject.id == subject_id)
    )
    subject = subject_result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Get chapters
    chapters_result = await db.execute(
        select(Chapter)
        .where(Chapter.subject_id == subject_id)
        .order_by(Chapter.order_index)
    )
    chapters = chapters_result.scalars().all()

    # Get all nodes for this subject
    nodes_result = await db.execute(
        select(KnowledgeNode)
        .where(KnowledgeNode.subject_id == subject_id)
        .order_by(KnowledgeNode.order_index)
    )
    nodes = nodes_result.scalars().all()

    if not chapters and not nodes:
        raise HTTPException(status_code=404, detail="该学科暂无知识点数据")

    # Get user's mastery states
    node_ids = [n.id for n in nodes]
    masteries = {}
    if node_ids:
        try:
            mastery_result = await db.execute(
                select(UserNodeMastery).where(
                    UserNodeMastery.user_id == user_id,
                    UserNodeMastery.knowledge_node_id.in_(node_ids),
                )
            )
            masteries = {m.knowledge_node_id: m for m in mastery_result.scalars().all()}

            # Initialize mastery records for nodes that don't have them
            missing_nodes = [n for n in nodes if n.id not in masteries]
            if missing_nodes:
                new_masteries = []
                for node in missing_nodes:
                    prereqs = node.prerequisites or []
                    initial_status = "unlocked" if len(prereqs) == 0 else "locked"
                    new_mastery = UserNodeMastery(
                        user_id=user_id,
                        knowledge_node_id=node.id,
                        status=initial_status,
                        mastery=0,
                    )
                    new_masteries.append(new_mastery)
                db.add_all(new_masteries)
                try:
                    await db.commit()
                except Exception as db_e:
                    await db.rollback()
                    logger.warning(f"Mastery auto-creation collision (likely concurrent requests): {db_e}")
        except Exception as e:
            logger.error(f"Mastery processing failed: {e}")

    # Build response
    chapter_map = {c.id: c for c in chapters}
    chapter_nodes: dict[UUID, list[TreeNodeResponse]] = {c.id: [] for c in chapters}
    uncategorized_nodes: list[TreeNodeResponse] = []

    stats = {"mastered": 0, "learning": 0, "unlocked": 0, "locked": 0}

    for node in nodes:
        try:
            mastery = masteries.get(node.id)
            status = mastery.status if mastery else "locked"
            mastery_value = mastery.mastery if mastery else 0
            stats[status] = stats.get(status, 0) + 1

            chapter = chapter_map.get(node.chapter_id) if node.chapter_id else None
            tree_node = TreeNodeResponse(
                id=node.id,
                code=node.code,
                title=node.title,
                difficulty=node.difficulty or 1,
                duration_minutes=node.duration_minutes,
                prerequisites=node.prerequisites or [],
                chapter_id=node.chapter_id,
                chapter_code=chapter.code if chapter else None,
                order_index=node.order_index or 0,
                status=status,
                mastery=mastery_value,
            )

            if node.chapter_id and node.chapter_id in chapter_nodes:
                chapter_nodes[node.chapter_id].append(tree_node)
            else:
                uncategorized_nodes.append(tree_node)
        except Exception as node_err:
            logger.error(f"Node building error for {node.id}: {node_err}")

    chapters_with_nodes = []
    for c in chapters:
        try:
            chapters_with_nodes.append(
                ChapterWithNodes(
                    id=c.id,
                    code=c.code,
                    title=c.title,
                    order_index=c.order_index,
                    nodes=chapter_nodes.get(c.id, []),
                )
            )
        except Exception as chap_err:
             logger.error(f"Chapter building error for {c.id}: {chap_err}")

    if uncategorized_nodes:
        chapters_with_nodes.append(
            ChapterWithNodes(
                id=UUID("00000000-0000-0000-0000-000000000000"),
                code="uncategorized",
                title="其他",
                order_index=999,
                nodes=uncategorized_nodes,
            )
        )

    return AchievementTreeResponse(
        subject_id=subject.id,
        subject_name=subject.name,
        subject_icon=subject.icon or "📚",
        chapters=chapters_with_nodes,
        total_nodes=len(nodes),
        mastered_nodes=stats.get("mastered", 0),
        learning_nodes=stats.get("learning", 0),
        unlocked_nodes=stats.get("unlocked", 0),
        locked_nodes=stats.get("locked", 0),
    )


class ExpandNodeResponse(BaseModel):
    success: bool
    new_nodes: list[TreeNodeResponse]
    message: Optional[str] = None

@router.get("/{node_id}/expand", response_model=ExpandNodeResponse, summary="Expand a knowledge node dynamically")
async def expand_achievement_tree_node(
    node_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    from app.services.knowledge_graph_service import KnowledgeGraphService
    kg_service = KnowledgeGraphService(db)
    
    try:
        new_nodes = await kg_service.expand_node(node_id, user_id)
        if not new_nodes:
            return ExpandNodeResponse(
                success=False,
                new_nodes=[],
                message="未能生成新的延伸节点，请稍后再试或检查 AI 额度"
            )
        
        # We also need to get chapter info for the new nodes to build TreeNodeResponse properly
        # Usually they inherit the chapter of the parent node
        # In a real app we might fetch the chapter, but for simplicity we can construct basic ones
        
        responses = []
        for node in new_nodes:
            # All new nodes start as locked for the user since they were just created
            responses.append(
                TreeNodeResponse(
                    id=node.id,
                    code=node.code,
                    title=node.title,
                    difficulty=node.difficulty or 1,
                    duration_minutes=node.duration_minutes,
                    prerequisites=node.prerequisites or [],
                    chapter_id=node.chapter_id,
                    chapter_code=None, # Usually we'd look this up, but it's okay for now
                    order_index=node.order_index or 0,
                    status="locked", 
                    mastery=0,
                )
            )

        return ExpandNodeResponse(
            success=True,
            new_nodes=responses,
            message=f"成功发散出 {len(new_nodes)} 个子概念节点"
        )
    except Exception as e:
        logger.error(f"Error expanding node {node_id}: {e}")
        return ExpandNodeResponse(
            success=False,
            new_nodes=[],
            message=f"扩展节点时服务器出错"
        )



@router.get("/summary", response_model=TreeSummaryResponse)
async def get_tree_summary(
    subject_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get lightweight summary for dashboard card"""
    # Get subject
    subject_result = await db.execute(
        select(Subject).where(Subject.id == subject_id)
    )
    subject = subject_result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Count total nodes
    total_result = await db.execute(
        select(func.count(KnowledgeNode.id)).where(
            KnowledgeNode.subject_id == subject_id
        )
    )
    total_nodes = total_result.scalar() or 0

    # Count mastered nodes
    mastered_result = await db.execute(
        select(func.count(UserNodeMastery.id)).where(
            UserNodeMastery.user_id == user_id,
            UserNodeMastery.knowledge_node_id.in_(
                select(KnowledgeNode.id).where(
                    KnowledgeNode.subject_id == subject_id
                )
            ),
            UserNodeMastery.status == "mastered",
        )
    )
    mastered_nodes = mastered_result.scalar() or 0

    # Count learning nodes
    learning_result = await db.execute(
        select(func.count(UserNodeMastery.id)).where(
            UserNodeMastery.user_id == user_id,
            UserNodeMastery.knowledge_node_id.in_(
                select(KnowledgeNode.id).where(
                    KnowledgeNode.subject_id == subject_id
                )
            ),
            UserNodeMastery.status == "learning",
        )
    )
    learning_nodes = learning_result.scalar() or 0

    progress = (mastered_nodes / total_nodes * 100) if total_nodes > 0 else 0.0

    return TreeSummaryResponse(
        subject_id=subject.id,
        subject_name=subject.name,
        subject_icon=subject.icon or "📚",
        total_nodes=total_nodes,
        mastered_nodes=mastered_nodes,
        learning_nodes=learning_nodes,
        progress_percent=round(progress, 1),
    )
