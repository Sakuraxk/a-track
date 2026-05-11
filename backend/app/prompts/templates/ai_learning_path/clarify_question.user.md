请为一位 {subject_name} 学习者生成下一轮澄清提问。

## 当前上下文
- 学科 key: {subject_key}
- 当前 AI 轮次: {turn_index}
- ready-check 摘要: {ready_summary}
- 仍缺少的信息: {missing_items_json}
- 已经明确的信息: {completed_items_json}
- 是否已具备生成条件: {generation_ready}
- 收敛提示: {ready_to_generate_hint}
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
2. 如果用户表现出零基础、犹豫、说“不太清楚/不知道怎么选/不是很确定”，先用一句简短的话降低压力，再继续问核心问题。
3. `question` 可以包含“肯定 + 为什么要问 + 一个核心问题”三部分，但整体仍要自然、紧凑、像真人教练，不要写成空泛鸡汤。
4. 不要直接把问题压缩成非常短的表单句；允许更完整一点，让用户觉得你在陪他一起梳理。
5. `quick_options` 要贴近问题本身，像真正可点击的回答，而不是机械关键词。
6. 如果当前问题是在问时间安排、学习节奏或可投入时长，`quick_options` 也必须全部是时间/节奏相关选项，不能混入主题方向或学习内容。
7. 如果用户明显不确定，至少给一个“请你帮我推荐”或“先帮我缩小范围”的选项。
8. 如果最近消息已经很充分，只缺确认，可以把问题写成温和的确认式补充提问。
9. 对 `completed_items_json` 中已经明确的信息，禁止再次直接追问；只有在用户主动推翻或补充该信息时，才允许重新确认。
10. 如果 `generation_ready` 为 true，你的首要任务是主动收敛：明确告诉用户“现在可以直接生成新版本”，不要继续发散出新的探索性问题。
11. `quick_options` 必须始终在当前学科（{subject_name}）范围内表述。禁止生成看起来像在让用户切换到另一门学科的选项（如"想深入机器学习"或"想深入某个领域，比如机器学习或Web开发"）。应始终将应用方向表述为当前学科下的方向（如"用 {subject_name} 做 Web 开发"而非"Web开发"）。

## 输出格式（严格 JSON）
{{
  "question": "下一轮问题",
  "quick_options": ["选项1", "选项2", "选项3"]
}}

只输出纯 JSON 字符串，不要包含任何额外说明。
