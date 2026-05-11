from typing import List
from uuid import UUID

from app.schemas.practice import Exercise


async def recommend_exercises(user_id: UUID, recent_errors: List[str]) -> List[Exercise]:
    """Placeholder recommendation engine; replace with real pgvector/RAG logic."""
    return []
