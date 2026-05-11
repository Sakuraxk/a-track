"""
AI学习路线服务
使用LLM生成个性化的学习路线和每日任务
"""
import json
import uuid
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Any, AsyncGenerator
from openai import APITimeoutError
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update

from ..prompts import get_prompt_registry
from ..services.llm_service import LLMService, LLMServiceFactory, LLMServiceError
from ..services.encryption import decrypt_api_key
from ..models.llm_config import UserLLMConfig
from ..services.stats_service import StatsService
from ..services.learning_path_map_seed import DEFAULT_SUBJECT_SKILL_MAPS, DEFAULT_SUBJECT_SKILL_MAP_VERSIONS
from ..models.learning_path import UserLearningPath
from ..models.learning_path_workbench import (
    SubjectSkillMap,
    LearningPathClarificationSession,
    LearningPathClarificationMessage,
    LearningPathPreferenceSnapshot,
    LearningPathGenerationContext,
    UserSubjectSkillExpansionNode,
    UserSkillTreeSnapshot,
)
from ..core.config import settings
from ..core.llm_limits import clamp_llm_output_tokens
from ..services.user_memory_service import UserMemoryService

# ── 从 learning_path_models 导入数据模型与常量 ──────────
# 同时 re-export，保证外部 `from ..services.ai_learning_path_service import X` 不受影响
from ..services.learning_path_models import (  # noqa: F401 — re-export
    SubjectConfig,
    SUBJECT_CONFIGS,
    LearningTask,
    LearningDay,
    LearningPath,
    _MAX_PROACTIVE_CLARIFICATION_TURNS,
    _OPEN_SUPPLEMENT_MODE,
    _CONFIRMATION_HINTS,
    _CURRENT_LEVEL_HINTS,
    _TARGET_SCOPE_HINTS,
    _TIME_BUDGET_HINTS,
    _NON_PROGRAMMING_CONSTRAINTS,
)
from ..services.llm_json_utils import (
    parse_llm_json,
    truncate_reason,
    strip_invisible_chars,
    normalize_clarification_text,
)
from ..services.learning_path_crud_service import LearningPathCRUDService
from ..services.clarification_service import ClarificationService

# 配置日志
logger = logging.getLogger(__name__)

# ── 生成后内容校验 ──────────────────────────────────────
# 非 Python 学科禁止出现的纯 Python 入门关键词（用于检测内容漂移）
_PYTHON_BASICS_KEYWORDS = [
    "Python基础语法", "变量与数据类型", "列表操作", "字典操作",
    "字符串处理", "for循环", "while循环", "if-else",
    "列表切片", "列表创建", "字典创建", "集合操作",
    "输入输出", "print(", "input(", "变量赋值",
    "Python 基础", "Python入门", "基础语法练习",
    "条件语句", "循环结构", "函数定义", "数据类型转换",
    "列表推导式", "元组操作", "文件读写基础",
    "Python 编程入门", "编程基础", "Python 环境搭建",
]


def _validate_generated_days_subject_fidelity(
    days_data: list[dict],
    subject_key: str,
    subject_name: str,
) -> list[str]:
    """
    检查生成的 days 中是否包含与学科不符的内容（目前仅检测非 Python 学科的 Python 入门泄漏）。
    返回违规描述列表（空列表表示通过）。
    """
    if subject_key == "python":
        return []

    violations: list[str] = []
    for day_data in days_data:
        day_num = day_data.get("day", "?")
        theme = day_data.get("theme", "")
        for keyword in _PYTHON_BASICS_KEYWORDS:
            if keyword in theme:
                violations.append(f"Day {day_num} theme 包含 Python 入门内容: '{theme}'")
                break

        for task_data in day_data.get("tasks", []):
            title = task_data.get("title", "")
            desc = task_data.get("description", "")
            text = f"{title} {desc}"
            for keyword in _PYTHON_BASICS_KEYWORDS:
                if keyword in text:
                    violations.append(
                        f"Day {day_num} task '{title}' 包含 Python 入门关键词: '{keyword}'"
                    )
                    break
    return violations


