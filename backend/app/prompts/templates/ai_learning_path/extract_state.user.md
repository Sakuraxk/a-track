请根据下面的学习路径澄清上下文，提取结构化状态。

## 最近对话（JSON）
{session_messages_json}

## 偏好快照摘要
{snapshot_summary}

## 用户能力画像
{ability_tags_detail}

## 用户学习统计
{learning_stats}

## 规则兜底提取结果（仅供参考）
{rule_state_json}

## 输出格式（严格 JSON）
{{
  "goal": "用户学习目标，未知则为空字符串",
  "current_level": "用户当前水平，未知则为空字符串",
  "target_scope": "重点范围/主题/方向，未知则为空字符串",
  "time_budget": "时间安排/投入节奏，未知则为空字符串",
  "total_days": 0,
  "confirmation": false
}}

只输出纯 JSON 字符串，不要包含任何额外说明。
