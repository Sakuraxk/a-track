你将为同一位学习者“续写”学习路线的后续部分（分阶段解锁）。

## 学习者信息
- 当前水平: {level}
- 学习目标: {goal}
- 总天数: {total_days}天
- 每日学习时间: {daily_minutes}分钟

## 能力评估数据
{ability_tags_detail}

## 弱点分析（需要重点加强的领域）
{weak_areas}

## 已生成的前置学习路线（JSON 摘要）
{existing_days_json}

## 学习记录摘要（来自平台真实数据）
{learning_stats}

## ⚠️ 学科范围约束（硬性红线，必须严格遵守）
续写内容必须严格延续前置路线所属学科，所有 theme、task title、task description 必须属于该学科范围。
违反以下约束将导致生成结果被系统拒绝：
{subject_scope_constraints}

## 路线树主线（优先贴合）
{subject_tree_guidance}

{subject_task_examples_section}
## 续写要求
1. **严格学科一致性（最高优先级）**：所有 task 的 title、description 和 resources 必须严格属于前置路线所属学科范围，禁止出现与该学科无关的基础编程练习或其他学科内容。生成完毕后请自查。
2. 你只需要生成第 {start_day} 天到第 {end_day} 天（包含首尾），不要重复生成前面的天数
3. 任务类型与难度要承接前面的节奏，并根据弱项多安排 exercise/review
4. 每天安排2-4个学习任务，总时长接近每日学习时间
5. milestone 继续每 3-5 天设置一次
6. **每天的 theme 必须唯一且不同**：如果同一个大主题需要跨多天，必须用后缀区分，例如"经典监督学习：回归方法"和"经典监督学习：分类方法"

## 输出格式（严格严格 JSON）
你必须返回一个包含第 {start_day} 天到第 {end_day} 天的 JSON 对象。

只输出纯 JSON 字符串，不要包含任何解释文字或 markdown 标记。