class AILearningPathService:
    """AI学习路线服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._crud = LearningPathCRUDService(db)
        self._clarification = ClarificationService(db, self)
        # 生成学习路线的失败原因（用于接口透传给前端排查）
        self.last_generation_reason: Optional[str] = None
        # AI 可公开展示的“规划思考摘要”
        self.last_generation_thinking_summary: Optional[str] = None

    @staticmethod
    def _resolve_llm_max_tokens(llm_service: LLMService, prompt_max_tokens: int) -> int:
        """尊重用户配置上限，不再被 prompt 默认值抬高。"""
        service_max_tokens = int(
            getattr(llm_service, "max_tokens", settings.default_llm_max_tokens)
            or settings.default_llm_max_tokens
        )
        prompt_max_tokens = int(prompt_max_tokens or service_max_tokens)
        return clamp_llm_output_tokens(
            min(service_max_tokens, prompt_max_tokens),
            service_max_tokens,
        )

    @staticmethod
    def _build_llm_runtime_context(
        llm_service: LLMService,
        *,
        effective_timeout: int | None = None,
        effective_max_tokens: int | None = None,
        use_json_mode: bool | None = None,
    ) -> str:
        parts = [
            f"source={getattr(llm_service, 'config_source', 'unknown')}",
            f"config_id={getattr(llm_service, 'user_llm_config_id', '-')}",
            f"model={getattr(llm_service, 'model_name', '-')}",
            f"base_url={getattr(llm_service, 'api_base_url', '-')}",
            f"timeout={effective_timeout if effective_timeout is not None else getattr(llm_service, 'timeout', '-')}",
            f"max_tokens={effective_max_tokens if effective_max_tokens is not None else getattr(llm_service, 'max_tokens', '-')}",
        ]
        if use_json_mode is not None:
            parts.append(f"json_mode={use_json_mode}")
        return "；".join(parts)

    @staticmethod
    def _clone_skill_tree(node: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": node["id"],
            "label": node.get("label", ""),
            "description": node.get("description", ""),
            "tags": list(node.get("tags", [])),
            "children": [AILearningPathService._clone_skill_tree(child) for child in node.get("children", [])],
        }

    @staticmethod
    def _find_skill_tree_node(node: dict[str, Any], target_id: str) -> Optional[dict[str, Any]]:
        if node.get("id") == target_id:
            return node
        for child in node.get("children", []):
            found = AILearningPathService._find_skill_tree_node(child, target_id)
            if found is not None:
                return found
        return None

    async def _load_user_expansion_nodes(self, user_id: str, subject_key: str) -> list[UserSubjectSkillExpansionNode]:
        try:
            result = await self.db.execute(
                select(UserSubjectSkillExpansionNode)
                .where(
                    UserSubjectSkillExpansionNode.user_id == uuid.UUID(user_id),
                    UserSubjectSkillExpansionNode.subject_key == subject_key,
                )
                .order_by(
                    UserSubjectSkillExpansionNode.parent_node_id.asc(),
                    UserSubjectSkillExpansionNode.order_index.asc(),
                    UserSubjectSkillExpansionNode.created_at.asc(),
                )
            )
            return result.scalars().all()
        except ProgrammingError as exc:
            if "user_subject_skill_expansion_node" in str(exc):
                logger.warning(
                    "[AI Path] 用户扩展节点表不存在，先回退为仅加载系统主树。请运行 alembic upgrade head 完成迁移。"
                )
                await self.db.rollback()
                return []
            raise

    def _merge_user_expansion_nodes(
        self,
        tree: dict[str, Any],
        expansion_nodes: list[UserSubjectSkillExpansionNode],
    ) -> dict[str, Any]:
        merged_tree = self._clone_skill_tree(tree)
        children_by_parent: dict[str, list[dict[str, Any]]] = {}
        for record in expansion_nodes:
            children_by_parent.setdefault(record.parent_node_id, []).append(
                {
                    "id": record.node_id,
                    "label": record.label,
                    "description": record.description,
                    "tags": list(record.tags or []),
                    "children": [],
                }
            )

        def attach(node: dict[str, Any]) -> dict[str, Any]:
            base_children = [attach(child) for child in node.get("children", [])]
            expanded_children = [attach(child) for child in children_by_parent.get(node["id"], [])]
            return {
                **node,
                "children": base_children + expanded_children,
            }

        return attach(merged_tree)

    async def _ensure_system_skill_map(self, subject_key: str) -> Optional[SubjectSkillMap]:
        """确保系统主树存在且为最新版本，返回 active 的系统主树记录。"""
        seed_tree = DEFAULT_SUBJECT_SKILL_MAPS.get(subject_key)
        seed_version = DEFAULT_SUBJECT_SKILL_MAP_VERSIONS.get(subject_key, 1)
        result = await self.db.execute(
            select(SubjectSkillMap).where(
                SubjectSkillMap.subject_key == subject_key,
                SubjectSkillMap.is_active == True,
            )
        )
        record = result.scalar_one_or_none()

        if record is None:
            if seed_tree is None:
                return None
            record = SubjectSkillMap(
                subject_key=subject_key,
                version=seed_version,
                tree_json=seed_tree,
                is_active=True,
            )
            self.db.add(record)
            await self.db.commit()
            await self.db.refresh(record)
        elif seed_tree is not None and record.version < seed_version:
            record.is_active = False
            upgraded_record = SubjectSkillMap(
                subject_key=subject_key,
                version=seed_version,
                tree_json=seed_tree,
                is_active=True,
            )
            self.db.add(upgraded_record)
            await self.db.commit()
            await self.db.refresh(upgraded_record)
            record = upgraded_record
        return record

    async def _get_active_snapshot(self, user_id: str, subject_key: str) -> Optional[UserSkillTreeSnapshot]:
        """获取用户当前激活的星图快照。"""
        result = await self.db.execute(
            select(UserSkillTreeSnapshot).where(
                UserSkillTreeSnapshot.user_id == uuid.UUID(user_id),
                UserSkillTreeSnapshot.subject_key == subject_key,
                UserSkillTreeSnapshot.is_active == True,
            )
        )
        return result.scalar_one_or_none()

    async def _auto_create_snapshot(self, user_id: str, subject_key: str, system_record: SubjectSkillMap) -> UserSkillTreeSnapshot:
        """首次访问时自动从系统树 fork 一个快照。

        同时迁移已有的 expansion_node 数据到快照中。
        """
        tree = self._clone_skill_tree(system_record.tree_json)

        # 迁移旧的 expansion_node 数据（如果有）
        expansion_nodes = await self._load_user_expansion_nodes(user_id, subject_key)
        if expansion_nodes:
            tree = self._merge_user_expansion_nodes(system_record.tree_json, expansion_nodes)

        snapshot = UserSkillTreeSnapshot(
            user_id=uuid.UUID(user_id),
            subject_key=subject_key,
            name="我的探索",
            base_version=system_record.version,
            tree_json=tree,
            is_active=True,
        )
        self.db.add(snapshot)
        await self.db.commit()
        await self.db.refresh(snapshot)
        return snapshot

    async def get_active_subject_skill_map(self, subject_key: str, user_id: Optional[str] = None) -> Optional[dict]:
        """获取当前学科的 active 技术树。

        优先从用户快照读取（零合并开销）；无快照时自动 fork 系统树。
        """
        system_record = await self._ensure_system_skill_map(subject_key)
        if system_record is None:
            return None

        if not user_id:
            # 无用户 ID：返回纯系统树（公共预览）
            return {
                "subject_key": system_record.subject_key,
                "version": system_record.version,
                "is_active": system_record.is_active,
                "tree": system_record.tree_json,
            }

        # 优先从快照读取
        snapshot = await self._get_active_snapshot(user_id, subject_key)
        if snapshot is None:
            snapshot = await self._auto_create_snapshot(user_id, subject_key, system_record)

        return {
            "subject_key": subject_key,
            "version": snapshot.base_version,
            "is_active": True,
            "tree": snapshot.tree_json,
            "snapshot_id": str(snapshot.id),
            "snapshot_name": snapshot.name,
        }

    @staticmethod
    def _slugify_skill_expansion(value: str) -> str:
        normalized = re.sub(r"[^a-zA-Z0-9]+", "-", (value or "").strip().lower()).strip("-")
        return normalized or f"node-{uuid.uuid4().hex[:8]}"

    async def _generate_skill_node_expansion(
        self,
        *,
        session_id: str,
        user_id: str,
        subject_key: str,
        parent_node_id: str,
        existing_child_ids: list[str],
        mode: str,
    ) -> list[dict[str, Any]]:
        llm_service = await self._get_llm_service(user_id)
        if not llm_service:
            reason = self.last_generation_reason or "用户个人配置不可用，且系统默认 LLM 不可用"
            raise LLMServiceError(f"未找到可用的技术树发散 LLM 配置：{reason}")

        detail = await self.get_clarification_session(session_id)
        if detail is None:
            raise ValueError("澄清会话不存在")

        snapshot = await self._get_preference_snapshot(session_id)
        active_map = await self.get_active_subject_skill_map(subject_key, user_id)
        if active_map is None:
            raise ValueError("未找到学科技术树")

        parent_node = self._find_skill_tree_node(active_map["tree"], parent_node_id)
        if parent_node is None:
            raise ValueError("未找到待发散节点")

        state = await self._collect_clarification_state(detail, snapshot)
        personalization = await self._build_clarification_personalization_context(user_id)
        prompt_registry = get_prompt_registry()
        prompt_definition = prompt_registry.get_definition("ai_learning_path.expand_node")
        messages = prompt_registry.render_messages(
            "ai_learning_path.expand_node",
            {
                "subject_key": subject_key,
                "subject_name": SUBJECT_CONFIGS.get(subject_key).name if subject_key in SUBJECT_CONFIGS else subject_key,
                "parent_node_id": parent_node_id,
                "parent_node_label": parent_node["label"],
                "parent_node_description": parent_node.get("description", ""),
                "existing_child_ids_json": json.dumps(existing_child_ids, ensure_ascii=False),
                "existing_child_labels_json": json.dumps([child["label"] for child in parent_node.get("children", [])], ensure_ascii=False),
                "session_messages_json": json.dumps(detail["messages"], ensure_ascii=False, indent=2),
                "ready_summary": state["summary"],
                "ability_tags_detail": personalization["ability_tags_detail"],
                "learning_stats": personalization["learning_stats"],
                "snapshot_summary": await self._clarification._build_snapshot_summary(
                    snapshot,
                    subject_key,
                    user_id,
                ),
                "expansion_mode": mode,
                "expansion_mode_description": "偏课程化发散：优先细化概念、知识点和前置依赖" if mode == "curriculum" else "偏实战化发散：优先细化真实任务、项目模块和可落地能力",
            },
        )

        effective_timeout = max(int(getattr(llm_service, "timeout", 30)), 60)
        effective_max_tokens = self._resolve_llm_max_tokens(llm_service, prompt_definition.max_tokens)
        try:
            raw_content, _ = await llm_service.raw_completion(
                messages,
                temperature=prompt_definition.temperature,
                max_tokens=effective_max_tokens,
                timeout_override=effective_timeout,
                use_json_mode=True,
            )
            data = parse_llm_json(raw_content)
        except Exception as exc:
            runtime_context = self._build_llm_runtime_context(
                llm_service,
                effective_timeout=effective_timeout,
                effective_max_tokens=effective_max_tokens,
                use_json_mode=True,
            )
            logger.exception(
                "[AI Path] 技术树发散调用失败: user_id=%s session_id=%s parent_node_id=%s %s",
                user_id,
                session_id,
                parent_node_id,
                runtime_context,
            )
            raise LLMServiceError(
                f"技术树发散调用失败：{runtime_context}；原因={type(exc).__name__}: {exc}"
            ) from exc
        nodes = data.get("nodes")
        if not isinstance(nodes, list):
            raise ValueError("技术树发散结果缺少 nodes 数组")

        normalized_nodes: list[dict[str, Any]] = []
        for item in nodes:
            if not isinstance(item, dict):
                continue
            label = normalize_clarification_text(str(item.get("label") or ""))
            if not label:
                continue
            normalized_nodes.append(
                {
                    "slug": self._slugify_skill_expansion(str(item.get("slug") or label)),
                    "label": label,
                    "description": normalize_clarification_text(str(item.get("description") or "")),
                    "tags": [str(tag).strip() for tag in (item.get("tags") or []) if str(tag).strip()],
                }
            )
        return normalized_nodes

    async def expand_skill_node_for_session(
        self,
        session_id: str,
        node_id: str,
        mode: str = "curriculum",
    ) -> dict[str, Any]:
        """为目标节点发散子节点，结果直接写入用户快照 JSON。"""
        session_result = await self.db.execute(
            select(LearningPathClarificationSession).where(
                LearningPathClarificationSession.id == uuid.UUID(session_id)
            )
        )
        session = session_result.scalar_one_or_none()
        if session is None:
            raise ValueError("澄清会话不存在")

        pref_snapshot = await self._get_preference_snapshot(session_id)
        target_node_ids = list(pref_snapshot.target_node_ids) if pref_snapshot else []
        if node_id not in target_node_ids:
            raise ValueError("只有标记为想学习的节点才能继续发散")

        # 获取/自动创建用户快照
        tree_snapshot = await self._get_active_snapshot(str(session.user_id), session.subject_key)
        if tree_snapshot is None:
            system_record = await self._ensure_system_skill_map(session.subject_key)
            if system_record is None:
                raise ValueError("未找到学科技术树")
            tree_snapshot = await self._auto_create_snapshot(str(session.user_id), session.subject_key, system_record)

        tree = tree_snapshot.tree_json
        parent_node = self._find_skill_tree_node(tree, node_id)
        if parent_node is None:
            raise ValueError("未找到待发散节点")

        existing_child_ids = [child["id"] for child in parent_node.get("children", [])]
        expansion_nodes = await self._generate_skill_node_expansion(
            session_id=session_id,
            user_id=str(session.user_id),
            subject_key=session.subject_key,
            parent_node_id=node_id,
            existing_child_ids=existing_child_ids,
            mode=mode if mode in {"curriculum", "practical"} else "curriculum",
        )

        existing_child_labels = {child["label"] for child in parent_node.get("children", [])}
        new_node_ids: list[str] = []
        for node_data in expansion_nodes:
            if node_data["label"] in existing_child_labels:
                continue
            candidate_id = f"{node_id}.{node_data['slug']}"
            suffix = 2
            while candidate_id in existing_child_ids or candidate_id in new_node_ids:
                candidate_id = f"{node_id}.{node_data['slug']}-{suffix}"
                suffix += 1

            parent_node["children"].append({
                "id": candidate_id,
                "label": node_data["label"],
                "description": node_data["description"],
                "tags": list(node_data["tags"]) + ["user-generated"],
                "children": [],
            })
            new_node_ids.append(candidate_id)

        # 原地更新快照 JSON
        from sqlalchemy.orm.attributes import flag_modified
        tree_snapshot.tree_json = tree
        flag_modified(tree_snapshot, "tree_json")
        await self.db.commit()

        return {
            "subject_key": session.subject_key,
            "version": tree_snapshot.base_version,
            "is_active": True,
            "tree": tree,
            "expanded_parent_id": node_id,
            "new_node_ids": new_node_ids,
            "snapshot_id": str(tree_snapshot.id),
            "snapshot_name": tree_snapshot.name,
        }

    # ── 星图快照管理 ──────────────────────────────────────────

    MAX_SNAPSHOTS_PER_SUBJECT = 10

    @staticmethod
    def _count_tree_nodes(tree: dict[str, Any]) -> tuple[int, int]:
        """统计树中的总节点数和发散节点数。"""
        total = 0
        expansion = 0
        def walk(node: dict[str, Any]) -> None:
            nonlocal total, expansion
            total += 1
            if "user-generated" in (node.get("tags") or []):
                expansion += 1
            for child in node.get("children", []):
                walk(child)
        walk(tree)
        return total, expansion

    async def list_skill_tree_snapshots(self, user_id: str, subject_key: str) -> list[dict[str, Any]]:
        """列出用户在某学科下的所有星图快照。"""
        result = await self.db.execute(
            select(UserSkillTreeSnapshot)
            .where(
                UserSkillTreeSnapshot.user_id == uuid.UUID(user_id),
                UserSkillTreeSnapshot.subject_key == subject_key,
            )
            .order_by(UserSkillTreeSnapshot.created_at.desc())
        )
        snapshots = result.scalars().all()
        items = []
        for snap in snapshots:
            node_count, expansion_count = self._count_tree_nodes(snap.tree_json)
            items.append({
                "id": str(snap.id),
                "name": snap.name,
                "is_active": snap.is_active,
                "base_version": snap.base_version,
                "node_count": node_count,
                "expansion_count": expansion_count,
                "created_at": snap.created_at.isoformat() if snap.created_at else "",
                "updated_at": snap.updated_at.isoformat() if snap.updated_at else "",
            })
        return items

    async def create_skill_tree_snapshot(
        self, user_id: str, subject_key: str, name: str, source: str = "system"
    ) -> dict[str, Any]:
        """创建新的星图快照。

        source="system" → 从系统默认树创建全新快照。
        source="current" → 复制当前 active 快照（含发散节点）。
        """
        # 检查上限
        existing = await self.list_skill_tree_snapshots(user_id, subject_key)
        if len(existing) >= self.MAX_SNAPSHOTS_PER_SUBJECT:
            raise ValueError(f"星图方案数量已达上限（{self.MAX_SNAPSHOTS_PER_SUBJECT}个）")

        system_record = await self._ensure_system_skill_map(subject_key)
        if system_record is None:
            raise ValueError("未找到学科技术树")

        if source == "current":
            active_snap = await self._get_active_snapshot(user_id, subject_key)
            if active_snap is None:
                tree = self._clone_skill_tree(system_record.tree_json)
                base_version = system_record.version
            else:
                tree = self._clone_skill_tree(active_snap.tree_json)
                base_version = active_snap.base_version
        else:
            tree = self._clone_skill_tree(system_record.tree_json)
            base_version = system_record.version

        snapshot = UserSkillTreeSnapshot(
            user_id=uuid.UUID(user_id),
            subject_key=subject_key,
            name=name,
            base_version=base_version,
            tree_json=tree,
            is_active=False,
        )
        self.db.add(snapshot)
        await self.db.commit()
        await self.db.refresh(snapshot)

        node_count, expansion_count = self._count_tree_nodes(tree)
        return {
            "id": str(snapshot.id),
            "name": snapshot.name,
            "is_active": snapshot.is_active,
            "base_version": snapshot.base_version,
            "node_count": node_count,
            "expansion_count": expansion_count,
            "created_at": snapshot.created_at.isoformat() if snapshot.created_at else "",
            "updated_at": snapshot.updated_at.isoformat() if snapshot.updated_at else "",
        }

    async def activate_skill_tree_snapshot(self, user_id: str, subject_key: str, snapshot_id: str) -> None:
        """切换 active 快照。"""
        uid = uuid.UUID(user_id)
        sid = uuid.UUID(snapshot_id)

        # 验证目标快照存在且属于该用户
        result = await self.db.execute(
            select(UserSkillTreeSnapshot).where(
                UserSkillTreeSnapshot.id == sid,
                UserSkillTreeSnapshot.user_id == uid,
                UserSkillTreeSnapshot.subject_key == subject_key,
            )
        )
        target = result.scalar_one_or_none()
        if target is None:
            raise ValueError("快照不存在")
        if target.is_active:
            return  # 已经是 active

        # 停用当前 active
        await self.db.execute(
            update(UserSkillTreeSnapshot)
            .where(
                UserSkillTreeSnapshot.user_id == uid,
                UserSkillTreeSnapshot.subject_key == subject_key,
                UserSkillTreeSnapshot.is_active == True,
            )
            .values(is_active=False)
        )
        target.is_active = True
        await self.db.commit()

    async def rename_skill_tree_snapshot(self, user_id: str, snapshot_id: str, name: str) -> None:
        """重命名快照。"""
        result = await self.db.execute(
            select(UserSkillTreeSnapshot).where(
                UserSkillTreeSnapshot.id == uuid.UUID(snapshot_id),
                UserSkillTreeSnapshot.user_id == uuid.UUID(user_id),
            )
        )
        snap = result.scalar_one_or_none()
        if snap is None:
            raise ValueError("快照不存在")
        snap.name = name
        await self.db.commit()

    async def delete_skill_tree_snapshot(self, user_id: str, subject_key: str, snapshot_id: str) -> None:
        """删除快照。不允许删除唯一的快照。"""
        uid = uuid.UUID(user_id)
        sid = uuid.UUID(snapshot_id)

        count_result = await self.db.execute(
            select(UserSkillTreeSnapshot.id).where(
                UserSkillTreeSnapshot.user_id == uid,
                UserSkillTreeSnapshot.subject_key == subject_key,
            )
        )
        all_ids = [row[0] for row in count_result.all()]
        if len(all_ids) <= 1:
            raise ValueError("不能删除最后一个星图方案，请使用重置功能")

        result = await self.db.execute(
            select(UserSkillTreeSnapshot).where(
                UserSkillTreeSnapshot.id == sid,
                UserSkillTreeSnapshot.user_id == uid,
            )
        )
        snap = result.scalar_one_or_none()
        if snap is None:
            raise ValueError("快照不存在")

        was_active = snap.is_active
        await self.db.delete(snap)

        # 如果删除的是 active，自动激活最近更新的快照
        if was_active:
            fallback_result = await self.db.execute(
                select(UserSkillTreeSnapshot)
                .where(
                    UserSkillTreeSnapshot.user_id == uid,
                    UserSkillTreeSnapshot.subject_key == subject_key,
                )
                .order_by(UserSkillTreeSnapshot.updated_at.desc())
                .limit(1)
            )
            fallback = fallback_result.scalar_one_or_none()
            if fallback:
                fallback.is_active = True

        await self.db.commit()

    async def reset_skill_tree_snapshot(self, user_id: str, snapshot_id: str) -> dict[str, Any]:
        """将快照重置为最新的系统默认树，清除所有发散节点。"""
        result = await self.db.execute(
            select(UserSkillTreeSnapshot).where(
                UserSkillTreeSnapshot.id == uuid.UUID(snapshot_id),
                UserSkillTreeSnapshot.user_id == uuid.UUID(user_id),
            )
        )
        snap = result.scalar_one_or_none()
        if snap is None:
            raise ValueError("快照不存在")

        system_record = await self._ensure_system_skill_map(snap.subject_key)
        if system_record is None:
            raise ValueError("未找到学科技术树")

        from sqlalchemy.orm.attributes import flag_modified
        snap.tree_json = self._clone_skill_tree(system_record.tree_json)
        snap.base_version = system_record.version
        flag_modified(snap, "tree_json")
        await self.db.commit()

        return {
            "subject_key": snap.subject_key,
            "version": snap.base_version,
            "is_active": True,
            "tree": snap.tree_json,
            "snapshot_id": str(snap.id),
            "snapshot_name": snap.name,
        }


    # ── 澄清会话 (委托到 ClarificationService) ──────────────

    async def start_clarification_session(self, user_id: str, subject_key: str) -> dict:
        return await self._clarification.start_clarification_session(user_id, subject_key)

    async def save_preference_snapshot(
        self, session_id: str, known_node_ids: list, target_node_ids: list,
        avoid_node_ids: list, free_text_notes: str = ""
    ) -> dict:
        return await self._clarification.save_preference_snapshot(
            session_id, known_node_ids, target_node_ids, avoid_node_ids, free_text_notes
        )

    async def get_clarification_session(self, session_id: str) -> Optional[dict]:
        return await self._clarification.get_clarification_session(session_id)

    async def _get_preference_snapshot(
        self, session_id: str
    ) -> Optional[LearningPathPreferenceSnapshot]:
        return await self._clarification._get_preference_snapshot(session_id)

    async def _build_clarification_personalization_context(
        self, user_id: str
    ) -> dict[str, str]:
        return await self._clarification._build_clarification_personalization_context(user_id)

    async def _resolve_snapshot_node_labels(
        self,
        snapshot: Optional[LearningPathPreferenceSnapshot],
        subject_key: str,
        user_id: Optional[str],
    ) -> dict[str, list[str]]:
        return await self._clarification._resolve_snapshot_node_labels(
            snapshot,
            subject_key,
            user_id,
        )

    async def _build_snapshot_summary(
        self,
        snapshot: Optional[LearningPathPreferenceSnapshot],
        subject_key: str,
        user_id: Optional[str],
    ) -> str:
        return await self._clarification._build_snapshot_summary(
            snapshot,
            subject_key,
            user_id,
        )

    async def _collect_clarification_state(
        self,
        detail: dict,
        snapshot: Optional[LearningPathPreferenceSnapshot],
    ) -> dict[str, Any]:
        return await self._clarification._collect_clarification_state(detail, snapshot)

    async def stream_start_clarification_session(self, user_id: str, subject_key: str):
        async for event in self._clarification.stream_start_clarification_session(user_id, subject_key):
            yield event

    async def stream_reply_clarification_session(self, session_id: str, content: str):
        async for event in self._clarification.stream_reply_clarification_session(session_id, content):
            yield event

    async def reply_clarification_session(self, session_id: str, content: str) -> dict:
        return await self._clarification.reply_clarification_session(session_id, content)

    async def get_ready_check(self, session_id: str) -> dict:
        return await self._clarification.get_ready_check(session_id)

    async def build_generation_context(self, session_id: str) -> dict:
        return await self._clarification.build_generation_context(session_id)

    async def generate_learning_path_from_session(self, session_id: str) -> dict:
        return await self._clarification.generate_learning_path_from_session(session_id)

    def _recompute_progress(path: LearningPath) -> None:
        LearningPathCRUDService._recompute_progress(path)

    async def upsert_learning_path(
        self, path: LearningPath,
        subject_key: Optional[str] = None, version: Optional[int] = None,
        version_name: Optional[str] = None, is_active: Optional[bool] = None
    ) -> None:
        await self._crud.upsert_learning_path(path, subject_key, version, version_name, is_active)

    async def get_learning_path(self, path_id: str) -> Optional[LearningPath]:
        return await self._crud.get_learning_path(path_id)

    async def get_learning_path_subject_key(self, path_id: str) -> str:
        return await self._crud.get_learning_path_subject_key(path_id)

    async def list_user_paths(
        self, user_id: str, subject_key: Optional[str] = None,
        include_archived: bool = False
    ) -> list:
        return await self._crud.list_user_paths(user_id, subject_key, include_archived)

    async def delete_user_paths(self, user_id: str, subject_key: Optional[str] = None) -> int:
        return await self._crud.delete_user_paths(user_id, subject_key)

    async def get_active_learning_path(self, user_id: str, subject_key: str) -> Optional[LearningPath]:
        return await self._crud.get_active_learning_path(user_id, subject_key)

    async def activate_version(self, user_id: str, subject_key: str, version: int) -> Optional[LearningPath]:
        return await self._crud.activate_version(user_id, subject_key, version)

    async def archive_version(
        self, user_id: str, subject_key: str, version: int, permanent_delete: bool = False
    ) -> bool:
        return await self._crud.archive_version(user_id, subject_key, version, permanent_delete)

    async def rename_version(self, user_id: str, subject_key: str, version: int, new_name: str) -> bool:
        return await self._crud.rename_version(user_id, subject_key, version, new_name)

    async def update_path_progress(
        self, path_id: str, day: int, task_id: str, completed: bool
    ) -> Optional[LearningPath]:
        return await self._crud.update_path_progress(path_id, day, task_id, completed)

    async def generate_learning_path(
        self,
        user_id: str,
        goal: str,
        subject_key: str = "python",
        total_days: int = 14,
        daily_minutes: int = 60,
        level: str = "初级",
        ability_tags: Optional[Dict[str, int]] = None,
        version_name: Optional[str] = None,
        *,
        target_node_ids: Optional[List[str]] = None,
        known_node_ids: Optional[List[str]] = None,
        avoid_node_ids: Optional[List[str]] = None,
        snapshot_labels_text: str = "无",
        supplement_text: str = "无",
    ) -> Optional[LearningPath]:
        """
        生成AI学习路线（新版本）

        Args:
            user_id: 用户ID
            goal: 学习目标
            subject_key: 学科标识 (python, machine_learning, advanced_math)
            total_days: 总天数
            daily_minutes: 每日学习时间（分钟）
            level: 当前水平
            ability_tags: 能力标签
            version_name: 版本名称（可选）
            target_node_ids: 用户标记为想重点学习的技术树节点
            known_node_ids: 用户标记为已掌握的技术树节点
            avoid_node_ids: 用户标记为暂不学习的技术树节点

        Returns:
            生成的学习路线，或None（如果生成失败）
        """
        # 获取学科配置，默认为Python
        subject_config = SUBJECT_CONFIGS.get(subject_key, SUBJECT_CONFIGS["python"])

        # 版本管理：查询当前最大版本号并停用旧版本
        try:
            import sqlalchemy as sa

            # 1. 查询当前最大版本号
            max_version_stmt = (
                select(sa.func.coalesce(sa.func.max(UserLearningPath.version), 0))
                .where(
                    UserLearningPath.user_id == uuid.UUID(user_id),
                    UserLearningPath.subject_key == subject_key
                )
            )
            result = await self.db.execute(max_version_stmt)
            max_version = result.scalar_one()
            next_version = max_version + 1

            # 2. 停用该用户该学科的所有激活版本
            await self.db.execute(
                sa.update(UserLearningPath)
                .where(
                    UserLearningPath.user_id == uuid.UUID(user_id),
                    UserLearningPath.subject_key == subject_key,
                    UserLearningPath.is_active == True
                )
                .values(is_active=False)
            )
            await self.db.commit()

            # 设置版本名称
            final_version_name = version_name or f"学习计划 v{next_version}"
        except Exception as e:
            logger.warning(f"[AI Path] 版本管理逻辑执行失败，使用默认版本1: {e}")
            next_version = 1
            final_version_name = version_name or "学习计划 v1"

        # 每次生成前重置原因/摘要
        self.last_generation_reason = None
        self.last_generation_thinking_summary = None
        llm_service = await self._get_llm_service(user_id)

        if not llm_service:
            logger.info(f"[AI Path] 用户 {user_id} 无LLM配置，终止生成")
            if not self.last_generation_reason:
                self.last_generation_reason = "未找到可用的 LLM 配置（用户未配置且系统默认未启用/未提供系统 Key）"
            return None

        try:
            # 格式化能力标签详情
            ability_tags_detail = "暂无能力评估数据"
            weak_areas = "暂无明显弱点"

            stats_service = StatsService(self.db)
            effective_ability_tags = ability_tags or await stats_service.get_ability_data(user_id)

            if effective_ability_tags:
                # 格式化能力标签列表
                ability_lines = []
                weak_lines = []
                for tag, score in sorted(effective_ability_tags.items(), key=lambda x: x[1]):
                    ability_lines.append(f"  - {tag}: {score}/100")
                    # 收集弱点领域（分数 < 60）
                    if score < 60:
                        weak_lines.append(f"  - {tag}: 当前掌握度 {score}%，需要加强练习")

                if ability_lines:
                    ability_tags_detail = "\n".join(ability_lines)
                if weak_lines:
                    weak_areas = "\n".join(weak_lines)

            learning_stats = "暂无学习记录"
            try:
                stats = await stats_service.get_user_stats(user_id)
                learning_stats = (
                    f"- 已完成题目: {stats.completed_exercises}/{stats.total_exercises}\n"
                    f"- 平均正确率: {int(stats.accuracy_rate * 100)}%\n"
                    f"- 连续学习: {stats.streak_days} 天\n"
                    f"- 最近7天学习时长: {stats.total_study_minutes} 分钟"
                )
            except Exception as e:
                logger.warning(f"[AI Path] 获取用户学习统计失败: {e}")

            # 分阶段生成：首次只生成 min(total_days, 2) 天，后续通过 extend 接口按需续写解锁
            phase_days = min(int(total_days), 2)

            # 构建学科约束与示例段落
            from app.services.ai_learning_path_defaults import build_subject_tree_prompt_context

            scope_constraints = subject_config.scope_constraints or "无额外约束。"
            subject_tree_guidance = build_subject_tree_prompt_context(
                subject_key=subject_key,
                target_node_ids=target_node_ids,
                known_node_ids=known_node_ids,
                avoid_node_ids=avoid_node_ids,
            )
            task_examples_section = (
                f"## 任务表达示例（参考）\n{subject_config.task_examples}\n"
                if subject_config.task_examples else ""
            )

            # 根据难度级别构建生成指引
            if level == "高级":
                difficulty_guidance = (
                    "用户是高级学习者，严禁从基础概念开始！直接给出进阶/高级内容。"
                    "任务难度应该从中等偏上开始，迅速进入深度/实战内容。"
                    "跳过所有入门级和基础级的知识点。"
                )
            elif level == "中级":
                difficulty_guidance = (
                    "用户有一定基础，跳过纯入门内容，从中等难度开始。"
                    "可以快速回顾核心概念但不需要详细讲解基础，重点放在实践和进阶。"
                )
            else:
                difficulty_guidance = (
                    "用户是初学者，从基础概念开始，难度循序渐进，步子要小。"
                )

            prompt_registry = get_prompt_registry()
            prompt_definition = prompt_registry.get_definition("ai_learning_path.generate")
            messages = prompt_registry.render_messages(
                "ai_learning_path.generate",
                {
                    "subject_name": subject_config.name,
                    "subject_context": subject_config.context,
                    "question_distribution": subject_config.distribution,
                    "subject_scope_constraints": scope_constraints,
                    "subject_tree_guidance": subject_tree_guidance,
                    "subject_task_examples_section": task_examples_section,
                    "level": level,
                    "difficulty_guidance": difficulty_guidance,
                    "ability_tags_detail": ability_tags_detail,
                    "weak_areas": weak_areas,
                    "learning_stats": learning_stats,
                    "goal": goal,
                    "overall_total_days": total_days,
                    "generate_days": phase_days,
                    "daily_minutes": daily_minutes,
                    "snapshot_labels_text": snapshot_labels_text,
                    "supplement_text": supplement_text,
                },
            )
            prompt = messages[-1]["content"]

            logger.info(
                f"[AI Path] 开始为用户 {user_id} 生成学习路线 "
                f"(subject_key={subject_key}, subject_name={subject_config.name}, "
                f"目标: {goal}, {total_days}天)"
            )
            logger.info(
                f"[AI Path] 学科约束: scope_constraints长度={len(scope_constraints)}字符, "
                f"task_examples长度={len(task_examples_section)}字符, "
                f"tree_guidance长度={len(subject_tree_guidance)}字符"
            )
            logger.debug(f"[AI Path] 提示词长度: {len(prompt)} 字符")

            # 学习路线生成可能比普通对话耗时更久，单独提高超时阈值，避免 ReadTimeout 导致回退模板
            # 学习路线生成可能比普通对话耗时更久，单独提高超时阈值，避免 ReadTimeout 导致回退模板
            effective_timeout = max(int(getattr(llm_service, "timeout", 30)), 120)
            # 生成学习路线非常依赖"严格 JSON 输出"，因此这里做两次尝试：
            # - 第一次：尽量启用 response_format=json_object（若网关不支持则降级）
            # - 第二次：温度更低 + 更严格解析（避免偶发空响应/不可见字符/前后夹杂文字）
            data: Optional[dict] = None
            last_error: Optional[Exception] = None

            for attempt in range(2):
                temperature = 0.2 if attempt == 0 else 0.0
                raw_content = ""
                finish_reason = None

                try:
                    use_json_mode = (attempt == 0)
                    effective_max_tokens = self._resolve_llm_max_tokens(llm_service, prompt_definition.max_tokens)
                    raw_content, finish_reason = await llm_service.raw_completion(
                        messages,
                        temperature=temperature if temperature is not None else prompt_definition.temperature,
                        max_tokens=effective_max_tokens,
                        timeout_override=effective_timeout,
                        use_json_mode=use_json_mode,
                    )

                    logger.debug(
                        f"[AI Path] LLM响应长度: {len(str(raw_content or ''))} 字符 "
                        f"(attempt={attempt + 1}, finish_reason={finish_reason})"
                    )

                    data = parse_llm_json(str(raw_content or ""))
                    # 成功解析后，优先提取可公开展示的思考摘要
                    thinking_summary = str(data.get("thinking_summary") or "").strip()
                    if thinking_summary:
                        self.last_generation_thinking_summary = thinking_summary
                    break

                except json.JSONDecodeError as e:
                    last_error = e
                    logger.error(f"[AI Path] JSON解析失败(attempt={attempt + 1}): {e}")
                    logger.error(
                        f"[AI Path] 原始响应repr前200字符: {repr(str(raw_content or '')[:200])}"
                    )
                    if attempt == 0:
                        continue
                    self.last_generation_reason = truncate_reason(
                        f"AI 返回内容无法解析为 JSON：{e}；"
                        f"finish_reason={finish_reason}；"
                        f"model={llm_service.model_name}；"
                        f"base_url={llm_service.api_base_url}；"
                        f"max_tokens={effective_max_tokens}；"
                        f"json_mode={use_json_mode}；"
                        f"原始内容repr前200={repr(str(raw_content or '')[:200])}"
                    )
                    raise

                except Exception as e:
                    last_error = e
                    if attempt == 0:
                        logger.warning(
                            f"[AI Path] 生成请求失败，将重试一次：{type(e).__name__}: {e}"
                        )
                        continue
                    raise

            if data is None:
                raise last_error or Exception("LLM did not return parsable JSON")
            # 允许模型返回公开可展示的规划摘要
            if isinstance(data, dict):
                thinking_summary = str(data.get("thinking_summary") or "").strip()
                if thinking_summary:
                    self.last_generation_thinking_summary = thinking_summary

            # 构建学习路线
            days = []
            start_date = datetime.now()

            for day_data in data.get("days", []):
                day_num = day_data.get("day", len(days) + 1)
                day_date = start_date + timedelta(days=day_num - 1)

                tasks = []
                total_day_minutes = 0

                for task_data in day_data.get("tasks", []):
                    task = LearningTask(
                        id=task_data.get("id", f"task_{day_num}_{len(tasks)+1}"),
                        title=task_data.get("title", "学习任务"),
                        description=task_data.get("description", ""),
                        type=task_data.get("type", "concept"),
                        duration_minutes=task_data.get("duration_minutes", 20),
                        resources=task_data.get("resources", [])
                    )
                    tasks.append(task)
                    total_day_minutes += task.duration_minutes

                day = LearningDay(
                    day=day_num,
                    date=day_date.strftime("%Y-%m-%d"),
                    theme=day_data.get("theme", f"第{day_num}天学习"),
                    tasks=tasks,
                    total_minutes=total_day_minutes,
                    milestone=day_data.get("milestone")
                )
                days.append(day)

            path_id = str(uuid.uuid4())

            path = LearningPath(
                id=path_id,
                user_id=user_id,
                goal=goal,
                # 注意：total_days 仍然保留用户期望总天数；days 这里只生成第一阶段
                total_days=total_days,
                daily_minutes=daily_minutes,
                level=level,
                created_at=datetime.now().isoformat(),
                days=days,
                generated_days=len(days),
                phase_size=2,
                source="ai"  # AI 生成
            )

            logger.info(f"[AI Path] 成功为用户 {user_id} 生成 {len(days)} 天的学习路线 (来源: AI)")

            # ── 内容漂移校验（非阻断，仅警告） ──────
            violations = _validate_generated_days_subject_fidelity(
                data.get("days", []), subject_key, subject_config.name
            )
            if violations:
                logger.warning(
                    "[AI Path] ⚠️ 检测到生成内容可能偏离学科范围 "
                    "(subject_key=%s): %s",
                    subject_key,
                    "; ".join(violations[:5]),
                )

            try:
                await self.upsert_learning_path(
                    path,
                    subject_key=subject_key,
                    version=next_version,
                    version_name=final_version_name,
                    is_active=True
                )
            except Exception as e:
                logger.error(f"[AI Path] 保存学习路线失败: {e}")
            return path

        except json.JSONDecodeError as e:
            logger.error(f"[AI Path] JSON解析错误，学习路线生成失败: {e}")
            if not self.last_generation_reason:
                self.last_generation_reason = truncate_reason(f"AI 返回内容无法解析为 JSON：{e}")
            return None

        except APITimeoutError as e:
            logger.error(f"[AI Path] LLM请求超时，学习路线生成失败: {e}")
            self.last_generation_reason = truncate_reason(
                f"LLM 请求超时（timeout={locals().get('effective_timeout', 'unknown')}s）：{e}；"
                f"可尝试增大 backend/config.toml 的 [llm.defaults].timeout"
            )
            return None

        except LLMServiceError as e:
            logger.error(f"[AI Path] LLM服务错误，学习路线生成失败: {e}")
            self.last_generation_reason = truncate_reason(f"LLM 服务调用失败：{e}")
            return None

        except Exception as e:
            logger.exception(f"[AI Path] 未知错误，学习路线生成失败: {e}")
            self.last_generation_reason = truncate_reason(f"未知错误导致 AI 生成失败：{type(e).__name__}: {e}")
            return None

    async def extend_learning_path(
        self,
        path_id: str,
        chunk_days: int = 7,
    ) -> Optional[LearningPath]:
        """
        分阶段续写学习路线：仅在当前已生成阶段全部完成后，才允许生成后续天数。

        - 成功：在原路线末尾追加新 days，并更新 generated_days / progress_percent / current_day
        - 失败：抛出异常，由路由层决定如何向前端透传 reason
        """
        # 每次续写前重置原因/摘要
        self.last_generation_reason = None
        self.last_generation_thinking_summary = None

        path = await self.get_learning_path(path_id)
        if path is None:
            return None

        # 兼容历史数据：保持 generated_days 与 days 数一致
        if not path.generated_days:
            path.generated_days = len(path.days or [])

        # 重新计算一次进度，避免前端未及时调用 progress 更新导致“误判未完成”
        self._recompute_progress(path)

        if len(path.days or []) >= int(path.total_days):
            self.last_generation_reason = "学习路线已完整生成，无需续写"
            return path

        start_day = max((d.day for d in path.days), default=0) + 1
        phase_days = max(int(chunk_days or 0), 1)
        end_day = min(int(path.total_days), start_day + phase_days - 1)
        if end_day < start_day:
            self.last_generation_reason = "学习路线已完整生成，无需续写"
            return path

        llm_service = await self._get_llm_service(path.user_id)
        if not llm_service:
            raise LLMServiceError("未找到可用的 LLM 配置，无法续写")

        stats_service = StatsService(self.db)
        effective_ability_tags = await stats_service.get_ability_data(path.user_id)

        ability_tags_detail = "暂无能力评估数据"
        weak_areas = "暂无明显弱点"
        if effective_ability_tags:
            ability_lines = []
            weak_lines = []
            for tag, score in sorted(effective_ability_tags.items(), key=lambda x: x[1]):
                ability_lines.append(f"  - {tag}: {score}/100")
                if score < 60:
                    weak_lines.append(f"  - {tag}: 当前掌握度 {score}%，需要加强练习")
            if ability_lines:
                ability_tags_detail = "\n".join(ability_lines)
            if weak_lines:
                weak_areas = "\n".join(weak_lines)

        learning_stats = "暂无学习记录"
        try:
            stats = await stats_service.get_user_stats(path.user_id)
            learning_stats = (
                f"- 已完成题目: {stats.completed_exercises}/{stats.total_exercises}\n"
                f"- 平均正确率: {int(stats.accuracy_rate * 100)}%\n"
                f"- 连续学习: {stats.streak_days} 天\n"
                f"- 最近7天学习时长: {stats.total_study_minutes} 分钟"
            )
        except Exception as e:
            logger.warning(f"[AI Path] 获取用户学习统计失败(续写): {e}")

        # 为了控制 prompt 长度，只提供最近 3 天的摘要即可承接节奏
        existing_days_snapshot = [d.model_dump() for d in (path.days or [])[-3:]]
        existing_days_json = json.dumps(existing_days_snapshot, ensure_ascii=False)

        # 获取学科配置以注入范围约束
        subject_key = await self.get_learning_path_subject_key(path_id)
        subject_config = SUBJECT_CONFIGS.get(subject_key, SUBJECT_CONFIGS["python"])
        from app.services.ai_learning_path_defaults import build_subject_tree_prompt_context

        scope_constraints = subject_config.scope_constraints or "无额外约束。"
        subject_tree_guidance = build_subject_tree_prompt_context(subject_key=subject_key)
        task_examples_section = (
            f"## 任务表达示例（参考）\n{subject_config.task_examples}\n"
            if subject_config.task_examples else ""
        )

        prompt_registry = get_prompt_registry()
        prompt_definition = prompt_registry.get_definition("ai_learning_path.extend")
        messages = prompt_registry.render_messages(
            "ai_learning_path.extend",
            {
                "level": path.level or "初级",
                "goal": path.goal,
                "total_days": path.total_days,
                "daily_minutes": path.daily_minutes,
                "ability_tags_detail": ability_tags_detail,
                "weak_areas": weak_areas,
                "existing_days_json": existing_days_json,
                "learning_stats": learning_stats,
                "subject_scope_constraints": scope_constraints,
                "subject_tree_guidance": subject_tree_guidance,
                "subject_task_examples_section": task_examples_section,
                "start_day": start_day,
                "end_day": end_day,
            },
        )
        prompt = messages[-1]["content"]

        logger.info(
            f"[AI Path] 开始为路线 {path.id} 续写学习路线 (第{start_day}天-第{end_day}天)"
        )

        effective_timeout = max(int(getattr(llm_service, "timeout", 30)), 120)
        # 续写同样做两次尝试
        data: Optional[dict] = None
        last_error: Optional[Exception] = None
        for attempt in range(2):
            temperature = 0.2 if attempt == 0 else 0.0
            raw_content = ""
            finish_reason = None
            try:
                use_json_mode = (attempt == 0)
                effective_max_tokens = self._resolve_llm_max_tokens(llm_service, prompt_definition.max_tokens)
                raw_content, finish_reason = await llm_service.raw_completion(
                    messages,
                    temperature=temperature if temperature is not None else prompt_definition.temperature,
                    max_tokens=effective_max_tokens,
                    timeout_override=effective_timeout,
                    use_json_mode=use_json_mode,
                )

                data = parse_llm_json(str(raw_content or ""))
                thinking_summary = str(data.get("thinking_summary") or "").strip()
                if thinking_summary:
                    self.last_generation_thinking_summary = thinking_summary
                break
            except json.JSONDecodeError as e:
                last_error = e
                logger.error(f"[AI Path] 续写 JSON解析失败(attempt={attempt + 1}): {e}")
                logger.error(
                    f"[AI Path] 续写 原始响应repr前200字符: {repr(str(raw_content or '')[:200])}"
                )
                if attempt == 0:
                    continue
                self.last_generation_reason = truncate_reason(
                    f"AI 续写返回内容无法解析为 JSON：{e}；"
                    f"finish_reason={finish_reason}；"
                    f"model={llm_service.model_name}；"
                    f"base_url={llm_service.api_base_url}；"
                    f"max_tokens={effective_max_tokens}；"
                    f"json_mode={use_json_mode}；"
                    f"原始内容repr前200={repr(str(raw_content or '')[:200])}"
                )
                raise
            except Exception as e:
                last_error = e
                if attempt == 0:
                    logger.warning(
                        f"[AI Path] 续写请求失败，将重试一次：{type(e).__name__}: {e}"
                    )
                    continue
                raise

        if data is None:
            raise last_error or Exception("LLM did not return parsable JSON")
        new_days_data = (data or {}).get("days") or []
        if not isinstance(new_days_data, list) or not new_days_data:
            raise json.JSONDecodeError("days is empty", doc=str(data)[:200], pos=0)

        # 计算起始日期：优先沿用已有第1天日期，保证续写日期连续
        start_date = datetime.now()
        try:
            if path.days and path.days[0].date:
                start_date = datetime.fromisoformat(path.days[0].date)
        except Exception:
            start_date = datetime.now()

        existing_day_numbers = {d.day for d in (path.days or [])}
        appended_days: List[LearningDay] = []

        for day_data in new_days_data:
            if not isinstance(day_data, dict):
                continue
            day_num = int(day_data.get("day", 0) or 0)
            if day_num <= 0:
                continue
            if day_num in existing_day_numbers:
                # 不重复追加；但这种情况通常意味着模型没按要求续写
                continue
            if day_num < start_day or day_num > end_day:
                continue

            day_date = start_date + timedelta(days=day_num - 1)

            tasks = []
            total_day_minutes = 0
            for task_data in (day_data.get("tasks") or []):
                if not isinstance(task_data, dict):
                    continue
                task = LearningTask(
                    id=task_data.get("id", f"task_{day_num}_{len(tasks) + 1}"),
                    title=task_data.get("title", "学习任务"),
                    description=task_data.get("description", ""),
                    type=task_data.get("type", "concept"),
                    duration_minutes=task_data.get("duration_minutes", 20),
                    resources=task_data.get("resources", []),
                )
                tasks.append(task)
                total_day_minutes += task.duration_minutes

            day = LearningDay(
                day=day_num,
                date=day_date.strftime("%Y-%m-%d"),
                theme=day_data.get("theme", f"第{day_num}天学习"),
                tasks=tasks,
                total_minutes=total_day_minutes,
                milestone=day_data.get("milestone"),
            )
            appended_days.append(day)
            existing_day_numbers.add(day_num)

        if not appended_days:
            raise json.JSONDecodeError(
                "no valid days appended", doc=str(data)[:200], pos=0
            )

        # 保持 days 按 day 升序
        path.days.extend(appended_days)
        path.days.sort(key=lambda d: d.day)
        path.generated_days = len(path.days)
        self._recompute_progress(path)

        await self.upsert_learning_path(path)
        logger.info(
            f"[AI Path] 续写成功：路线 {path.id} 追加 {len(appended_days)} 天（当前已生成 {path.generated_days}/{path.total_days}）"
        )
        return path

    def _generate_default_path(
        self,
        user_id: str,
        goal: str,
        total_days: int,
        daily_minutes: int,
        subject_key: str = "python"
    ) -> LearningPath:
        """[DEPRECATED] 静态模板路线，generate_learning_path 已不再调用。"""
        days = []
        start_date = datetime.now()

        # 根据学科获取默认主题
        subject_config = SUBJECT_CONFIGS.get(subject_key, SUBJECT_CONFIGS["python"])
        themes = list(subject_config.default_themes)

        for i in range(min(total_days, len(themes) * 2)):
            theme_idx = i % len(themes)
            theme_name, subtopics = themes[theme_idx]
            day_date = start_date + timedelta(days=i)

            tasks = []
            time_per_task = daily_minutes // 3

            for j, subtopic in enumerate(subtopics[:3]):
                from app.services.ai_learning_path_defaults import build_default_task_payload

                task_type = ["concept", "exercise", "review"][j % 3]
                task_payload = build_default_task_payload(
                    subject_key=subject_key,
                    subject_name=subject_config.name,
                    theme_name=theme_name,
                    subtopic=subtopic,
                    task_type=task_type,
                )
                task = LearningTask(
                    id=f"task_{i+1}_{j+1}",
                    title=task_payload["title"],
                    description=task_payload["description"],
                    type=task_type,
                    duration_minutes=time_per_task,
                    resources=task_payload["resources"]
                )
                tasks.append(task)

            milestone = None
            if (i + 1) % 5 == 0:
                milestone = f"完成第{(i+1)//5}阶段学习"

            day = LearningDay(
                day=i + 1,
                date=day_date.strftime("%Y-%m-%d"),
                theme=theme_name,
                tasks=tasks,
                total_minutes=sum(t.duration_minutes for t in tasks),
                milestone=milestone
            )
            days.append(day)

        path_id = str(uuid.uuid4())

        return LearningPath(
            id=path_id,
            user_id=user_id,
            goal=goal,
            total_days=total_days,
            daily_minutes=daily_minutes,
            created_at=datetime.now().isoformat(),
            days=days,
            generated_days=len(days),
            phase_size=7,
        )

    async def _get_llm_service(self, user_id: str) -> Optional[LLMService]:
        """获取用户的LLM服务实例，如无则使用系统默认"""
        try:
            user_uuid = uuid.UUID(str(user_id))
            stmt = (
                select(UserLLMConfig)
                .where(
                    UserLLMConfig.user_id == user_uuid,
                    UserLLMConfig.is_active == True,
                )
                .order_by(UserLLMConfig.updated_at.desc(), UserLLMConfig.created_at.desc())
            )
            result = await self.db.execute(stmt)
            configs = result.scalars().all()
            config = configs[0] if configs else None

            if config:
                if len(configs) > 1:
                    logger.warning(
                        "[AI Path] 用户 %s 存在多条激活 LLM 配置，将使用最近更新的一条: selected=%s total=%s",
                        user_id,
                        config.id,
                        len(configs),
                    )

                decrypted_key = decrypt_api_key(config.api_key_encrypted)
                llm_service = LLMServiceFactory.create_from_db_config(config, decrypted_key)
                setattr(llm_service, "config_source", "user")
                setattr(llm_service, "user_llm_config_id", str(config.id))
                setattr(
                    llm_service,
                    "user_llm_config_updated_at",
                    config.updated_at.isoformat() if getattr(config, "updated_at", None) else None,
                )
                logger.info(
                    "[AI Path] 使用用户 LLM 配置: user_id=%s config_id=%s updated_at=%s model=%s base_url=%s timeout=%s max_tokens=%s",
                    user_id,
                    config.id,
                    config.updated_at,
                    config.model_name,
                    config.api_base_url,
                    config.timeout_seconds,
                    config.max_tokens,
                )
                return llm_service

            # 用户无配置，尝试使用系统默认 DeepSeek
            if settings.use_system_llm and settings.deepseek_api_key:
                llm_service = LLMServiceFactory.create(
                    api_base_url=settings.deepseek_base_url,
                    api_key=settings.deepseek_api_key,
                    model_name=settings.deepseek_model
                )
                setattr(llm_service, "config_source", "system")
                logger.info(
                    "[AI Path] 用户 %s 未命中个人配置，回退系统 LLM: model=%s base_url=%s",
                    user_id,
                    settings.deepseek_model,
                    settings.deepseek_base_url,
                )
                return llm_service

            self.last_generation_reason = truncate_reason(
                f"未找到可用LLM配置：user_id={user_id}；"
                f"use_system_llm={getattr(settings, 'use_system_llm', None)}；"
                f"deepseek_api_key_set={bool(getattr(settings, 'deepseek_api_key', None))}"
            )
            logger.warning("[AI Path] %s", self.last_generation_reason)
            return None

        except Exception as e:
            logger.warning(f"[AI Path] 获取LLM配置失败: user_id={user_id} error={type(e).__name__}: {e}")
            # 发生异常时也尝试使用系统默认
            if settings.use_system_llm and settings.deepseek_api_key:
                try:
                    llm_service = LLMServiceFactory.create(
                        api_base_url=settings.deepseek_base_url,
                        api_key=settings.deepseek_api_key,
                        model_name=settings.deepseek_model
                    )
                    setattr(llm_service, "config_source", "system")
                    logger.info(
                        "[AI Path] 获取用户配置失败，回退系统 LLM: user_id=%s model=%s base_url=%s",
                        user_id,
                        settings.deepseek_model,
                        settings.deepseek_base_url,
                    )
                    return llm_service
                except Exception:
                    pass

            self.last_generation_reason = truncate_reason(
                f"获取LLM配置失败且系统默认不可用：{type(e).__name__}: {e}"
            )
            return None
