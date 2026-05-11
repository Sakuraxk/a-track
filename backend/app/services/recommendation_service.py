"""
智能推荐服务
基于用户能力标签和薄弱项推荐练习题
"""
from typing import List, Dict, Optional
from uuid import UUID

from ..schemas.practice import Exercise


def get_recommended_exercises(
    exercises: List[Exercise],
    ability_tags: Dict[str, float],
    weaknesses: Dict[str, int],
    limit: int = 5
) -> tuple[List[Exercise], str]:
    """
    根据用户能力和薄弱项推荐练习题

    Args:
        exercises: 所有可用的练习题
        ability_tags: 用户能力标签 {标签: 分数(0-100)}
        weaknesses: 用户薄弱项 {错误标签: 出错次数}
        limit: 返回的最大题目数

    Returns:
        (推荐的题目列表, 推荐理由)
    """
    if not exercises:
        return [], "暂无可推荐的练习题"

    # 计算用户整体水平 (0-100)
    if ability_tags:
        avg_ability = sum(ability_tags.values()) / len(ability_tags)
    else:
        avg_ability = 50  # 新用户默认中等水平

    # 将能力转换为适合的难度 (1-5)
    # 能力 0-30 -> 难度 1
    # 能力 30-50 -> 难度 2
    # 能力 50-70 -> 难度 3
    # 能力 70-85 -> 难度 4
    # 能力 85-100 -> 难度 5
    if avg_ability < 30:
        target_difficulty = 1
    elif avg_ability < 50:
        target_difficulty = 2
    elif avg_ability < 70:
        target_difficulty = 3
    elif avg_ability < 85:
        target_difficulty = 4
    else:
        target_difficulty = 5

    # 为每道题计算推荐分数
    scored_exercises: List[tuple[Exercise, float, str]] = []

    for exercise in exercises:
        score = 0.0
        reasons = []

        # 1. 难度匹配度 (最重要，占50%)
        difficulty_diff = abs(exercise.difficulty - target_difficulty)
        if difficulty_diff == 0:
            score += 50
            reasons.append("难度匹配")
        elif difficulty_diff == 1:
            score += 35
            reasons.append("难度接近")
        elif difficulty_diff == 2:
            score += 20
        else:
            score += 5

        # 2. 薄弱项匹配 (占30%)
        if weaknesses:
            for node in exercise.linked_nodes:
                # 检查知识点是否与薄弱项相关
                for weakness_tag, count in weaknesses.items():
                    if weakness_tag in node or node.split('.')[0] in weakness_tag:
                        weakness_score = min(30, count * 10)  # 最多30分
                        score += weakness_score
                        reasons.append(f"针对薄弱项: {weakness_tag}")
                        break

        # 3. 能力标签匹配 (占20%)
        if ability_tags:
            for node in exercise.linked_nodes:
                node_category = node.split('.')[0]
                for tag, tag_score in ability_tags.items():
                    if node_category in tag.lower() or tag.lower() in node_category:
                        # 分数低于60的能力优先推荐
                        if tag_score < 60:
                            score += 20
                            reasons.append(f"强化能力: {tag}")
                        elif tag_score < 80:
                            score += 10
                        break

        scored_exercises.append((exercise, score, ", ".join(reasons[:2]) if reasons else "综合推荐"))

    # 按分数排序
    scored_exercises.sort(key=lambda x: x[1], reverse=True)

    # 取前N个，同时确保难度多样性
    recommended = []
    seen_difficulties = set()

    for exercise, score, reason in scored_exercises:
        if len(recommended) >= limit:
            break
        # 优先保证推荐的题目难度有一定多样性
        if len(recommended) < 3 or exercise.difficulty not in seen_difficulties or len(seen_difficulties) >= 3:
            recommended.append(exercise)
            seen_difficulties.add(exercise.difficulty)

    # 生成推荐理由
    if weaknesses:
        top_weakness = max(weaknesses.items(), key=lambda x: x[1])[0]
        rationale = f"根据您的学习情况，重点推荐针对「{top_weakness}」相关的练习题，难度适合您当前水平（{target_difficulty}级）。"
    elif avg_ability < 50:
        rationale = f"作为初学者，推荐从基础题目开始练习，当前推荐难度{target_difficulty}级的题目。"
    elif avg_ability >= 80:
        rationale = f"您已经有较好的基础，推荐挑战难度{target_difficulty}级的进阶题目。"
    else:
        rationale = f"根据您的能力水平，推荐难度{target_difficulty}级的练习题，循序渐进提升技能。"

    return recommended, rationale


def get_exercises_by_node(
    exercises: List[Exercise],
    node_code: str
) -> List[Exercise]:
    """
    根据知识点代码获取相关练习题

    Args:
        exercises: 所有可用的练习题
        node_code: 知识点代码，如 "loops.for"

    Returns:
        相关的练习题列表
    """
    related = []
    node_prefix = node_code.split('.')[0]  # 获取大类，如 "loops"

    for exercise in exercises:
        for linked_node in exercise.linked_nodes:
            if node_code in linked_node or linked_node.startswith(node_prefix):
                related.append(exercise)
                break

    # 按难度排序
    related.sort(key=lambda x: x.difficulty)
    return related


def calculate_mastery_from_results(
    results: List[Dict],
    node_code: str
) -> int:
    """
    根据练习结果计算某知识点的掌握度

    Args:
        results: 练习结果列表 [{"exercise_id": ..., "score": ..., "linked_nodes": [...]}]
        node_code: 知识点代码

    Returns:
        掌握度 (0-100)
    """
    relevant_scores = []

    for result in results:
        linked_nodes = result.get("linked_nodes", [])
        if any(node_code in node or node.split('.')[0] == node_code.split('.')[0]
               for node in linked_nodes):
            relevant_scores.append(result.get("score", 0))

    if not relevant_scores:
        return 0

    # 加权平均，最近的结果权重更高
    if len(relevant_scores) <= 3:
        return int(sum(relevant_scores) / len(relevant_scores))

    # 最近3次成绩权重更高
    recent = relevant_scores[-3:]
    older = relevant_scores[:-3]

    recent_avg = sum(recent) / len(recent) if recent else 0
    older_avg = sum(older) / len(older) if older else 0

    # 70% 权重给最近成绩，30% 给历史成绩
    return int(recent_avg * 0.7 + older_avg * 0.3)
