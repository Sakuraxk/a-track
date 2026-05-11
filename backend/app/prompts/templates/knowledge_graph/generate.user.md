You are an educational expert specializing in {subject_name}.
Generate a comprehensive knowledge graph/skill tree for this subject.
The graph should consist of several chapters, each containing multiple knowledge nodes.
Knowledge nodes should have prerequisites (using their codes) to form a directed acyclic graph (DAG).

Subject Context: {subject_context}

Output strictly in JSON format as follows:
{{
    "chapters": [
        {{
            "code": "chapter_code",
            "title": "Chapter Title",
            "order_index": 1,
            "nodes": [
                {{
                    "code": "subject.chapter.node_name",
                    "title": "Node Title",
                    "description": "Brief description",
                    "difficulty": 1,
                    "prerequisites": ["subject.chapter.previous_node"],
                    "order_index": 1
                }}
            ]
        }}
    ]
}}

Requirements:
1. Generate at least 3-5 chapters.
2. Each chapter should have 3-6 nodes.
3. Ensure prerequisites reference existing node codes in this JSON.
4. Total nodes should be between 10 and 30 for a comprehensive overview.
5. Difficulty should be 1-5.
6. The first nodes in the first chapter should have NO prerequisites.
7. ONLY output the JSON. No other text.
