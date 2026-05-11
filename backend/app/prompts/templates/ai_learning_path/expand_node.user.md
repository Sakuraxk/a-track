请为学习路径树节点生成下一层直接子节点。

## 当前学科
- subject_key: {subject_key}
- subject_name: {subject_name}

## 当前父节点
- node_id: {parent_node_id}
- label: {parent_node_label}
- description: {parent_node_description}
- 发散模式: {expansion_mode}
- 模式说明: {expansion_mode_description}

## 用户当前澄清上下文
- ready-check 摘要: {ready_summary}
- 偏好快照: {snapshot_summary}

## 用户能力画像
{ability_tags_detail}

## 用户学习统计
{learning_stats}

## 最近对话（JSON）
{session_messages_json}

## 已有子节点 ID（JSON）
{existing_child_ids_json}

## 已有子节点标题（JSON）
{existing_child_labels_json}

## 输出格式（严格 JSON）
{{
  "nodes": [
    {{
      "slug": "english-kebab-slug",
      "label": "中文节点名",
      "description": "节点说明",
      "tags": ["tag1", "tag2"]
    }}
  ]
}}

只输出纯 JSON 字符串，不要包含任何额外说明。
