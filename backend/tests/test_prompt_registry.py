"""
Tests for prompt registry and prompt template management.
"""
import pytest

from app.prompts.registry import PromptRenderError, PromptRegistry


def test_registry_loads_catalog_and_renders_assessment_messages():
    registry = PromptRegistry()

    definition = registry.get_definition("assessment.generate_questions")
    messages = registry.render_messages("assessment.generate_questions", {})

    assert definition.name == "assessment.generate_questions"
    assert definition.temperature == 0.7
    assert definition.max_tokens == 2000
    assert len(messages) == 1
    assert messages[0]["role"] == "user"
    assert "请生成 5 道 Python 编程水平评估题目。" in messages[0]["content"]


def test_registry_renders_system_and_user_messages_for_question_bank():
    registry = PromptRegistry()

    messages = registry.render_messages(
        "question_bank.generate",
        {
            "subject_name": "Python",
            "count": 2,
            "difficulty_desc": "中等",
            "difficulty": 3,
            "type_prompt": "请生成选择题。",
            "topic_clause": "，主题为“列表推导式”",
            "topic_requirement": "\n4. 题目应紧扣“列表推导式”主题，避免偏题",
        },
    )

    assert messages[0]["role"] == "system"
    assert "只输出 JSON 格式的题目数据" in messages[0]["content"]
    assert messages[1]["role"] == "user"
    assert "请为 Python 学科生成 2 道中等难度的题目" in messages[1]["content"]
    assert "列表推导式" in messages[1]["content"]


def test_registry_raises_when_required_variable_missing():
    registry = PromptRegistry()

    with pytest.raises(PromptRenderError) as excinfo:
        registry.render_messages(
            "question_bank.generate",
            {
                "count": 2,
                "difficulty_desc": "中等",
                "difficulty": 3,
                "type_prompt": "请生成选择题。",
                "topic_clause": "",
                "topic_requirement": "",
            },
        )

    assert "subject_name" in str(excinfo.value)


def test_registry_renders_assessment_analysis_payload():
    registry = PromptRegistry()

    messages = registry.render_messages(
        "assessment.analyze_results",
        {
            "assessment_data": '[{"category": "函数", "is_correct": false}]',
        },
    )

    assert len(messages) == 1
    assert messages[0]["role"] == "user"
    assert "assessment_data" not in messages[0]["content"]
    assert '"category": "函数"' in messages[0]["content"]


def test_registry_lists_known_definitions():
    registry = PromptRegistry()

    definitions = registry.list_definitions()
    definition_names = [definition.name for definition in definitions]

    assert "assessment.generate_questions" in definition_names
    assert "question_bank.generate" in definition_names
    assert "concept_learning.generate_map" in definition_names
    assert "concept_learning.generate_article" in definition_names
    assert "concept_learning.diagram_backfill" in definition_names
    assert "concept_learning.exercise_generate" in definition_names


def test_registry_reads_raw_prompt_content():
    registry = PromptRegistry()

    content = registry.get_prompt_content("question_bank.generate")

    assert content.name == "question_bank.generate"
    assert "只输出 JSON 格式的题目数据" in (content.system_template or "")
    assert "请为 {subject_name} 学科生成" in content.user_template
    assert content.temperature == 0.7


def test_registry_can_render_with_template_overrides():
    registry = PromptRegistry()

    messages = registry.render_messages(
        "question_bank.generate",
        {
            "subject_name": "Python",
            "count": 1,
            "difficulty_desc": "基础",
            "difficulty": 2,
            "type_prompt": "请生成选择题。",
            "topic_clause": "",
            "topic_requirement": "",
        },
        overrides={
            "system_template": "你是测试系统。",
            "user_template": "仅输出 {subject_name} 的测试题。",
        },
    )

    assert messages == [
        {"role": "system", "content": "你是测试系统。"},
        {"role": "user", "content": "仅输出 Python 的测试题。"},
    ]


def test_registry_renders_llm_service_role_prompt():
    registry = PromptRegistry()

    messages = registry.render_messages(
        "llm_service.role_explainer",
        {
            "ability_tags": "函数=40",
            "knowledge_node": "列表推导式",
            "recent_errors": "把列表和生成器混淆",
        },
    )

    assert len(messages) == 1
    assert messages[0]["role"] == "user"
    assert "苏格拉底式的引导教学" in messages[0]["content"]
    assert "列表推导式" in messages[0]["content"]


def test_registry_renders_ai_scoring_messages():
    registry = PromptRegistry()

    messages = registry.render_messages(
        "ai_scoring.score_answer",
        {
            "question_type": "essay",
            "question": "解释 Python 中列表与元组的区别。",
            "rubric": "说明可变性、语法、适用场景",
            "answer": "列表可变，元组不可变。",
        },
    )

    assert messages[0]["role"] == "system"
    assert "只能输出 JSON" in messages[0]["content"]
    assert messages[1]["role"] == "user"
    assert "列表与元组的区别" in messages[1]["content"]


