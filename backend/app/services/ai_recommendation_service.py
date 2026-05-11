"""
AI智能推荐服务
使用LLM生成个性化的练习题推荐
"""
import json
from typing import List, Dict, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..prompts import get_prompt_registry
from ..models.llm_config import UserLLMConfig
from ..schemas.practice import Exercise
from ..services.llm_service import LLMService, LLMServiceFactory, LLMServiceError
from ..services.encryption import decrypt_api_key
from ..services.recommendation_service import get_recommended_exercises


class AIRecommendationService:
    """AI智能推荐服务 - 使用LLM生成个性化推荐"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_ai_recommendations(
        self,
        user_id: str,
        exercises: List[Exercise],
        ability_tags: Dict[str, float],
        weaknesses: Dict[str, int],
        limit: int = 5
    ) -> Tuple[List[Exercise], str]:
        """
        使用AI生成个性化推荐

        Args:
            user_id: 用户ID
            exercises: 可用的练习题列表
            ability_tags: 用户能力标签
            weaknesses: 用户薄弱项
            limit: 返回题目数量

        Returns:
            (推荐的题目列表, 推荐理由)
        """
        # 尝试获取用户的LLM配置
        llm_service = await self._get_llm_service(user_id)

        if not llm_service:
            # 无LLM配置，降级到静态算法
            return get_recommended_exercises(exercises, ability_tags, weaknesses, limit)

        try:
            # 准备题目列表描述
            exercises_list = self._format_exercises_list(exercises[:20])  # 最多发送20道题给AI

            # 计算用户整体水平描述
            level_description = self._get_level_description(ability_tags)

            messages = get_prompt_registry().render_messages(
                "ai_recommendation.recommend",
                {
                    "ability_tags": json.dumps(ability_tags, ensure_ascii=False) if ability_tags else "未知",
                    "weaknesses": json.dumps(weaknesses, ensure_ascii=False) if weaknesses else "无",
                    "level_description": level_description,
                    "exercises_list": exercises_list,
                },
            )

            # 调用LLM
            response = await llm_service.chat(
                messages=messages,
                role="explainer",
                context={"ability_tags": ability_tags}
            )

            # 解析响应
            recommended, rationale = self._parse_ai_response(
                response.get("content", ""),
                exercises,
                limit
            )

            if recommended:
                return recommended, rationale

            # AI响应解析失败，降级到静态算法
            return get_recommended_exercises(exercises, ability_tags, weaknesses, limit)

        except LLMServiceError as e:
            # LLM调用失败，降级到静态算法
            print(f"[AIRecommendation] LLM调用失败，降级到静态算法: {e}")
            return get_recommended_exercises(exercises, ability_tags, weaknesses, limit)

    async def _get_llm_service(self, user_id: str) -> Optional[LLMService]:
        """获取用户的LLM服务实例"""
        try:
            result = await self.db.execute(
                select(UserLLMConfig).where(
                    UserLLMConfig.user_id == user_id,
                    UserLLMConfig.is_active == True
                )
            )
            config = result.scalar_one_or_none()

            if not config:
                return None

            # 解密API密钥
            decrypted_key = decrypt_api_key(config.api_key_encrypted)

            # 创建LLM服务
            return LLMServiceFactory.create_from_db_config(config, decrypted_key)

        except Exception as e:
            print(f"[AIRecommendation] 获取LLM配置失败: {e}")
            return None

    def _format_exercises_list(self, exercises: List[Exercise]) -> str:
        """格式化题目列表供AI阅读"""
        lines = []
        for ex in exercises:
            difficulty_label = ["入门", "简单", "中等", "较难", "困难"][min(ex.difficulty - 1, 4)]
            nodes_str = ", ".join(ex.linked_nodes[:3])  # 最多显示3个知识点
            lines.append(f"- ID: {ex.id} | 标题: {ex.title} | 难度: {difficulty_label} | 知识点: {nodes_str}")
        return "\n".join(lines)

    def _get_level_description(self, ability_tags: Dict[str, float]) -> str:
        """根据能力标签生成水平描述"""
        if not ability_tags:
            return "新手，刚开始学习Python"

        avg_score = sum(ability_tags.values()) / len(ability_tags)

        if avg_score < 30:
            return "入门级，需要从基础开始学习"
        elif avg_score < 50:
            return "初学者，已掌握基础语法"
        elif avg_score < 70:
            return "中级水平，能够独立解决一般问题"
        elif avg_score < 85:
            return "进阶水平，具备较好的编程能力"
        else:
            return "高级水平，可以挑战复杂问题"

    def _parse_ai_response(
        self,
        response: str,
        exercises: List[Exercise],
        limit: int
    ) -> Tuple[List[Exercise], str]:
        """解析AI响应"""
        try:
            # 尝试提取JSON
            response = response.strip()

            # 处理可能的markdown代码块
            if response.startswith("```"):
                lines = response.split("\n")
                json_lines = []
                in_json = False
                for line in lines:
                    if line.startswith("```json") or line.startswith("```"):
                        in_json = not in_json
                        continue
                    if in_json:
                        json_lines.append(line)
                response = "\n".join(json_lines)

            data = json.loads(response)

            recommended_ids = data.get("recommended_ids", [])
            rationale = data.get("rationale", "AI智能推荐")

            # 根据ID筛选题目
            id_to_exercise = {str(ex.id): ex for ex in exercises}
            recommended = []

            for rec_id in recommended_ids[:limit]:
                rec_id_str = str(rec_id)
                if rec_id_str in id_to_exercise:
                    recommended.append(id_to_exercise[rec_id_str])

            return recommended, rationale

        except (json.JSONDecodeError, KeyError, TypeError) as e:
            print(f"[AIRecommendation] 解析AI响应失败: {e}, response: {response[:200]}")
            return [], ""
