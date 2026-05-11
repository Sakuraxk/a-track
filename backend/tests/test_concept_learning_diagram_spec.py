from app.routers.concept_learning import export_concept_map_to_markmap


def test_export_concept_map_to_markmap_includes_hierarchy_and_relations():
    concept_map = {
        "root": "生成器",
        "chapter_order": ["intro", "yield", "compare"],
        "nodes": [
            {
                "id": "intro",
                "title": "生成器是什么",
                "summary": "按需产出值的可迭代对象",
                "examples": ["使用圆括号推导式"],
                "pitfalls": ["误以为会一次性生成全部结果"],
                "prerequisites": [],
                "section_level": 2,
            },
            {
                "id": "yield",
                "title": "yield 的执行模型",
                "summary": "函数会在 yield 处暂停和恢复",
                "examples": ["逐个返回文件行"],
                "pitfalls": ["把 return 和 yield 混用"],
                "prerequisites": ["intro"],
                "section_level": 2,
            },
        ],
        "edges": [
            {"source": "intro", "target": "yield", "relation_type": "prerequisite", "label": "先理解再深入"},
            {"source": "intro", "target": "yield", "relation_type": "contrast", "label": "与列表推导式对比"},
        ],
    }

    markdown = export_concept_map_to_markmap(concept_map)

    assert markdown.startswith("# 生成器")
    # Titles should appear as ## headings
    assert "## 生成器是什么" in markdown
    assert "## yield 的执行模型" in markdown
    # Brief summaries appear as ### headings
    assert "### 按需产出值的可迭代对象" in markdown
    assert "### 函数会在 yield 处暂停和恢复" in markdown


def test_export_concept_map_id_like_root_uses_task_title():
    """When root is an ID like 'function_limit_definition', task_title should be used."""
    concept_map = {
        "root": "function_limit_definition",
        "chapter_order": ["ch1"],
        "nodes": [
            {"id": "ch1", "title": "极限定义", "summary": "当$x$趋近于$a$时的行为"},
        ],
    }

    markdown = export_concept_map_to_markmap(concept_map, task_title="函数极限定义")

    # Root should use task_title, not the raw ID
    assert markdown.startswith("# 函数极限定义")
    assert "function_limit_definition" not in markdown
    # LaTeX should be stripped from summary
    assert "$" not in markdown
    # Title should be present
    assert "## 极限定义" in markdown


def test_export_concept_map_strips_latex_cleanly():
    """Verify LaTeX is stripped without leaving artifacts."""
    concept_map = {
        "root": "高等数学",
        "nodes": [
            {
                "id": "ch1",
                "title": "$\\varepsilon$-$\\delta$精确定义",
                "summary": "对任意$\\varepsilon > 0$，存在$\\delta > 0$使得当$|x - a| < \\delta$时有$|f(x) - L| < \\varepsilon$",
            },
        ],
    }

    markdown = export_concept_map_to_markmap(concept_map)

    assert "$" not in markdown
    assert "\\" not in markdown
    # Should not have empty parentheses or excessive whitespace
    assert "()" not in markdown
    assert "  " not in markdown
