请为 {subject_name} 学科生成 {count} 道{difficulty_desc}难度的题目{topic_clause}。

{type_prompt}

学科适配要求：
1. 题目背景、材料形式、解题方式必须贴合「{subject_name}」学科。
2. 只有当该学科确实适合时才生成 coding / 编程类题目；否则应理解为更贴近该学科的应用题、分析题或实作题。

要求：
1. 题目难度为{difficulty_desc}级别（{difficulty}/5）
2. 题目内容要准确、专业
3. 如果生成多道题，用 JSON 数组包裹{topic_requirement}

只输出 JSON，不要其他内容。
