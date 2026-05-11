"""
Knowledge Graph Service
Handles automatic generation of KnowledgeNodes and Chapters for subjects.
"""
import json
import uuid
import logging
from typing import List, Dict, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..core.config import settings
from ..models.subject import Subject, Chapter
from ..models.learning import KnowledgeNode
from ..prompts import get_prompt_registry
from ..services.llm_service import LLMServiceFactory
from ..services.ai_learning_path_service import SUBJECT_CONFIGS

logger = logging.getLogger(__name__)

class KnowledgeGraphService:
    """Service for generating and managing knowledge graphs per subject."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_generate_graph(self, subject_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """
        Ensures a knowledge graph exists for the subject.
        If empty, generates one using AI if a user has configured it, or using system default.
        """
        # 1. Check if nodes already exist
        node_count_result = await self.db.execute(
            select(func.count(KnowledgeNode.id)).where(KnowledgeNode.subject_id == subject_id)
        )
        if (node_count_result.scalar() or 0) > 0:
            return True

        # 2. Get subject info
        subject_result = await self.db.execute(select(Subject).where(Subject.id == subject_id))
        subject = subject_result.scalar_one_or_none()
        if not subject:
            return False
        # Take a snapshot of subject fields to avoid async lazy-load issues
        # when ORM instances become expired after rollback/commit.
        resolved_subject_id = subject.id
        resolved_subject_key = subject.key
        resolved_subject_name = subject.name
        resolved_subject_description = subject.description

        # 3. Try AI Generation
        config = SUBJECT_CONFIGS.get(resolved_subject_key)
        
        # Check if we can use AI
        from ..models.llm_config import UserLLMConfig
        from ..services.encryption import decrypt_api_key
        
        # Try to find a usable LLM config
        llm_config_result = await self.db.execute(
            select(UserLLMConfig).where(UserLLMConfig.user_id == user_id, UserLLMConfig.is_active == True)
        )
        llm_config = llm_config_result.scalar_one_or_none()
        
        if llm_config:
            try:
                decrypted_key = decrypt_api_key(llm_config.encrypted_api_key)
                llm_service = LLMServiceFactory.create_from_db_config(llm_config, decrypted_key)
                success = await self.generate_with_ai(
                    subject_id=resolved_subject_id,
                    subject_name=resolved_subject_name,
                    subject_description=resolved_subject_description,
                    llm_service=llm_service,
                )
                if success:
                    return True
            except Exception as e:
                logger.error(f"AI generation failed for {resolved_subject_key}, falling back to defaults: {e}")

        # Fallback to system LLM if available
        if settings.deepseek_api_key:
            try:
                llm_service = LLMServiceFactory.create(
                    api_base_url=settings.deepseek_base_url,
                    api_key=settings.deepseek_api_key,
                    model_name=settings.deepseek_model
                )
                success = await self.generate_with_ai(
                    subject_id=resolved_subject_id,
                    subject_name=resolved_subject_name,
                    subject_description=resolved_subject_description,
                    llm_service=llm_service,
                )
                if success:
                    return True
            except Exception as e:
                logger.error(f"System AI generation failed for {resolved_subject_key}: {e}")

        # Final fallback to defaults
        if not config:
            config = type('obj', (object,), {
                'name': resolved_subject_name,
                'context': resolved_subject_description or "General education subject.",
                'default_themes': []
            })
        return await self._generate_from_defaults(resolved_subject_id, resolved_subject_key, config)

    async def _generate_from_defaults(self, subject_id: uuid.UUID, subject_key: str, config: Any) -> bool:
        """Populates graph from default_themes."""
        if not hasattr(config, 'default_themes') or not config.default_themes:
            # Create a very basic structure if no defaults
            config = type('obj', (object,), {
                'default_themes': [("基础入门", ["课程简介", "核心概念"])]
            })

        # Check existing chapters
        chapters_result = await self.db.execute(
            select(Chapter).where(Chapter.subject_id == subject_id).order_by(Chapter.order_index)
        )
        existing_chapters = chapters_result.scalars().all()
        
        # Use existing chapters if available, or create new ones
        for idx, (theme_title, topics) in enumerate(config.default_themes):
            chapter = None
            if idx < len(existing_chapters):
                chapter = existing_chapters[idx]
            else:
                chapter_code = f"{subject_key}_ch_{idx+1}"
                chapter = Chapter(
                    id=uuid.uuid4(),
                    subject_id=subject_id,
                    code=chapter_code,
                    title=theme_title,
                    order_index=idx + 1
                )
                self.db.add(chapter)
                await self.db.flush() # Get ID
            
            # Add nodes for this chapter
            prev_node_code = None
            for node_idx, topic_name in enumerate(topics):
                node_code = f"{subject_key}.{chapter.code}.{node_idx+1}"
                
                # Check if node already exists with this code
                node_check = await self.db.execute(
                    select(KnowledgeNode).where(KnowledgeNode.code == node_code)
                )
                if node_check.scalar_one_or_none():
                    continue

                node = KnowledgeNode(
                    id=uuid.uuid4(),
                    subject_id=subject_id,
                    chapter_id=chapter.id,
                    code=node_code,
                    title=topic_name,
                    difficulty=1,
                    prerequisites=[prev_node_code] if prev_node_code else [],
                    order_index=node_idx + 1
                )
                self.db.add(node)
                prev_node_code = node_code
        
        await self.db.commit()
        return True

    async def generate_with_ai(
        self,
        subject_id: uuid.UUID,
        subject_name: str,
        subject_description: Optional[str],
        llm_service: Any,
    ) -> bool:
        """Uses AI to generate KnowledgeNodes and Chapters."""
        messages = get_prompt_registry().render_messages(
            "knowledge_graph.generate",
            {
                "subject_name": subject_name,
                "subject_context": subject_description or "General subject",
            },
        )
        
        try:
            # We use a lower temperature for structural JSON
            response = await llm_service.chat(
                messages=messages,
                role="explainer" # Generic role, the prompt is specific
            )
            
            content = response.get("content", "")
            # Extract JSON
            start = content.find("{")
            end = content.rfind("}")
            if start == -1 or end == -1:
                return False
                
            data = json.loads(content[start:end+1])
            
            for chapter_data in data.get("chapters", []):
                chapter = Chapter(
                    id=uuid.uuid4(),
                    subject_id=subject_id,
                    code=chapter_data.get("code", f"ch_{uuid.uuid4().hex[:8]}"),
                    title=chapter_data.get("title", "Chapter"),
                    order_index=chapter_data.get("order_index", 0)
                )
                self.db.add(chapter)
                
                for node_data in chapter_data.get("nodes", []):
                    node = KnowledgeNode(
                        id=uuid.uuid4(),
                        subject_id=subject_id,
                        chapter_id=chapter.id,
                        code=node_data.get("code", f"node_{uuid.uuid4().hex[:8]}"),
                        title=node_data.get("title", "Node"),
                        description=node_data.get("description"),
                        difficulty=node_data.get("difficulty", 1),
                        prerequisites=node_data.get("prerequisites", []),
                        order_index=node_data.get("order_index", 0)
                    )
                    self.db.add(node)
            
            await self.db.commit()
            return True
        except Exception as e:
            logger.error(f"AI generation error: {e}")
            await self.db.rollback()
            return False

    async def expand_node(self, node_id: uuid.UUID, user_id: uuid.UUID) -> Optional[List[KnowledgeNode]]:
        """
        Dynamically generates sub-nodes for a given node using AI.
        """
        # 1. Get the parent node and its subject
        node_result = await self.db.execute(select(KnowledgeNode).where(KnowledgeNode.id == node_id))
        parent_node = node_result.scalar_one_or_none()
        if not parent_node:
            logger.error(f"Parent node not found for expansion: {node_id}")
            return None

        subject_result = await self.db.execute(select(Subject).where(Subject.id == parent_node.subject_id))
        subject = subject_result.scalar_one_or_none()
        if not subject:
            return None

        # 2. Prefer User's LLM Config, fallback to System LLM
        llm_service = None
        from ..models.llm_config import UserLLMConfig
        from ..services.encryption import decrypt_api_key

        llm_config_result = await self.db.execute(
            select(UserLLMConfig).where(UserLLMConfig.user_id == user_id, UserLLMConfig.is_active == True)
        )
        llm_config = llm_config_result.scalar_one_or_none()

        if llm_config:
            try:
                decrypted_key = decrypt_api_key(llm_config.encrypted_api_key)
                llm_service = LLMServiceFactory.create_from_db_config(llm_config, decrypted_key)
            except Exception as e:
                logger.error(f"Failed to load user LLM config for expansion: {e}")

        if not llm_service and settings.deepseek_api_key:
            try:
                llm_service = LLMServiceFactory.create(
                    api_base_url=settings.deepseek_base_url,
                    api_key=settings.deepseek_api_key,
                    model_name=settings.deepseek_model
                )
            except Exception as e:
                logger.error(f"System AI generation failed for expansion: {e}")

        if not llm_service:
            logger.error("No LLM service available for node expansion.")
            return None

        # 3. Generate content
        messages = get_prompt_registry().render_messages(
            "knowledge_graph.expand_node",
            {
                "subject_name": subject.name,
                "node_title": parent_node.title,
                "subject_context": subject.description or "General subject",
                "node_description": parent_node.description or "No description",
                "node_code": parent_node.code,
            },
        )

        try:
            response = await llm_service.chat(
                messages=messages,
                role="explainer" 
            )

            content = response.get("content", "")
            
            # Log raw content for debugging (replaces file write)
            logger.debug("[AI Expand] Raw LLM response: %s", content[:2000])

            # Extract JSON
            start = content.find("{")
            end = content.rfind("}")
            if start == -1 or end == -1:
                logger.error(f"Cannot find JSON boundaries in LLM response: {content[:100]}...")
                return None

            data = json.loads(content[start:end+1])
            new_nodes = []

            for node_data in data.get("nodes", []):
                new_node_code = node_data.get("code")
                if not new_node_code:
                    continue
                
                # Check if it already exists
                existing_check = await self.db.execute(select(KnowledgeNode).where(KnowledgeNode.code == new_node_code))
                if existing_check.scalar_one_or_none():
                    continue

                new_node = KnowledgeNode(
                    id=uuid.uuid4(),
                    subject_id=subject.id,
                    chapter_id=parent_node.chapter_id,
                    code=new_node_code,
                    title=node_data.get("title", "New Concept"),
                    description=node_data.get("description"),
                    difficulty=node_data.get("difficulty", parent_node.difficulty or 1),
                    prerequisites=[parent_node.code], # The parent is the prerequisite
                    order_index=(parent_node.order_index or 0) + 1
                )
                self.db.add(new_node)
                new_nodes.append(new_node)

            if new_nodes:
                await self.db.commit()
                # Refresh to get autogenerated fields if any
                for n in new_nodes:
                     await self.db.refresh(n)
            return new_nodes
        except Exception as e:
            import traceback
            logger.error(f"AI expansion error: {e}\n{traceback.format_exc()}")
            await self.db.rollback()
            return None
