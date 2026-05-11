from app.services.ai_learning_path_defaults import (
    build_default_task_payload,
    build_subject_tree_prompt_context,
)
from app.services.ai_learning_path_service import SUBJECT_CONFIGS


def test_machine_learning_subject_config_exposes_subject_specific_task_examples():
    config = SUBJECT_CONFIGS["machine_learning"]

    assert "- concept:" in config.task_examples
    assert "- exercise:" in config.task_examples
    assert "- review:" in config.task_examples
    assert "- project:" in config.task_examples
    assert "监督学习" in config.task_examples
    assert "scikit-learn" in config.task_examples
    assert "Python" not in config.task_examples


def test_build_default_task_payload_for_machine_learning_uses_ml_specific_wording():
    concept_task = build_default_task_payload(
        subject_key="machine_learning",
        subject_name="机器学习",
        theme_name="经典监督学习",
        subtopic="逻辑回归",
        task_type="concept",
    )
    exercise_task = build_default_task_payload(
        subject_key="machine_learning",
        subject_name="机器学习",
        theme_name="经典监督学习",
        subtopic="逻辑回归",
        task_type="exercise",
    )
    review_task = build_default_task_payload(
        subject_key="machine_learning",
        subject_name="机器学习",
        theme_name="经典监督学习",
        subtopic="逻辑回归",
        task_type="review",
    )

    assert concept_task["title"] == "理解逻辑回归的核心概念"
    assert "适用场景" in concept_task["description"]
    assert "Python" not in concept_task["description"]
    assert "scikit-learn 官方文档" in concept_task["resources"]

    assert exercise_task["title"] == "练习逻辑回归建模与结果分析"
    assert "训练" in exercise_task["description"]
    assert any("混淆矩阵" in resource for resource in exercise_task["resources"])

    assert review_task["title"] == "复盘逻辑回归与常见误区"
    assert "正则化" in review_task["description"]
    assert any("复盘清单" in resource for resource in review_task["resources"])


def test_build_subject_tree_prompt_context_for_machine_learning_uses_tree_labels():
    context = build_subject_tree_prompt_context(
        subject_key="machine_learning",
        target_node_ids=["machine_learning.supervised.classification.logistic"],
        known_node_ids=["machine_learning.foundations.problem-types.supervised"],
        avoid_node_ids=["machine_learning.deep-learning.frameworks.transformer"],
    )

    assert "机器学习基础认知" in context
    assert "经典监督学习" in context
    assert "逻辑回归" in context
    assert "监督学习" in context
    assert "Transformer 概念" in context
    assert "主题命名尽量贴近路线树节点标签" in context
