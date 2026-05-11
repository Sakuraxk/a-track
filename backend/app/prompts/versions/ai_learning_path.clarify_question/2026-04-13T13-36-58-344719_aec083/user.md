请为一位 {subject_name} 学习者生成下一轮澄清提问。

## 当前上下文
- 学科 key: {subject_key}
- 当前 AI 轮次: {turn_index}
- ready-check 摘要: {ready_summary}
- 仍缺少的信息: {missing_items_json}
- 偏好备注: {snapshot_notes}

## 用户能力画像
{ability_tags_detail}

## 用户学习统计
{learning_stats}

## 最近消息（JSON）
{recent_messages_json}

## 最近一轮用户补充
{latest_user_reply}

## 上一轮 assistant 问题
{previous_assistant_question}

## 回退候选问题
{fallback_question}

## 回退快捷选项（JSON）
{fallback_quick_options_json}

## 生成要求
1. 优先追问仍缺少的信息，不要重复已经明确回答过的内容。
2. 问题要简洁自然，长度尽量控制在 20 到 80 个中文字符。
3. `quick_options` 要贴近问题本身，适合作为按钮文案。
4. 如果最近消息已经很充分，可以把问题写成确认式补充提问，但不要直接输出总结。
5. 如果用户已经给出新的补充，不要重复上一轮 assistant 问题，也不要继续重复 fallback 候选问题。
6. 如果当前问题是在问时间安排、学习节奏或可投入时长，`quick_options` 也必须全部是时间/节奏相关选项，不能混入主题方向或学习内容。

## 输出格式（严格 JSON）
{{
  "question": "下一轮问题",
  "quick_options": ["选项1", "选项2", "选项3"]
}}

只输出纯 JSON 字符串，不要包含任何额外说明。
