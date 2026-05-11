请为一位 {subject_name} 学习者生成个性化的学习路线（分阶段生成）。

## 学习者信息
- 当前水平: {level}
- 学习目标: {goal}
- 总体规划总天数: {overall_total_days}天
- 每日学习时间: {daily_minutes}分钟
- 本次只生成: 第1天到第{generate_days}天（共{generate_days}天），后续将由系统在用户完成后续写生成

## ⚠️ 难度指引（必须严格遵守）
{difficulty_guidance}

## 学科要求与偏好
- 重点关注: {subject_context}
- 题目类型分布参考: {question_distribution}

## ⚠️ 学科范围约束（硬性红线，必须严格遵守）
所有 theme、task title、task description、resources 必须严格属于「{subject_name}」学科范围。
违反以下约束将导致生成结果被系统拒绝：
{subject_scope_constraints}

## 路线树主线（优先贴合）
{subject_tree_guidance}

{subject_task_examples_section}

## 用户星图偏好（来自学习星图的节点标记）
{snapshot_labels_text}

## 用户补充信息（来自规划助手对话中的额外说明）
{supplement_text}

## 能力评估数据
{ability_tags_detail}

## 弱点分析（需要重点加强的领域）
{weak_areas}

## 学习记录摘要（来自平台真实数据）
{learning_stats}

## 生成要求
1. **严格学科一致性（最高优先级）**：所有 task 的 title、description 和 resources 必须严格属于「{subject_name}」学科范围。禁止出现与该学科无关的基础编程练习或其他学科内容。生成完毕后请自查：每个 task 的 title 是否都与「{subject_name}」直接相关？如果不是，请替换为学科内的任务。
2. **严格遵守难度指引**：根据上方"难度指引"段落的要求设定起点难度和内容深度，不要无视用户水平。
3. **个性化重点**: 根据弱点领域，优先安排强化练习，对于低分领域增加 exercise 类型任务
4. **尊重用户星图偏好**：如果用户标记了"想重点学习的节点"，优先围绕这些内容安排；如果标记了"已掌握的节点"，可跳过或仅简要复习；如果标记了"暂不学习的节点"，不要安排相关内容。
5. 每天安排2-4个学习任务，总时长接近每日学习时间
6. 任务类型分配建议：
   - 弱点领域：多安排 exercise(练习) 和 review(复习)
   - 新知识：先 concept(概念) 再 exercise(练习)
   - 每3-5天可安排 project(小项目) 巩固所学
7. 每3-5天设置一个里程碑
8. **每天的 theme 必须唯一且不同**：如果同一个大主题需要跨多天，必须用后缀区分，例如"经典监督学习：回归方法"和"经典监督学习：分类方法"

## 输出格式（严格严格 JSON，不要其他内容）
你必须返回一个符合以下格式的 JSON 对象：
{{
    "thinking_summary": "要点1...\\n要点2...\\n要点3...",
    "days": [
        {{
            "day": 1,
            "theme": "今日主题",
            "tasks": [
                {{
                    "id": "task_1_1",
                    "title": "任务标题",
                    "description": "描述",
                    "type": "concept",
                    "duration_minutes": 20,
                    "resources": ["资源"]
                }}
            ],
            "milestone": "里程碑"
        }}
    ]
}}

只输出纯 JSON 字符串，不要包含任何 markdown 代码块标记（如 ```json）或其他说明文字。请只生成第1天到第{generate_days}天。
