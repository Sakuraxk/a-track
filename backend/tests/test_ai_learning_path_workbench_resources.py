"""
Tests for AI learning path workbench resource skeletons.
"""
import pytest
from httpx import AsyncClient
from types import SimpleNamespace
from uuid import UUID, uuid4

from app.models.learning_path import UserLearningPath
from app.models.learning_path_workbench import LearningPathGenerationContext, SubjectSkillMap
from app.schemas.reporting import LearningStatsResponse
from app.services.ai_learning_path_service import AILearningPathService, LearningPath
from app.services.stats_service import StatsService


class TestAILearningPathWorkbenchResources:
    """Tests for the new workbench resource endpoints."""

    @staticmethod
    def _count_tree_nodes(node: dict) -> int:
        return 1 + sum(TestAILearningPathWorkbenchResources._count_tree_nodes(child) for child in node.get("children", []))

    async def _start_session(self, client: AsyncClient, test_user_id: str) -> str:
        response = await client.post(
            f"/api/ai-learning-path/session/start?user_id={test_user_id}",
            json={"subject_key": "python"},
        )
        assert response.status_code == 200
        return response.json()["session_id"]

    async def _reply(self, client: AsyncClient, session_id: str, content: str) -> dict:
        response = await client.post(
            f"/api/ai-learning-path/session/{session_id}/reply",
            json={"content": content},
        )
        assert response.status_code == 200
        return response.json()

    async def _save_snapshot(self, client: AsyncClient, session_id: str, notes: str = "每天 45 分钟，偏向后端自动化。") -> None:
        response = await client.put(
            f"/api/ai-learning-path/session/{session_id}/preference-snapshot",
            json={
                "known_node_ids": ["python.syntax.variables"],
                "target_node_ids": ["python.asyncio.basics", "python.testing.pytest"],
                "avoid_node_ids": ["python.desktop.gui"],
                "free_text_notes": notes,
            },
        )
        assert response.status_code == 200

    async def _drive_session_into_open_supplement_mode(
        self,
        client: AsyncClient,
        session_id: str,
    ) -> dict:
        for content in [
            "学习目标是用 Python 做自动化脚本和后端工具。",
            "我目前会基础语法，但异步、测试和工程化经验不够。",
            "重点想学 asyncio、pytest 和项目结构设计。",
            "我每天大概能投入 45 分钟，工作日晚间学习。",
            "这些方向没问题，可以按这个理解继续规划。",
        ]:
            payload = await self._reply(client, session_id, content)

        return payload

    @staticmethod
    def _parse_sse_payloads(raw_text: str) -> list[dict]:
        payloads: list[dict] = []
        for block in raw_text.split("\n\n"):
            block = block.strip()
            if not block.startswith("data: "):
                continue
            payloads.append(__import__("json").loads(block[6:]))
        return payloads

    @pytest.mark.asyncio
    async def test_get_active_learning_path_map_returns_subject_tree(self, client: AsyncClient):
        """The active subject map should be readable from the backend source of truth."""
        response = await client.get("/api/learning-path-map/python")

        assert response.status_code == 200
        payload = response.json()
        assert payload["subject_key"] == "python"
        assert payload["is_active"] is True
        assert payload["version"] >= 1
        assert payload["tree"]["id"] == "python"
        assert payload["tree"]["label"]
        assert isinstance(payload["tree"]["children"], list)

    @pytest.mark.asyncio
    async def test_get_active_learning_path_map_returns_richer_python_growth_tree(self, client: AsyncClient):
        """The rewritten python tree should expose a richer growth-oriented structure."""
        response = await client.get("/api/learning-path-map/python")

        assert response.status_code == 200
        payload = response.json()
        top_labels = [child["label"] for child in payload["tree"]["children"]]
        assert top_labels == [
            "编程入门",
            "Python 核心能力",
            "工程与调试",
            "自动化与脚本",
            "数据处理与分析",
            "Web 与服务端基础",
            "进阶能力",
            "综合实战",
        ]
        assert self._count_tree_nodes(payload["tree"]) >= 90
        assert any(grandchild["children"] for child in payload["tree"]["children"] for grandchild in child["children"])

    @pytest.mark.asyncio
    async def test_get_active_learning_path_map_upgrades_old_python_seed_record(
        self,
        client: AsyncClient,
        test_session,
    ):
        """Existing active python tree records should auto-upgrade to the newer embedded seed version."""
        legacy_tree = {
            "id": "python",
            "label": "Python 学习路线",
            "description": "legacy",
            "tags": ["python"],
            "children": [
                {
                    "id": "python.syntax",
                    "label": "语法基础",
                    "description": "legacy",
                    "tags": ["foundation"],
                    "children": [],
                }
            ],
        }
        test_session.add(
            SubjectSkillMap(
                subject_key="python",
                version=1,
                tree_json=legacy_tree,
                is_active=True,
            )
        )
        await test_session.commit()

        response = await client.get("/api/learning-path-map/python")

        assert response.status_code == 200
        payload = response.json()
        top_labels = [child["label"] for child in payload["tree"]["children"]]
        assert "编程入门" in top_labels
        active_rows = (
            await test_session.execute(
                SubjectSkillMap.__table__.select().where(SubjectSkillMap.subject_key == "python")
            )
        ).all()
        assert len(active_rows) == 2
        active_versions = [row.version for row in active_rows if row.is_active]
        assert active_versions == [2]

    @pytest.mark.asyncio
    async def test_expand_learning_path_node_rejects_non_target_nodes(
        self,
        client: AsyncClient,
        test_user_id: str,
    ):
        """Only nodes marked as target should be eligible for infinite expansion."""
        session_id = await self._start_session(client, test_user_id)

        response = await client.post(
            f"/api/ai-learning-path/session/{session_id}/expand-node",
            json={"node_id": "python.syntax.variables"},
        )

        assert response.status_code == 400
        assert "想学习" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_expand_learning_path_node_persists_user_specific_children_and_merges_tree(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Expanded nodes should be stored per-user and merged into the returned learning-path tree."""
        session_id = await self._start_session(client, test_user_id)
        await self._save_snapshot(client, session_id)

        async def _fake_generate_skill_node_expansion(
            self,
            *,
            session_id: str,
            user_id: str,
            subject_key: str,
            parent_node_id: str,
            existing_child_ids: list[str],
            mode: str = "curriculum",
        ) -> list[dict]:
            assert parent_node_id == "python.testing.pytest"
            return [
                {
                    "slug": "fixture-lifecycle",
                    "label": "fixture 生命周期",
                    "description": "理解 fixture 作用域、初始化与释放顺序。",
                    "tags": ["testing", "pytest", "fixture"],
                },
                {
                    "slug": "parametrize-patterns",
                    "label": "参数化测试模式",
                    "description": "掌握 pytest 参数化测试的常见组织方式。",
                    "tags": ["testing", "pytest", "parametrize"],
                },
            ]

        monkeypatch.setattr(
            AILearningPathService,
            "_generate_skill_node_expansion",
            _fake_generate_skill_node_expansion,
            raising=False,
        )

        expand_response = await client.post(
            f"/api/ai-learning-path/session/{session_id}/expand-node",
            json={"node_id": "python.testing.pytest"},
        )

        assert expand_response.status_code == 200
        expand_payload = expand_response.json()
        assert expand_payload["expanded_parent_id"] == "python.testing.pytest"
        assert expand_payload["new_node_ids"] == [
            "python.testing.pytest.fixture-lifecycle",
            "python.testing.pytest.parametrize-patterns",
        ]

        map_response = await client.get(
            f"/api/learning-path-map/python",
            params={"user_id": test_user_id},
        )
        assert map_response.status_code == 200
        tree = map_response.json()["tree"]

        def _find(node: dict, target_id: str) -> dict | None:
            if node["id"] == target_id:
                return node
            for child in node.get("children", []):
                found = _find(child, target_id)
                if found:
                    return found
            return None

        pytest_node = _find(tree, "python.testing.pytest")
        assert pytest_node is not None
        assert [child["id"] for child in pytest_node["children"]] == [
            "python.testing.pytest.fixture-lifecycle",
            "python.testing.pytest.parametrize-patterns",
        ]

    @pytest.mark.asyncio
    async def test_expand_learning_path_node_passes_expansion_mode_into_llm_prompt(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Expansion mode should be injected into the LLM prompt so curriculum/practical branching can differ."""
        captured_messages: dict[str, list[dict]] = {}
        session_id = await self._start_session(client, test_user_id)
        await self._save_snapshot(client, session_id)

        async def _fake_get_llm_service(self, user_id: str):
            return SimpleNamespace(
                api_base_url="https://example.com/v1",
                api_key="fake-key",
                model_name="fake-model",
                timeout=30,
                max_tokens=512,
            )

        class _FakeAsyncOpenAI:
            def __init__(self, *args, **kwargs):
                async def _create(**kwargs):
                    captured_messages["messages"] = kwargs["messages"]
                    return SimpleNamespace(
                        choices=[
                            SimpleNamespace(
                                message=SimpleNamespace(
                                    content='{"nodes":[{"slug":"fixture-lifecycle","label":"fixture 生命周期","description":"理解 fixture 作用域","tags":["testing","pytest"]}]}'
                                )
                            )
                        ]
                    )

                self.chat = SimpleNamespace(completions=SimpleNamespace(create=_create))

            async def close(self):
                return None

        monkeypatch.setattr(AILearningPathService, "_get_llm_service", _fake_get_llm_service)
        monkeypatch.setattr("app.services.clarification_service.AsyncOpenAI", _FakeAsyncOpenAI)

        response = await client.post(
            f"/api/ai-learning-path/session/{session_id}/expand-node",
            json={"node_id": "python.testing.pytest", "mode": "practical"},
        )

        assert response.status_code == 200
        prompt_content = captured_messages["messages"][-1]["content"]
        assert "practical" in prompt_content
        assert "偏实战化发散" in prompt_content

    @pytest.mark.asyncio
    async def test_get_active_learning_path_map_returns_seeded_machine_learning_tree(
        self,
        client: AsyncClient,
    ):
        """Seed data should support more than the default python subject."""
        response = await client.get("/api/learning-path-map/machine_learning")

        assert response.status_code == 200
        payload = response.json()
        assert payload["subject_key"] == "machine_learning"
        assert payload["is_active"] is True
        assert payload["tree"]["id"] == "machine_learning"

    @pytest.mark.asyncio
    async def test_get_active_learning_path_map_returns_richer_machine_learning_tree(self, client: AsyncClient):
        """Machine learning should expose a real growth tree rather than a placeholder skeleton."""
        response = await client.get("/api/learning-path-map/machine_learning")

        assert response.status_code == 200
        payload = response.json()
        top_labels = [child["label"] for child in payload["tree"]["children"]]
        assert top_labels == [
            "机器学习基础认知",
            "数学与数据准备",
            "经典监督学习",
            "树模型与集成方法",
            "无监督学习",
            "评估、调参与实验",
            "深度学习入门",
            "项目与部署实践",
        ]
        assert self._count_tree_nodes(payload["tree"]) >= 100
        assert any(grandchild["children"] for child in payload["tree"]["children"] for grandchild in child["children"])

    @pytest.mark.asyncio
    async def test_get_active_learning_path_map_upgrades_old_machine_learning_seed_record(
        self,
        client: AsyncClient,
        test_session,
    ):
        """Existing active machine learning tree records should auto-upgrade to the newer embedded seed version."""
        legacy_tree = {
            "id": "machine_learning",
            "label": "机器学习学习路线",
            "description": "legacy",
            "tags": ["ml"],
            "children": [
                {
                    "id": "machine_learning.foundations",
                    "label": "机器学习基础",
                    "description": "legacy",
                    "tags": ["foundation"],
                    "children": [],
                }
            ],
        }
        test_session.add(
            SubjectSkillMap(
                subject_key="machine_learning",
                version=1,
                tree_json=legacy_tree,
                is_active=True,
            )
        )
        await test_session.commit()

        response = await client.get("/api/learning-path-map/machine_learning")

        assert response.status_code == 200
        payload = response.json()
        top_labels = [child["label"] for child in payload["tree"]["children"]]
        assert "项目与部署实践" in top_labels
        active_rows = (
            await test_session.execute(
                SubjectSkillMap.__table__.select().where(SubjectSkillMap.subject_key == "machine_learning")
            )
        ).all()
        assert len(active_rows) == 2
        active_versions = [row.version for row in active_rows if row.is_active]
        assert active_versions == [2]
        assert payload["tree"]["label"]
        assert isinstance(payload["tree"]["children"], list)
        assert payload["tree"]["children"]

    @pytest.mark.asyncio
    async def test_get_active_learning_path_map_returns_404_for_unknown_subject(
        self,
        client: AsyncClient,
    ):
        """Unknown subjects should return a clear not-found response."""
        response = await client.get("/api/learning-path-map/unknown_subject")

        assert response.status_code == 404
        assert response.json()["detail"] == "未找到学科技术树"

    @pytest.mark.asyncio
    async def test_start_clarification_session_returns_first_ai_question(
        self,
        client: AsyncClient,
        test_user_id: str,
    ):
        """Starting a clarification session should create the session and first AI turn."""
        response = await client.post(
            f"/api/ai-learning-path/session/start?user_id={test_user_id}",
            json={"subject_key": "python"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["user_id"] == test_user_id
        assert payload["subject_key"] == "python"
        assert payload["status"] == "awaiting_user"
        assert payload["current_turn_index"] == 1
        assert payload["messages"][0]["role"] == "assistant"
        assert payload["messages"][0]["message_type"] == "question"
        assert payload["messages"][0]["content"]

    @pytest.mark.asyncio
    async def test_start_clarification_session_uses_llm_generated_question_when_available(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """The opening question should come from the LLM orchestration when available."""
        async def _fake_generate_clarification_turn(
            self,
            *,
            user_id: str,
            subject_key: str,
            turn_index: int,
            recent_messages: list[dict],
            missing_items: list[str],
            ready_summary: str,
            fallback_question: str,
            fallback_quick_options: list[str],
            snapshot_notes: str,
        ) -> dict:
            assert user_id == test_user_id
            assert subject_key == "python"
            assert turn_index == 1
            assert recent_messages == []
            assert "goal" in missing_items
            assert fallback_question
            return {
                "question": "LLM 首问：你最希望优先解决哪些真实 Python 场景问题？",
                "quick_options": ["自动化脚本", "异步编程", "测试工程化"],
            }

        monkeypatch.setattr(
            "app.services.clarification_service.ClarificationService._generate_clarification_turn",
            _fake_generate_clarification_turn,
        )

        response = await client.post(
            f"/api/ai-learning-path/session/start?user_id={test_user_id}",
            json={"subject_key": "python"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["messages"][0]["content"] == "LLM 首问：你最希望优先解决哪些真实 Python 场景问题？"
        assert payload["messages"][0]["structured_payload"]["quick_options"] == [
            "自动化脚本",
            "异步编程",
            "测试工程化",
        ]

    @pytest.mark.asyncio
    async def test_start_clarification_session_includes_stats_context_in_llm_prompt(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Clarification LLM prompts should include learning stats and ability context."""
        captured_messages: dict[str, list[dict]] = {}

        async def _fake_get_llm_service(self, user_id: str):
            assert user_id == test_user_id
            return SimpleNamespace(
                api_base_url="https://example.com/v1",
                api_key="fake-key",
                model_name="fake-model",
                timeout=30,
                max_tokens=512,
            )

        async def _fake_get_user_stats(self, user_id: str, subject_id: str | None = None):
            assert user_id == test_user_id
            return LearningStatsResponse(
                total_exercises=50,
                completed_exercises=12,
                accuracy_rate=0.78,
                total_study_minutes=135,
                streak_days=4,
                weekly_activity=[0, 10, 15, 20, 30, 25, 35],
            )

        async def _fake_get_ability_data(self, user_id: str, subject_id: str | None = None):
            assert user_id == test_user_id
            return {
                "函数": 35,
                "循环": 55,
                "基础语法": 72,
            }

        class _FakeAsyncOpenAI:
            def __init__(self, *args, **kwargs):
                async def _create(**kwargs):
                    captured_messages["messages"] = kwargs["messages"]
                    return SimpleNamespace(
                        choices=[
                            SimpleNamespace(
                                message=SimpleNamespace(
                                    content='{"question":"结合你最近的学习表现，你最想先补哪一块？","quick_options":["函数","循环","自动化"]}'
                                )
                            )
                        ]
                    )

                self.chat = SimpleNamespace(completions=SimpleNamespace(create=_create))

            async def close(self):
                return None

        monkeypatch.setattr(AILearningPathService, "_get_llm_service", _fake_get_llm_service)
        monkeypatch.setattr(StatsService, "get_user_stats", _fake_get_user_stats)
        monkeypatch.setattr(StatsService, "get_ability_data", _fake_get_ability_data)
        monkeypatch.setattr("app.services.clarification_service.AsyncOpenAI", _FakeAsyncOpenAI)

        response = await client.post(
            f"/api/ai-learning-path/session/start?user_id={test_user_id}",
            json={"subject_key": "python"},
        )

        assert response.status_code == 200
        assert response.json()["messages"][0]["content"] == "结合你最近的学习表现，你最想先补哪一块？"
        prompt_content = captured_messages["messages"][-1]["content"]
        assert "已完成题目: 12/50" in prompt_content
        assert "平均正确率: 78%" in prompt_content
        assert "连续学习: 4 天" in prompt_content
        assert "函数: 35/100" in prompt_content
        assert "循环: 55/100" in prompt_content

    @pytest.mark.asyncio
    async def test_open_supplement_prompt_includes_latest_reply_and_anti_repeat_instruction(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Open supplement prompts should include the latest user reply and explicit anti-repeat guidance."""
        captured_messages: dict[str, list[dict]] = {}
        session_id = await self._start_session(client, test_user_id)
        await self._drive_session_into_open_supplement_mode(client, session_id)

        async def _fake_get_llm_service(self, user_id: str):
            async def _raw_completion(messages, **kwargs):
                captured_messages["messages"] = messages
                return (
                    '{"question":"收到，你更想先拆脚本结构还是先补日志分析？","quick_options":["先拆脚本结构","先补日志分析","一起推进"]}',
                    None,
                )

            return SimpleNamespace(
                timeout=30,
                max_tokens=512,
                raw_completion=_raw_completion,
            )

        monkeypatch.setattr(AILearningPathService, "_get_llm_service", _fake_get_llm_service)

        response = await client.post(
            f"/api/ai-learning-path/session/{session_id}/reply",
            json={"content": "补充：我更想围绕真实脚本拆解和日志分析推进。"},
        )

        assert response.status_code == 200
        prompt_content = captured_messages["messages"][-1]["content"]
        assert "补充：我更想围绕真实脚本拆解和日志分析推进。" in prompt_content
        assert "上一轮 assistant 问题" in prompt_content
        assert "禁止重复上一轮 assistant 问题" in prompt_content or "禁止再次直接追问" in prompt_content

    @pytest.mark.asyncio
    async def test_start_clarification_session_stream_emits_content_and_persists_message(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """The streaming start endpoint should emit SSE chunks and persist the final assistant question."""
        async def _fake_stream_generate_clarification_turn(
            self,
            *,
            user_id: str,
            subject_key: str,
            turn_index: int,
            recent_messages: list[dict],
            missing_items: list[str],
            ready_summary: str,
            fallback_question: str,
            fallback_quick_options: list[str],
            snapshot_notes: str,
        ):
            yield {"type": "content", "content": "请先"}
            yield {"type": "content", "content": "说说你最近最常做的 Python 任务。"}
            yield {
                "type": "options",
                "quick_options": ["自动化脚本", "数据处理", "测试补强"],
            }
            yield {
                "type": "done",
                "question": "请先说说你最近最常做的 Python 任务。",
                "quick_options": ["自动化脚本", "数据处理", "测试补强"],
                "source": "llm",
            }

        monkeypatch.setattr(
            "app.services.clarification_service.ClarificationService._stream_generate_clarification_turn",
            _fake_stream_generate_clarification_turn,
        )

        async with client.stream(
            "POST",
            f"/api/ai-learning-path/session/start/stream?user_id={test_user_id}",
            json={"subject_key": "python"},
        ) as response:
            assert response.status_code == 200
            raw_text = await response.aread()

        events = self._parse_sse_payloads(raw_text.decode("utf-8"))
        assert events[0]["type"] == "start"
        assert events[1] == {"type": "content", "content": "请先"}
        assert events[2]["content"] == "说说你最近最常做的 Python 任务。"
        assert events[3] == {
            "type": "options",
            "quick_options": ["自动化脚本", "数据处理", "测试补强"],
        }
        assert events[-1]["type"] == "done"
        assert events[-1]["session"]["messages"][-1]["content"] == "请先说说你最近最常做的 Python 任务。"
        assert events[-1]["session"]["messages"][-1]["structured_payload"]["quick_options"] == [
            "自动化脚本",
            "数据处理",
            "测试补强",
        ]

        session_id = events[-1]["session"]["session_id"]
        session_response = await client.get(f"/api/ai-learning-path/session/{session_id}")
        assert session_response.status_code == 200
        persisted = session_response.json()
        assert persisted["messages"][-1]["content"] == "请先说说你最近最常做的 Python 任务。"

    @pytest.mark.asyncio
    async def test_reply_clarification_session_stream_returns_done_session_with_quick_options(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """The streaming reply endpoint should return the final session with quick options after done."""
        session_id = await self._start_session(client, test_user_id)

        async def _fake_stream_generate_clarification_turn(
            self,
            *,
            user_id: str,
            subject_key: str,
            turn_index: int,
            recent_messages: list[dict],
            missing_items: list[str],
            ready_summary: str,
            fallback_question: str,
            fallback_quick_options: list[str],
            snapshot_notes: str,
        ):
            assert recent_messages[-1]["content"] == "我想重点补强 pytest 和 asyncio。"
            yield {"type": "content", "content": "那我们"}
            yield {"type": "content", "content": "优先围绕 pytest 和 asyncio 细化。"}
            yield {
                "type": "options",
                "quick_options": ["先补 pytest", "先补 asyncio", "一起推进"],
            }
            yield {
                "type": "done",
                "question": "那我们优先围绕 pytest 和 asyncio 细化。",
                "quick_options": ["先补 pytest", "先补 asyncio", "一起推进"],
                "source": "llm",
            }

        monkeypatch.setattr(
            "app.services.clarification_service.ClarificationService._stream_generate_clarification_turn",
            _fake_stream_generate_clarification_turn,
        )

        async with client.stream(
            "POST",
            f"/api/ai-learning-path/session/{session_id}/reply/stream",
            json={"content": "我想重点补强 pytest 和 asyncio。"},
        ) as response:
            assert response.status_code == 200
            raw_text = await response.aread()

        events = self._parse_sse_payloads(raw_text.decode("utf-8"))
        assert events[0]["type"] == "start"
        assert events[1]["type"] == "content"
        assert events[3] == {
            "type": "options",
            "quick_options": ["先补 pytest", "先补 asyncio", "一起推进"],
        }
        assert events[-1]["type"] == "done"
        assert events[-1]["session"]["messages"][-1]["content"] == "那我们优先围绕 pytest 和 asyncio 细化。"
        assert events[-1]["session"]["messages"][-1]["structured_payload"]["quick_options"] == [
            "先补 pytest",
            "先补 asyncio",
            "一起推进",
        ]

    @pytest.mark.asyncio
    async def test_reply_clarification_session_stream_uses_llm_in_open_supplement_mode(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """After open supplement mode begins, streamed follow-ups should still come from the LLM."""
        session_id = await self._start_session(client, test_user_id)
        await self._drive_session_into_open_supplement_mode(client, session_id)

        async def _fake_stream_generate_clarification_turn(
            self,
            *,
            user_id: str,
            subject_key: str,
            turn_index: int,
            recent_messages: list[dict],
            missing_items: list[str],
            ready_summary: str,
            fallback_question: str,
            fallback_quick_options: list[str],
            snapshot_notes: str,
        ):
            assert recent_messages[-1]["content"] == "补充：也请多覆盖真实脚本排错与日志分析。"
            yield {"type": "content", "content": "收到补充。"}
            yield {"type": "content", "content": "接下来你更想先练排错还是先做日志分析？"}
            yield {
                "type": "done",
                "question": "收到补充。接下来你更想先练排错还是先做日志分析？",
                "quick_options": ["先练排错", "先做日志分析", "两者都要"],
                "source": "llm",
            }

        monkeypatch.setattr(
            AILearningPathService,
            "_stream_generate_clarification_turn",
            _fake_stream_generate_clarification_turn,
            raising=False,
        )

        async with client.stream(
            "POST",
            f"/api/ai-learning-path/session/{session_id}/reply/stream",
            json={"content": "补充：也请多覆盖真实脚本排错与日志分析。"},
        ) as response:
            assert response.status_code == 200
            raw_text = await response.aread()

        events = self._parse_sse_payloads(raw_text.decode("utf-8"))
        assert events[0]["type"] == "start"
        assert events[1]["content"] == "收到补充。"
        assert events[-1]["type"] == "done"
        assert events[-1]["session"]["messages"][-1]["message_type"] == "summary"
        assert events[-1]["session"]["messages"][-1]["structured_payload"]["mode"] == "open_supplement"
        assert events[-1]["session"]["messages"][-1]["content"] == "收到补充。接下来你更想先练排错还是先做日志分析？"
        assert events[-1]["session"]["messages"][-1]["structured_payload"]["quick_options"] == [
            "先练排错",
            "先做日志分析",
            "两者都要",
        ]

    @pytest.mark.asyncio
    async def test_get_clarification_session_returns_message_history(
        self,
        client: AsyncClient,
        test_user_id: str,
    ):
        """Session detail should return the stored assistant opening message."""
        start_response = await client.post(
            f"/api/ai-learning-path/session/start?user_id={test_user_id}",
            json={"subject_key": "python"},
        )
        assert start_response.status_code == 200
        session_id = start_response.json()["session_id"]

        response = await client.get(f"/api/ai-learning-path/session/{session_id}")

        assert response.status_code == 200
        payload = response.json()
        assert payload["session_id"] == session_id
        assert payload["status"] == "awaiting_user"
        assert len(payload["messages"]) == 1
        assert payload["messages"][0]["role"] == "assistant"

    @pytest.mark.asyncio
    async def test_reply_clarification_session_appends_user_and_assistant_messages(
        self,
        client: AsyncClient,
        test_user_id: str,
    ):
        """Replying to a session should append history and return the next AI turn."""
        start_response = await client.post(
            f"/api/ai-learning-path/session/start?user_id={test_user_id}",
            json={"subject_key": "python"},
        )
        assert start_response.status_code == 200
        session_id = start_response.json()["session_id"]

        response = await client.post(
            f"/api/ai-learning-path/session/{session_id}/reply",
            json={"content": "我想补强自动化脚本、异步编程，还想控制每天 45 分钟。"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["session_id"] == session_id
        assert payload["status"] == "awaiting_user"
        assert payload["current_turn_index"] == 2
        assert payload["messages"][-2]["role"] == "user"
        assert payload["messages"][-2]["message_type"] == "answer"
        assert payload["messages"][-1]["role"] == "assistant"
        assert payload["messages"][-1]["message_type"] == "question"
        assert payload["messages"][-1]["content"]

    @pytest.mark.asyncio
    async def test_time_budget_question_uses_time_related_quick_options(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """When asking about time budget, quick options should stay aligned with time/schedule instead of topic choices."""
        session_id = await self._start_session(client, test_user_id)

        async def _failing_generate_clarification_turn(
            self,
            *,
            user_id: str,
            subject_key: str,
            turn_index: int,
            recent_messages: list[dict],
            missing_items: list[str],
            ready_summary: str,
            fallback_question: str,
            fallback_quick_options: list[str],
            snapshot_notes: str,
        ) -> dict:
            raise RuntimeError("force fallback options")

        monkeypatch.setattr(
            "app.services.clarification_service.ClarificationService._generate_clarification_turn",
            _failing_generate_clarification_turn,
        )

        await self._reply(client, session_id, "目标是补强自动化脚本能力。")
        await self._reply(client, session_id, "我是初学者。")

        response = await client.post(
            f"/api/ai-learning-path/session/{session_id}/reply",
            json={"content": "重点想学 pytest、日志处理和真实脚本拆解。"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["current_turn_index"] == 4
        assert payload["messages"][-1]["message_type"] == "question"
        assert payload["messages"][-1]["content"]
        assert payload["messages"][-1]["structured_payload"]["quick_options"] == [
            "每天 45 分钟",
            "工作日晚间学习",
            "每周 5 小时",
        ]

    @pytest.mark.asyncio
    async def test_fallback_quick_options_stay_semantically_aligned_across_turns(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Fallback quick options should stay aligned with each turn's question intent."""
        session_id = await self._start_session(client, test_user_id)

        async def _failing_generate_clarification_turn(
            self,
            *,
            user_id: str,
            subject_key: str,
            turn_index: int,
            recent_messages: list[dict],
            missing_items: list[str],
            ready_summary: str,
            fallback_question: str,
            fallback_quick_options: list[str],
            snapshot_notes: str,
        ) -> dict:
            raise RuntimeError("force fallback options")

        monkeypatch.setattr(
            "app.services.clarification_service.ClarificationService._generate_clarification_turn",
            _failing_generate_clarification_turn,
        )

        start_response = await client.post(
            f"/api/ai-learning-path/session/start?user_id={test_user_id}",
            json={"subject_key": "python"},
        )
        start_payload = start_response.json()
        assert start_payload["messages"][-1]["structured_payload"]["quick_options"] == [
            "构建自动化工具",
            "补强异步编程",
            "建立 pytest 测试习惯",
        ]

        turn2 = await self._reply(client, start_payload["session_id"], "目标是补强自动化脚本能力。")
        assert turn2["messages"][-1]["structured_payload"]["quick_options"] == [
            "我先标记已掌握部分",
            "我先标记想重点学习",
            "我先标记暂不学习",
        ]

        turn3 = await self._reply(client, start_payload["session_id"], "我是初学者。")
        assert turn3["messages"][-1]["structured_payload"]["quick_options"] == [
            "我是初学者",
            "异步和测试经验偏弱",
            "更想走工程化路线",
        ]

        turn4 = await self._reply(client, start_payload["session_id"], "重点想学 pytest、日志处理和真实脚本拆解。")
        assert turn4["messages"][-1]["structured_payload"]["quick_options"] == [
            "每天 45 分钟",
            "工作日晚间学习",
            "每周 5 小时",
        ]

        turn5 = await self._reply(client, start_payload["session_id"], "我每天大概能投入 45 分钟。")
        assert turn5["messages"][-1]["structured_payload"]["quick_options"] == [
            "按这个方向生成",
            "我还想补充日志处理",
            "我还想加入真实脚本拆解",
        ]

    @pytest.mark.asyncio
    async def test_reply_clarification_session_falls_back_to_static_question_when_llm_unavailable(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """The follow-up question should fall back to the static template if LLM generation fails."""
        calls: list[dict] = []

        async def _failing_generate_clarification_turn(
            self,
            *,
            user_id: str,
            subject_key: str,
            turn_index: int,
            recent_messages: list[dict],
            missing_items: list[str],
            ready_summary: str,
            fallback_question: str,
            fallback_quick_options: list[str],
            snapshot_notes: str,
        ) -> dict:
            calls.append(
                {
                    "user_id": user_id,
                    "subject_key": subject_key,
                    "turn_index": turn_index,
                    "recent_messages": recent_messages,
                    "fallback_question": fallback_question,
                }
            )
            raise RuntimeError("llm unavailable")

        monkeypatch.setattr(
            "app.services.clarification_service.ClarificationService._generate_clarification_turn",
            _failing_generate_clarification_turn,
        )

        session_id = await self._start_session(client, test_user_id)

        response = await client.post(
            f"/api/ai-learning-path/session/{session_id}/reply",
            json={"content": "我想补强自动化脚本、异步编程，还想控制每天 45 分钟。"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert len(calls) >= 2
        assert calls[-1]["turn_index"] == 2
        assert calls[-1]["recent_messages"][-1]["content"] == "我想补强自动化脚本、异步编程，还想控制每天 45 分钟。"
        assert payload["messages"][-1]["content"].startswith("收到，你当前关注 python 的核心目标是：")

    @pytest.mark.asyncio
    async def test_reply_clarification_session_uses_llm_in_open_supplement_mode_when_available(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """After open supplement mode begins, extra replies should still use the LLM instead of static supplement copy."""
        session_id = await self._start_session(client, test_user_id)
        await self._drive_session_into_open_supplement_mode(client, session_id)

        async def _fake_generate_clarification_turn(
            self,
            *,
            user_id: str,
            subject_key: str,
            turn_index: int,
            recent_messages: list[dict],
            missing_items: list[str],
            ready_summary: str,
            fallback_question: str,
            fallback_quick_options: list[str],
            snapshot_notes: str,
        ) -> dict:
            assert recent_messages[-1]["content"] == "补充：我更想围绕真实脚本拆解和日志处理推进。"
            return {
                "question": "收到补充。接下来你更希望先补日志处理，还是先拆真实脚本结构？",
                "quick_options": ["先补日志处理", "先拆真实脚本", "两条线一起推进"],
            }

        monkeypatch.setattr(
            "app.services.clarification_service.ClarificationService._generate_clarification_turn",
            _fake_generate_clarification_turn,
        )

        response = await client.post(
            f"/api/ai-learning-path/session/{session_id}/reply",
            json={"content": "补充：我更想围绕真实脚本拆解和日志处理推进。"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["current_turn_index"] == 5
        assert payload["messages"][-1]["message_type"] == "summary"
        assert payload["messages"][-1]["structured_payload"]["mode"] == "open_supplement"
        assert payload["messages"][-1]["content"] == "收到补充。接下来你更希望先补日志处理，还是先拆真实脚本结构？"
        assert payload["messages"][-1]["structured_payload"]["quick_options"] == [
            "先补日志处理",
            "先拆真实脚本",
            "两条线一起推进",
        ]

    @pytest.mark.asyncio
    async def test_reply_clarification_session_caps_active_ai_questioning_at_five_turns(
        self,
        client: AsyncClient,
        test_user_id: str,
    ):
        """The assistant should stop proactive questioning after the fifth AI turn."""
        session_id = await self._start_session(client, test_user_id)

        fourth_reply_payload = None
        for content in [
            "目标是补强自动化脚本能力。",
            "当前水平是基础语法熟悉，但异步和测试薄弱。",
            "重点范围是 asyncio、pytest 和工程化。",
            "每天能学 45 分钟。",
        ]:
            fourth_reply_payload = await self._reply(client, session_id, content)

        assert fourth_reply_payload is not None
        assert fourth_reply_payload["current_turn_index"] == 5
        assert fourth_reply_payload["messages"][-1]["message_type"] == "question"

        fifth_reply_payload = await self._reply(
            client,
            session_id,
            "请按这个方向继续总结，我没有异议。",
        )

        assert fifth_reply_payload["current_turn_index"] == 5
        assert fifth_reply_payload["messages"][-1]["message_type"] == "summary"
        assert fifth_reply_payload["messages"][-1]["structured_payload"]["mode"] == "open_supplement"
        assert fifth_reply_payload["messages"][-1]["content"]
        assert fifth_reply_payload["messages"][-1]["structured_payload"]["quick_options"]

        sixth_reply_payload = await self._reply(
            client,
            session_id,
            "补充一下，我还想把命令行工具和日志处理也纳入计划。",
        )

        assert sixth_reply_payload["current_turn_index"] == 5
        assert sixth_reply_payload["messages"][-1]["message_type"] == "summary"
        assert sixth_reply_payload["messages"][-1]["structured_payload"]["mode"] == "open_supplement"
        assert sixth_reply_payload["messages"][-1]["structured_payload"]["quick_options"]

    @pytest.mark.asyncio
    async def test_reply_clarification_session_keeps_guiding_when_key_information_is_still_missing(
        self,
        client: AsyncClient,
        test_user_id: str,
    ):
        """After the soft cap, the assistant should keep guiding if essential fields are still missing."""
        session_id = await self._start_session(client, test_user_id)

        fifth_turn_payload = None
        for content in [
            "目标是先把机器学习基础打稳。",
            "我现在是零基础，需要从最基础开始。",
            "我想先从基础概念和第一个示例开始。",
            "时间安排我现在还拿不准，想先看看路线再决定。",
        ]:
            fifth_turn_payload = await self._reply(client, session_id, content)

        assert fifth_turn_payload is not None
        assert fifth_turn_payload["current_turn_index"] == 5
        assert fifth_turn_payload["messages"][-1]["message_type"] == "question"

        sixth_turn_payload = await self._reply(
            client,
            session_id,
            "我还不确定具体每周能投入多少，想先按轻量节奏理解也可以。",
        )

        assert sixth_turn_payload["current_turn_index"] == 6
        assert sixth_turn_payload["messages"][-1]["message_type"] == "question"
        assert "mode" not in (sixth_turn_payload["messages"][-1]["structured_payload"] or {})
        assert sixth_turn_payload["messages"][-1]["content"]
        assert len(sixth_turn_payload["messages"][-1]["structured_payload"]["quick_options"]) >= 2

    @pytest.mark.asyncio
    async def test_save_preference_snapshot_persists_tri_state_nodes(
        self,
        client: AsyncClient,
        test_user_id: str,
    ):
        """The workbench should persist tri-state preference snapshots for a session."""
        start_response = await client.post(
            f"/api/ai-learning-path/session/start?user_id={test_user_id}",
            json={"subject_key": "python"},
        )
        assert start_response.status_code == 200
        session_id = start_response.json()["session_id"]

        response = await client.put(
            f"/api/ai-learning-path/session/{session_id}/preference-snapshot",
            json={
                "known_node_ids": ["python.syntax.variables"],
                "target_node_ids": ["python.asyncio.basics"],
                "avoid_node_ids": ["python.desktop.gui"],
                "free_text_notes": "更关注自动化和后端脚本。",
            },
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["session_id"] == session_id
        assert payload["known_node_ids"] == ["python.syntax.variables"]
        assert payload["target_node_ids"] == ["python.asyncio.basics"]
        assert payload["avoid_node_ids"] == ["python.desktop.gui"]
        assert payload["free_text_notes"] == "更关注自动化和后端脚本。"

    @pytest.mark.asyncio
    async def test_ready_check_returns_not_ready_when_session_context_is_incomplete(
        self,
        client: AsyncClient,
        test_user_id: str,
    ):
        """Ready-check should use the new clarification requirements instead of placeholder flags."""
        session_id = await self._start_session(client, test_user_id)

        response = await client.get(f"/api/ai-learning-path/session/{session_id}/ready-check")

        assert response.status_code == 200
        payload = response.json()
        assert payload["session_id"] == session_id
        assert payload["ready"] is False
        assert set(payload["missing_items"]) == {
            "goal",
            "current_level",
            "target_scope",
            "time_budget",
            "confirmation",
        }

    @pytest.mark.asyncio
    async def test_ready_check_recognizes_beginner_level_phrasing(
        self,
        client: AsyncClient,
        test_user_id: str,
    ):
        """Beginner phrasing like '我是初学者' should populate current_level immediately."""
        session_id = await self._start_session(client, test_user_id)

        await self._reply(client, session_id, "我的目标是先学会 Python 自动化脚本。")
        await self._reply(client, session_id, "我是初学者。")

        response = await client.get(f"/api/ai-learning-path/session/{session_id}/ready-check")

        assert response.status_code == 200
        payload = response.json()
        assert "当前水平：我是初学者。" in payload["summary"]
        assert "current_level" not in payload["missing_items"]

    @pytest.mark.asyncio
    async def test_ready_check_uses_llm_structured_state_extraction_when_available(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Ready-check should prefer the LLM structured extraction result when it is available."""
        session_id = await self._start_session(client, test_user_id)

        await self._reply(client, session_id, "我希望系统学会 Python 自动化与脚本排错。")
        await self._reply(client, session_id, "我是初学者。")
        await self._reply(client, session_id, "我想重点学 pytest、日志处理和真实脚本拆解。")
        await self._reply(client, session_id, "我每天能投入 30 分钟。")

        async def _fake_extract_clarification_state_with_llm(
            self,
            *,
            user_id: str,
            detail: dict,
            snapshot,
            rule_state: dict,
        ) -> dict:
            return {
                "goal": "我希望系统学会 Python 自动化与脚本排错。",
                "current_level": "我是初学者。",
                "target_scope": "我想重点学 pytest、日志处理和真实脚本拆解。",
                "time_budget": "我每天能投入 30 分钟。",
                "confirmation": True,
            }

        monkeypatch.setattr(
            "app.services.clarification_service.ClarificationService._extract_clarification_state_with_llm",
            _fake_extract_clarification_state_with_llm,
        )

        response = await client.get(f"/api/ai-learning-path/session/{session_id}/ready-check")

        assert response.status_code == 200
        payload = response.json()
        assert payload["ready"] is True
        assert payload["missing_items"] == []
        assert "重点范围：我想重点学 pytest、日志处理和真实脚本拆解。" in payload["summary"]
        assert "确认状态：已确认，可生成" in payload["summary"]

    @pytest.mark.asyncio
    async def test_ready_check_falls_back_to_rule_based_state_when_llm_misses_fields(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Rule-based extraction should fill fields the LLM misses instead of dropping them."""
        session_id = await self._start_session(client, test_user_id)

        await self._reply(client, session_id, "我的目标是完成自动化脚本与测试流程。")
        await self._reply(client, session_id, "我是零基础。")
        await self._reply(client, session_id, "重点是 pytest、日志处理和脚本拆解。")
        await self._reply(client, session_id, "我每周大概学习 5 小时。")

        async def _fake_extract_clarification_state_with_llm(
            self,
            *,
            user_id: str,
            detail: dict,
            snapshot,
            rule_state: dict,
        ) -> dict:
            return {
                "goal": "我的目标是完成自动化脚本与测试流程。",
                "current_level": "",
                "target_scope": "",
                "time_budget": "",
                "confirmation": False,
            }

        monkeypatch.setattr(
            "app.services.clarification_service.ClarificationService._extract_clarification_state_with_llm",
            _fake_extract_clarification_state_with_llm,
        )

        response = await client.get(f"/api/ai-learning-path/session/{session_id}/ready-check")

        assert response.status_code == 200
        payload = response.json()
        assert "当前水平：我是零基础。" in payload["summary"]
        assert "重点范围：重点是 pytest、日志处理和脚本拆解。" in payload["summary"]
        assert "时间安排：我每周大概学习 5 小时。" in payload["summary"]
        assert "current_level" not in payload["missing_items"]
        assert "target_scope" not in payload["missing_items"]
        assert "time_budget" not in payload["missing_items"]

    @pytest.mark.asyncio
    async def test_open_supplement_mode_keeps_accepting_user_input_and_refreshes_ready_summary(
        self,
        client: AsyncClient,
        test_user_id: str,
    ):
        """After the fifth turn, extra replies should still update the generated summary."""
        session_id = await self._start_session(client, test_user_id)
        await self._save_snapshot(client, session_id)
        await self._drive_session_into_open_supplement_mode(client, session_id)

        ready_before_extra_reply = await client.get(f"/api/ai-learning-path/session/{session_id}/ready-check")
        assert ready_before_extra_reply.status_code == 200
        ready_before_payload = ready_before_extra_reply.json()

        extra_reply = await self._reply(
            client,
            session_id,
            "补充：我还想加入真实脚本拆解、日志分析和 pytest 自动化实践。",
        )

        assert extra_reply["messages"][-1]["structured_payload"]["mode"] == "open_supplement"

        ready_after_extra_reply = await client.get(f"/api/ai-learning-path/session/{session_id}/ready-check")
        assert ready_after_extra_reply.status_code == 200
        ready_after_payload = ready_after_extra_reply.json()

        assert ready_after_payload["ready"] is True
        assert ready_after_payload["missing_items"] == []
        assert "学习目标" in ready_before_payload["summary"]
        assert "当前水平" in ready_before_payload["summary"]
        assert "重点范围" in ready_before_payload["summary"]
        assert "时间安排" in ready_before_payload["summary"]
        assert "pytest 自动化实践" in ready_after_payload["summary"]
        assert ready_after_payload["summary"] != ready_before_payload["summary"]

    @pytest.mark.asyncio
    async def test_ready_check_uses_previous_assistant_question_to_capture_contextual_answers(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Contextual answers should still fill slots even when the answer text lacks old keyword hints."""

        async def _fake_generate_clarification_turn(
            self,
            *,
            user_id: str,
            subject_key: str,
            turn_index: int,
            recent_messages: list[dict],
            missing_items: list[str],
            ready_summary: str,
            fallback_question: str,
            fallback_quick_options: list[str],
            snapshot_notes: str,
        ) -> dict:
            scripted_turns = {
                1: {
                    "question": "你这次学习 MindSpore 机器学习，最希望达成什么具体目标呢？",
                    "quick_options": ["快速上手项目", "系统打好基础", "请你帮我推荐"],
                },
                2: {
                    "question": "为了帮你规划得更贴近你，你目前对机器学习和 Python 的熟悉程度怎么样？",
                    "quick_options": ["完全零基础", "有 Python 基础", "了解机器学习，想落地实践"],
                },
                3: {
                    "question": "你计划每周投入多少时间来学习呢？",
                    "quick_options": ["每周 3-5 小时", "每周 5-8 小时", "时间比较灵活"],
                },
                4: {
                    "question": "你更希望这条路线侧重于基础概念和编程实践，还是想探索一些进阶应用呢？",
                    "quick_options": ["更侧重基础概念和编程实践", "想探索进阶应用", "请你帮我推荐一个侧重方向"],
                },
                5: {
                    "question": "我先继续帮你梳理一下，还差最后一点确认信息。",
                    "quick_options": ["继续", "再补充一点", "请你帮我推荐"],
                },
            }
            return scripted_turns[turn_index]

        monkeypatch.setattr(
            "app.services.clarification_service.ClarificationService._generate_clarification_turn",
            _fake_generate_clarification_turn,
        )

        start_response = await client.post(
            f"/api/ai-learning-path/session/start?user_id={test_user_id}",
            json={"subject_key": "python"},
        )
        assert start_response.status_code == 200
        session_id = start_response.json()["session_id"]

        for content in [
            "想尽快上手一个实际项目。",
            "对机器学习有了解，想用 MindSpore 实践。",
            "时间比较灵活，但希望稳步推进。",
            "更侧重于基础概念和编程实践。",
        ]:
            reply_response = await client.post(
                f"/api/ai-learning-path/session/{session_id}/reply",
                json={"content": content},
            )
            assert reply_response.status_code == 200

        ready_response = await client.get(f"/api/ai-learning-path/session/{session_id}/ready-check")
        assert ready_response.status_code == 200
        payload = ready_response.json()

        assert "当前水平：对机器学习有了解，想用 MindSpore 实践。" in payload["summary"]
        assert "时间安排：时间比较灵活，但希望稳步推进。" in payload["summary"]
        assert "重点范围：更侧重于基础概念和编程实践。" in payload["summary"]
        assert "current_level" not in payload["missing_items"]
        assert "time_budget" not in payload["missing_items"]
        assert "target_scope" not in payload["missing_items"]

    @pytest.mark.asyncio
    async def test_ready_check_and_snapshot_summary_render_snapshot_node_labels_instead_of_ids(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Snapshot-derived summaries should render human-readable node labels instead of internal node ids."""

        async def _fake_get_active_subject_skill_map(self, subject_key: str, user_id: str | None = None):
            return {
                "subject_key": subject_key,
                "version": 1,
                "is_active": True,
                "tree": {
                    "id": "mindspore",
                    "label": "MindSpore",
                    "children": [
                        {"id": "foundations", "label": "MindSpore 基础与环境", "children": []},
                        {"id": "programming", "label": "数据处理与编程模型", "children": []},
                        {"id": "advanced", "label": "进阶特性与工程化", "children": []},
                    ],
                },
            }

        monkeypatch.setattr(AILearningPathService, "get_active_subject_skill_map", _fake_get_active_subject_skill_map)

        start_response = await client.post(
            f"/api/ai-learning-path/session/start?user_id={test_user_id}",
            json={"subject_key": "python"},
        )
        assert start_response.status_code == 200
        session_id = start_response.json()["session_id"]

        snapshot_response = await client.put(
            f"/api/ai-learning-path/session/{session_id}/preference-snapshot",
            json={
                "known_node_ids": ["foundations"],
                "target_node_ids": ["programming", "advanced"],
                "avoid_node_ids": [],
                "free_text_notes": "",
            },
        )
        assert snapshot_response.status_code == 200

        ready_response = await client.get(f"/api/ai-learning-path/session/{session_id}/ready-check")
        assert ready_response.status_code == 200
        payload = ready_response.json()

        assert "数据处理与编程模型" in payload["summary"]
        assert "进阶特性与工程化" in payload["summary"]
        assert "programming" not in payload["summary"]
        assert "advanced" not in payload["summary"]

    @pytest.mark.asyncio
    async def test_confirmation_can_move_session_into_ready_to_generate_instead_of_continuing_to_diverge(
        self,
        client: AsyncClient,
        test_user_id: str,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Flexible schedule + explicit confirmation should allow the session to converge into generation-ready state."""

        async def _fake_generate_clarification_turn(
            self,
            *,
            user_id: str,
            subject_key: str,
            turn_index: int,
            recent_messages: list[dict],
            missing_items: list[str],
            ready_summary: str,
            fallback_question: str,
            fallback_quick_options: list[str],
            snapshot_notes: str,
        ) -> dict:
            scripted_turns = {
                1: {
                    "question": "你这次学习 MindSpore 机器学习，最想优先掌握什么？",
                    "quick_options": ["基础模型搭建", "部署和优化", "请你推荐"],
                },
                2: {
                    "question": "你每周大概能投入多少时间来学习呢？",
                    "quick_options": ["每周 5-10 小时", "每周 10-20 小时", "时间不太固定，请你帮我推荐"],
                },
                3: {
                    "question": "你目前对 Python 和机器学习的基础掌握得怎么样呢？",
                    "quick_options": ["我是初学者", "有一些 Python 基础", "对机器学习有了解，想直接上手 MindSpore"],
                },
                4: {
                    "question": "我理解你想从 MindSpore 的基础概念开始，逐步学习编程和进阶内容，对吗？",
                    "quick_options": ["是的，请帮我确认这个路线", "我想调整一下重点范围", "请你帮我推荐更具体的起点"],
                },
            }
            if turn_index in scripted_turns:
                return scripted_turns[turn_index]
            return {
                "question": "现在信息已经足够，我可以直接为你生成新版本。你也可以在生成前再补充一句偏好。",
                "quick_options": ["🚀 直接生成新版本", "我再微调一下重点", "先看下当前理解"],
            }

        monkeypatch.setattr(
            "app.services.clarification_service.ClarificationService._generate_clarification_turn",
            _fake_generate_clarification_turn,
        )

        start_response = await client.post(
            f"/api/ai-learning-path/session/start?user_id={test_user_id}",
            json={"subject_key": "python"},
        )
        assert start_response.status_code == 200
        session_id = start_response.json()["session_id"]

        for content in [
            "掌握基础模型搭建和训练。",
            "时间不太固定，请你帮我推荐。",
            "对机器学习有了解，想直接上手 MindSpore。",
        ]:
            reply_response = await client.post(
                f"/api/ai-learning-path/session/{session_id}/reply",
                json={"content": content},
            )
            assert reply_response.status_code == 200

        confirm_response = await client.post(
            f"/api/ai-learning-path/session/{session_id}/reply",
            json={"content": "是的，请帮我确认这个路线。"},
        )
        assert confirm_response.status_code == 200
        payload = confirm_response.json()

        assert payload["messages"][-1]["message_type"] == "summary"
        assert payload["messages"][-1]["structured_payload"]["mode"] == "open_supplement"
        assert payload["messages"][-1]["structured_payload"]["quick_options"][0] == "🚀 直接生成新版本"

        ready_response = await client.get(f"/api/ai-learning-path/session/{session_id}/ready-check")
        assert ready_response.status_code == 200
        ready_payload = ready_response.json()
        assert ready_payload["ready"] is True
        assert ready_payload["missing_items"] == []

    @pytest.mark.asyncio
    async def test_generate_from_session_creates_new_active_version_and_context(
        self,
        client: AsyncClient,
        test_user_id: str,
        test_session,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Session-based generation should assemble context and create a fresh active version."""
        existing_path_id = uuid4()
        normalized_user_id = UUID(test_user_id)
        existing_path = LearningPath(
            id=str(existing_path_id),
            user_id=test_user_id,
            goal="旧学习计划",
            total_days=7,
            daily_minutes=30,
            created_at="2026-03-14T00:00:00",
            days=[],
            generated_days=0,
            phase_size=7,
            progress_percent=0,
            current_day=1,
            version=1,
            version_name="学习计划 v1",
            is_active=True,
        )
        test_session.add(
            UserLearningPath(
                id=existing_path_id,
                user_id=normalized_user_id,
                subject_key="python",
                goal=existing_path.goal,
                total_days=existing_path.total_days,
                daily_minutes=existing_path.daily_minutes,
                data=existing_path.model_dump(),
                version=1,
                version_name="学习计划 v1",
                is_active=True,
            )
        )
        await test_session.commit()

        session_id = await self._start_session(client, test_user_id)
        await self._save_snapshot(client, session_id)
        await self._drive_session_into_open_supplement_mode(client, session_id)

        from app.services.ai_learning_path_service import AILearningPathService

        async def _fake_generate_from_context(self, *, user_id: str, subject_key: str, goal: str, total_days: int, daily_minutes: int):
            normalized_user_id = UUID(user_id)
            new_path_id = uuid4()
            new_path = LearningPath(
                id=str(new_path_id),
                user_id=user_id,
                goal=goal,
                total_days=total_days,
                daily_minutes=daily_minutes,
                created_at="2026-03-14T01:00:00",
                days=[],
                generated_days=0,
                phase_size=7,
                progress_percent=0,
                current_day=1,
                version=2,
                version_name="学习计划 v2",
                is_active=True,
            )

            await self.db.execute(
                UserLearningPath.__table__.update()
                .where(
                    UserLearningPath.user_id == normalized_user_id,
                    UserLearningPath.subject_key == subject_key,
                    UserLearningPath.is_active == True,
                )
                .values(is_active=False)
            )
            self.db.add(
                UserLearningPath(
                    id=new_path_id,
                    user_id=normalized_user_id,
                    subject_key=subject_key,
                    goal=goal,
                    total_days=total_days,
                    daily_minutes=daily_minutes,
                    data=new_path.model_dump(),
                    version=2,
                    version_name="学习计划 v2",
                    is_active=True,
                )
            )
            await self.db.commit()
            return new_path

        monkeypatch.setattr(AILearningPathService, "_generate_path_from_context", _fake_generate_from_context)

        response = await client.post(f"/api/ai-learning-path/session/{session_id}/generate")

        assert response.status_code == 200
        payload = response.json()
        assert payload["session_id"] == session_id
        assert payload["path"]["version"] == 2
        assert payload["path"]["is_active"] is True
        assert payload["context"]["goal_summary"]
        assert payload["ready_check"]["ready"] is True

        context_rows = (
            await test_session.execute(
                LearningPathGenerationContext.__table__.select().where(
                    LearningPathGenerationContext.session_id == UUID(session_id)
                )
            )
        ).all()
        assert len(context_rows) == 1