def test_registry_renders_concept_learning_map_messages():
    registry = PromptRegistry()

    messages = registry.render_messages(
        "concept_learning.generate_map",
        {
            "subject": "Python",
            "task_title": "理解生成器",
            "description": "掌握生成器的核心概念与使用场景",
            "resources_text": "官方文档、课程笔记",
            "duration_minutes": 25,
        },
    )

    assert messages[0]["role"] == "system"
    assert "concept map" in messages[0]["content"].lower()
    assert "不要把“代码示例”当作所有学科 concept map 的默认节点形式" in messages[0]["content"]
    assert messages[1]["role"] == "user"
    assert "理解生成器" in messages[1]["content"]
    assert "resources_text" not in messages[1]["content"]


def test_registry_renders_concept_learning_article_messages_with_pyodide_constraints():
    registry = PromptRegistry()

    messages = registry.render_messages(
        "concept_learning.generate_article",
        {
            "subject": "Python",
            "task_title": "理解字符串",
            "description": "掌握字符串的定义、转义与多行写法",
            "resources_text": "官方文档、课程笔记",
            "duration_minutes": 20,
            "concept_map_json": "{\"root\": \"字符串\"}",
            "markmap_markdown": "# 字符串\n## 定义",
        },
    )

    assert messages[0]["role"] == "system"
    assert "Pyodide" in messages[0]["content"]
    assert "```python" in messages[0]["content"]
    assert "input()" in messages[0]["content"]
    assert "绝不能把 Python 代码当成所有学科的默认教学载体" in messages[0]["content"]
    assert messages[1]["role"] == "user"
    assert "材料形态必须贴合" in messages[1]["content"]
    assert "理解字符串" in messages[1]["content"]


def test_registry_renders_concept_learning_article_dataset_examples_without_template_fields():
    registry = PromptRegistry()

    messages = registry.render_messages(
        "concept_learning.generate_article",
        {
            "subject": "机器学习",
            "task_title": "理解示例数据集",
            "description": "掌握沙箱内置数据集的加载和验证方式",
            "resources_text": "课程讲义",
            "duration_minutes": 20,
            "concept_map_json": "{\"root\": \"示例数据集\"}",
            "markmap_markdown": "# 示例数据集\n## 数据加载",
        },
    )

    system_prompt = messages[0]["content"]

    assert "from sandbox_datasets import load_iris, make_classification" in system_prompt
    assert 'print("Iris:", X.shape[0]' in system_prompt
    assert "round(model.score(X_test, y_test), 2)" in system_prompt
    assert 'print(f"Iris:' not in system_prompt
    assert 'print(f"准确率:' not in system_prompt
    assert "X.shape[0]" not in registry.get_required_variables("concept_learning.generate_article")
    assert "model.score(X_test, y_test)" not in registry.get_required_variables("concept_learning.generate_article")


def test_registry_renders_concept_learning_article_messages_with_subject_adaptive_guidance():
    registry = PromptRegistry()

    messages = registry.render_messages(
        "concept_learning.generate_article",
        {
            "subject": "机器学习",
            "task_title": "理解逻辑回归",
            "description": "掌握逻辑回归的核心思想与适用场景",
            "resources_text": "scikit-learn 文档、课程讲义",
            "duration_minutes": 25,
            "concept_map_json": "{\"root\": \"逻辑回归\"}",
            "markmap_markdown": "# 逻辑回归\n## 分类边界",
        },
    )

    assert "如果学科是 机器学习" in messages[0]["content"]
    assert "scikit-learn 风格伪代码" in messages[0]["content"]
    assert "材料形态必须贴合「机器学习」学科" in messages[1]["content"]


def test_registry_renders_concept_learning_exercise_messages_with_subject_adaptive_guidance():
    registry = PromptRegistry()

    messages = registry.render_messages(
        "concept_learning.exercise_generate",
        {
            "subject": "机器学习",
            "task_title": "理解逻辑回归",
            "description": "掌握逻辑回归的核心思想与适用场景",
            "concept_map_json": "{\"root\": \"逻辑回归\"}",
            "article_content": "逻辑回归通过 sigmoid 输出概率。",
        },
    )

    assert "题型必须贴合学科" in messages[0]["content"]
    assert "不要对所有学科一律要求 coding" in messages[0]["content"]
    assert '[{"label": "A", "text": "独立的选项文本"}]' in messages[0]["content"]
    assert "不要默认按编程题思路出题" in messages[1]["content"]


def test_registry_renders_question_bank_generate_messages_with_subject_adaptive_guidance():
    registry = PromptRegistry()

    messages = registry.render_messages(
        "question_bank.generate",
        {
            "subject_name": "机器学习",
            "count": 2,
            "difficulty_desc": "中等",
            "difficulty": 3,
            "type_prompt": "请生成应用分析题。",
            "topic_clause": "，主题为“逻辑回归”",
            "topic_requirement": "",
        },
    )

    assert "不要默认把编程题当作所有学科的标准题型" in messages[0]["content"]
    assert "只有当该学科确实适合时才生成 coding / 编程类题目" in messages[1]["content"]
    assert "机器学习" in messages[1]["content"]
