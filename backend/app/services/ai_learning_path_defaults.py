from app.services.learning_path_map_seed import DEFAULT_SUBJECT_SKILL_MAPS


def _find_node_by_id(node: dict, node_id: str) -> dict | None:
    if node.get("id") == node_id:
        return node
    for child in node.get("children", []):
        found = _find_node_by_id(child, node_id)
        if found:
            return found
    return None


def build_subject_tree_prompt_context(
    *,
    subject_key: str,
    target_node_ids: list[str] | None = None,
    known_node_ids: list[str] | None = None,
    avoid_node_ids: list[str] | None = None,
) -> str:
    tree = DEFAULT_SUBJECT_SKILL_MAPS.get(subject_key)
    if not tree:
        return "暂无额外路线树约束。"

    lines = [
        f"- 路线树主题：{tree.get('label', subject_key)}",
        "- 顶层学习主线：" + " -> ".join(child.get("label", child.get("id", "")) for child in tree.get("children", [])[:8]),
    ]

    for child in tree.get("children", [])[:8]:
        grandchild_labels = [grandchild.get("label", grandchild.get("id", "")) for grandchild in child.get("children", [])[:4]]
        if grandchild_labels:
            lines.append(f"- {child.get('label')}: {', '.join(grandchild_labels)}")

    def _labels_for(node_ids: list[str] | None) -> list[str]:
        labels: list[str] = []
        for node_id in node_ids or []:
            node = _find_node_by_id(tree, node_id)
            labels.append(node.get("label", node_id) if node else node_id)
        return labels

    target_labels = _labels_for(target_node_ids)
    known_labels = _labels_for(known_node_ids)
    avoid_labels = _labels_for(avoid_node_ids)

    if target_labels:
        lines.append("- 当前优先目标节点：" + "、".join(target_labels))
    if known_labels:
        lines.append("- 已掌握节点：" + "、".join(known_labels))
    if avoid_labels:
        lines.append("- 暂不展开节点：" + "、".join(avoid_labels))

    lines.append("- 生成计划时，优先沿着上述主线推进，主题命名尽量贴近路线树节点标签，不要跳出该学科路线树。")
    return "\n".join(lines)


def build_default_task_payload(
    *,
    subject_key: str,
    subject_name: str,
    theme_name: str,
    subtopic: str,
    task_type: str,
) -> dict:
    if subject_key == "machine_learning":
        resources_by_type = {
            "concept": ["scikit-learn 官方文档", f"{theme_name} 概念笔记"],
            "exercise": ["scikit-learn 官方文档", "混淆矩阵 / 指标计算练习"],
            "review": [f"{subtopic} 复盘清单", "常见误区对照表"],
            "project": ["实验记录模板", "结果汇报模板"],
        }
        descriptions_by_type = {
            "concept": f"围绕{theme_name}理解{subtopic}的核心概念、适用场景和常见边界。",
            "exercise": f"基于一个小型数据集练习{subtopic}的训练、预测与结果分析。",
            "review": f"复盘{subtopic}与过拟合、正则化、评估指标之间的关系和常见误区。",
            "project": f"结合{theme_name}完成一个包含数据准备、建模与结论汇报的小实验。",
        }
        titles_by_type = {
            "concept": f"理解{subtopic}的核心概念",
            "exercise": f"练习{subtopic}建模与结果分析",
            "review": f"复盘{subtopic}与常见误区",
            "project": f"完成{subtopic}小实验",
        }
        return {
            "title": titles_by_type.get(task_type, f"学习{subtopic}"),
            "description": descriptions_by_type.get(task_type, f"围绕{theme_name}学习{subtopic}。"),
            "resources": resources_by_type.get(task_type, ["scikit-learn 官方文档"]),
        }



    generic_titles = {
        "concept": subtopic,
        "exercise": f"{subtopic}练习",
        "review": f"{subtopic}复盘",
        "project": f"{subtopic}综合应用",
    }
    generic_descriptions = {
        "concept": f"学习{theme_name}中的{subtopic}",
        "exercise": f"围绕{theme_name}练习{subtopic}并完成基础输出。",
        "review": f"复盘{theme_name}中的{subtopic}与关键要点。",
        "project": f"结合{theme_name}完成一个关于{subtopic}的综合应用任务。",
    }
    return {
        "title": generic_titles.get(task_type, subtopic),
        "description": generic_descriptions.get(task_type, f"学习{theme_name}中的{subtopic}"),
        "resources": [f"参考{subject_name}相关文档"],
    }
