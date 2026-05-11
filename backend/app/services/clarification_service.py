"""
澄清会话服务

从 ai_learning_path_service.py 拆分而来，包含所有与「澄清会话」相关的方法:
- 会话创建、回复、流式处理
- 偏好快照管理
- 就绪检查与生成上下文构建
- 规则 / LLM 澄清状态收集与合并
"""
import json
import uuid
import logging
import re
from datetime import datetime, timezone
from typing import Optional, Any, AsyncGenerator

from openai import APITimeoutError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..prompts import get_prompt_registry
from ..services.llm_service import LLMService, LLMServiceFactory, LLMServiceError
from ..services.encryption import decrypt_api_key
from ..models.llm_config import UserLLMConfig
from ..services.stats_service import StatsService
from ..services.learning_path_models import (
    SubjectConfig,
    SUBJECT_CONFIGS,
    LearningPath,
    _MAX_PROACTIVE_CLARIFICATION_TURNS,
    _OPEN_SUPPLEMENT_MODE,
    _CONFIRMATION_HINTS,
    _CURRENT_LEVEL_HINTS,
    _TARGET_SCOPE_HINTS,
    _TIME_BUDGET_HINTS,
)
from ..services.llm_json_utils import (
    parse_llm_json,
    normalize_clarification_text,
)
from ..models.learning_path_workbench import (
    LearningPathGenerationContext,
    LearningPathPreferenceSnapshot,
    LearningPathClarificationSession,
    LearningPathClarificationMessage,
)
from ..core.config import settings

try:
    from openai import AsyncOpenAI
except ImportError:
    AsyncOpenAI = None

logger = logging.getLogger(__name__)


# ── 补充信息格式化工具 ──────────────────────────────────────────────
_QUESTION_PREFIX_RE = re.compile(
    r'^(你希望|你觉得|你认为|你打算|你想要?|请问|请|那么|那)',
)
_QUESTION_SPLIT_RE = re.compile(
    r'(?:放在|集中在|侧重于|侧重|偏向于|偏向|聚焦于|聚焦在|聚焦)'
    r'(?:哪些|哪个|哪种|什么|哪)',
)
_QUESTION_TAIL_RE = re.compile(
    r'(?:是什么|有哪些|是哪些|怎么样|如何|怎样|是怎样的|呢|吗|吧|呀)[？?]*$',
)


def _extract_supplement_label(question: str) -> str:
    """从 AI 澄清问题中提取简短的主题标签。

    例: "你希望数据管道构建的学习重点放在哪些具体工具或技术上？"
      → "数据管道构建的学习重点"
    """
    text = re.sub(r'[？?！!。.]+$', '', question.strip())
    text = _QUESTION_PREFIX_RE.sub('', text)

    # 尝试在 "放在哪些" 等疑问短语处截断
    m = _QUESTION_SPLIT_RE.search(text)
    if m:
        candidate = text[:m.start()].strip()
        if len(candidate) >= 2:
            return candidate

    # 尝试去除尾部疑问词
    text = _QUESTION_TAIL_RE.sub('', text).strip()

    if len(text) > 25:
        text = text[:25]
    return text if text else question[:20]


def _format_supplement_display(supplement_dict: dict[str, str]) -> str:
    """将 {问题: 回答} 字典转换为可读的 '标签：回答' 格式。

    例: {"你希望…？": "云平台服务"} → "数据管道构建的学习重点：云平台服务"
    """
    if not supplement_dict:
        return ""
    parts: list[str] = []
    for question, answer in supplement_dict.items():
        label = _extract_supplement_label(question)
        parts.append(f"{label}：{answer}")
    return "，".join(parts)


class ClarificationService:
    """澄清会话管理服务"""

    def __init__(self, db: AsyncSession, parent_service):
        """
        Args:
            db: 数据库会话
            parent_service: AILearningPathService 实例引用，用于调用 _get_llm_service / generate_learning_path
        """
        self.db = db
        self._parent = parent_service

    async def start_clarification_session(self, user_id: str, subject_key: str) -> dict:
        """创建最小澄清会话，并返回首轮 AI 提问。"""
        await self._parent.get_active_subject_skill_map(subject_key)

        session = LearningPathClarificationSession(
            user_id=uuid.UUID(user_id),
            subject_key=subject_key,
            status="collecting",
            current_turn_index=0,
        )
        self.db.add(session)
        await self.db.flush()

        subject_name = SUBJECT_CONFIGS.get(subject_key).name if subject_key in SUBJECT_CONFIGS else subject_key
        fallback_question = f"我们先聚焦学习目标。你这次最想优先掌握哪些 {subject_name} 能力？"
        fallback_quick_options = self._build_quick_options(1)
        opening_turn = await self._resolve_clarification_turn(
            user_id=str(session.user_id),
            subject_key=subject_key,
            turn_index=1,
            recent_messages=[],
            missing_items=["goal", "current_level", "target_scope", "time_budget", "confirmation"],
            ready_summary="尚未开始收集学习路径澄清信息。",
            fallback_question=fallback_question,
            fallback_quick_options=fallback_quick_options,
            snapshot_notes="",
        )

        first_message = LearningPathClarificationMessage(
            session_id=session.id,
            role="assistant",
            message_type="question",
            content=opening_turn["question"],
            structured_payload={"quick_options": opening_turn["quick_options"]},
            turn_index=1,
        )
        self.db.add(first_message)

        session.status = "awaiting_user"
        session.current_turn_index = 1
        await self.db.commit()

        return {
            "session_id": str(session.id),
            "user_id": str(session.user_id),
            "subject_key": session.subject_key,
            "status": session.status,
            "current_turn_index": session.current_turn_index,
            "messages": [
                {
                    "role": first_message.role,
                    "message_type": first_message.message_type,
                    "content": first_message.content,
                    "structured_payload": first_message.structured_payload,
                }
            ],
        }

    async def save_preference_snapshot(
        self,
        session_id: str,
        known_node_ids: list[str],
        target_node_ids: list[str],
        avoid_node_ids: list[str],
        free_text_notes: Optional[str] = None,
    ) -> dict:
        """保存会话关联的三态偏好快照。"""
        result = await self.db.execute(
            select(LearningPathClarificationSession).where(
                LearningPathClarificationSession.id == uuid.UUID(session_id)
            )
        )
        session = result.scalar_one_or_none()
        if session is None:
            raise ValueError("澄清会话不存在")

        snapshot_result = await self.db.execute(
            select(LearningPathPreferenceSnapshot).where(
                LearningPathPreferenceSnapshot.session_id == session.id
            )
        )
        snapshot = snapshot_result.scalar_one_or_none()

        if snapshot is None:
            snapshot = LearningPathPreferenceSnapshot(
                session_id=session.id,
                known_node_ids=known_node_ids,
                target_node_ids=target_node_ids,
                avoid_node_ids=avoid_node_ids,
                free_text_notes=free_text_notes,
            )
            self.db.add(snapshot)
        else:
            snapshot.known_node_ids = known_node_ids
            snapshot.target_node_ids = target_node_ids
            snapshot.avoid_node_ids = avoid_node_ids
            snapshot.free_text_notes = free_text_notes

        await self.db.commit()

        return {
            "session_id": session_id,
            "known_node_ids": snapshot.known_node_ids,
            "target_node_ids": snapshot.target_node_ids,
            "avoid_node_ids": snapshot.avoid_node_ids,
            "free_text_notes": snapshot.free_text_notes,
        }

    async def get_clarification_session(self, session_id: str) -> Optional[dict]:
        """获取澄清会话详情与消息历史。"""
        result = await self.db.execute(
            select(LearningPathClarificationSession).where(
                LearningPathClarificationSession.id == uuid.UUID(session_id)
            )
        )
        session = result.scalar_one_or_none()
        if session is None:
            return None

        message_result = await self.db.execute(
            select(LearningPathClarificationMessage)
            .where(LearningPathClarificationMessage.session_id == session.id)
            .order_by(
                LearningPathClarificationMessage.turn_index.asc(),
                LearningPathClarificationMessage.created_at.asc(),
            )
        )
        messages = message_result.scalars().all()

        return {
            "session_id": str(session.id),
            "user_id": str(session.user_id),
            "subject_key": session.subject_key,
            "status": session.status,
            "current_turn_index": session.current_turn_index,
            "messages": [
                {
                    "role": message.role,
                    "message_type": message.message_type,
                    "content": message.content,
                    "structured_payload": message.structured_payload,
                }
                for message in messages
            ],
        }

    @staticmethod
    def _serialize_clarification_session(
        session: LearningPathClarificationSession,
        messages: list[dict[str, Any]],
    ) -> dict[str, Any]:
        return {
            "session_id": str(session.id),
            "user_id": str(session.user_id),
            "subject_key": session.subject_key,
            "status": session.status,
            "current_turn_index": session.current_turn_index,
            "messages": messages,
        }

    @staticmethod
    def _is_uncertain_reply(text: str) -> bool:
        normalized = normalize_clarification_text(text)
        if not normalized:
            return True
        uncertainty_hints = (
            "不太确定",
            "不确定",
            "不是很确定",
            "不清楚",
            "不太清楚",
            "不知道",
            "帮我推荐",
            "你帮我推荐",
            "请你推荐",
            "请你帮我推荐",
            "你来推荐",
        )
        return any(hint in normalized for hint in uncertainty_hints)

    @staticmethod
    def _infer_slot_from_assistant_question(question: str) -> str | None:
        normalized = normalize_clarification_text(question)
        if not normalized:
            return None

        if any(keyword in normalized for keyword in ("目标", "达成", "最希望", "想通过")):
            return "goal"
        if any(
            keyword in normalized
            for keyword in (
                "侧重",
                "方向",
                "模块",
                "范围",
                "项目起点",
                "兴趣方向",
                "哪一块",
                "应用",
                "快速上手",
                "稳扎稳打",
                "边做边学",
                "先理解再动手",
                "实践任务",
            )
        ):
            return "target_scope"
        if any(
            keyword in normalized
            for keyword in ("每周", "每天", "投入", "时长", "时间安排", "工作日", "周末", "晚间", "学习频率")
        ):
            return "time_budget"
        if any(keyword in normalized for keyword in ("熟悉程度", "基础", "新手", "零基础", "接触过", "起点", "目前")):
            return "current_level"
        if any(keyword in normalized for keyword in ("确认", "没有问题", "可以直接生成", "直接生成")):
            return "confirmation"
        return None

    @staticmethod
    def _default_value_for_uncertain_slot(slot: str) -> str:
        if slot == "time_budget":
            return "时间安排暂不固定，可按每周 5-8 小时的弹性节奏稳步推进。"
        if slot == "target_scope":
            return "侧重方向可由 AI 推荐，先按基础概念与实践并重的路线规划。"
        return ""

    @staticmethod
    def _extract_target_scope_from_confirmation_question(question: str) -> str:
        normalized = normalize_clarification_text(question)
        if not normalized:
            return ""
        candidate = normalized
        candidate = re.sub(r"^(我理解|我先按目前理解梳理一版|为了帮你确认学习路线|为了帮你确认路线)[，,:：]?", "", candidate)
        candidate = re.sub(r"^(你希望|你想|是否希望|是不是想)", "", candidate)
        candidate = re.sub(r"(对吗|可以吗|是否合适|这样安排可以吗)[？?]?$", "", candidate)
        candidate = candidate.strip("，。；;：: ")
        if any(keyword in candidate for keyword in ("开始", "逐步", "路线", "侧重", "实践", "概念", "进阶")):
            return candidate
        return ""

    def _build_follow_up_question(self, subject_key: str, reply_content: str, next_turn_index: int) -> str:
        """最小澄清编排逻辑：根据轮次继续追问。"""
        reply_text = reply_content.strip()
        if next_turn_index == 2:
            return (
                f"收到，你当前关注 {subject_key} 的核心目标是：{reply_text[:30]}。"
                " 接下来请结合左侧技术树，标记你已掌握、想重点学习、以及暂不学习的部分。"
            )
        if next_turn_index == 3:
            return "很好。接下来请描述你目前的基础、薄弱点，以及你希望这条路线更偏向哪些主题。"
        if next_turn_index == 4:
            return "收到。请再补充你每天或每周大概能投入多少时间，以及你希望的学习节奏。"
        if next_turn_index == 5:
            return (
                f"我先按目前理解梳理一版：你在 {subject_key} 上已经给出了目标、基础和重点方向。"
                " 如果这些理解没有问题，可以直接点击下方的『🚀 直接生成计划』；如果还有遗漏，也可以继续补充。"
            )
        return "信息已收敛。你可以继续补充细节，或点击下方的『🚀 直接生成计划』开始生成。"

    @staticmethod
    def _build_quick_options(turn_index: int) -> list[str]:
        if turn_index <= 1:
            return ["构建自动化工具", "补强异步编程", "建立 pytest 测试习惯"]
        if turn_index == 2:
            return ["我先标记已掌握部分", "我先标记想重点学习", "我先标记暂不学习"]
        if turn_index == 3:
            return ["我是初学者", "异步和测试经验偏弱", "更想走工程化路线"]
        if turn_index == 4:
            return ["每天 45 分钟", "工作日晚间学习", "每周 5 小时"]
        return ["🚀 直接生成计划", "我还想补充日志处理", "我还想加入真实脚本拆解"]

    @staticmethod
    def _normalize_quick_options(raw_value: Any, fallback_quick_options: list[str]) -> list[str]:
        values: list[str] = []
        if isinstance(raw_value, list):
            candidates = raw_value
        elif isinstance(raw_value, str):
            candidates = re.split(r"[\n,，;；]+", raw_value)
        else:
            candidates = []

        seen: set[str] = set()
        for item in candidates:
            text = re.sub(r"^\s*[-*\d.)]+\s*", "", str(item or "").strip())
            if not text or text in seen:
                continue
            seen.add(text)
            values.append(text)

        if not values:
            return list(fallback_quick_options)

        return values[:3]

    async def _build_clarification_personalization_context(self, user_id: str) -> dict[str, str]:
        ability_tags_detail = "暂无能力画像数据"
        learning_stats = "暂无学习统计"

        stats_service = StatsService(self.db)

        try:
            ability_data = await stats_service.get_ability_data(user_id)
            if ability_data:
                ability_lines = [
                    f"- {tag}: {score}/100"
                    for tag, score in sorted(ability_data.items(), key=lambda item: item[1])
                ]
                if ability_lines:
                    ability_tags_detail = "\n".join(ability_lines)
        except Exception as exc:
            logger.warning("[AI Path] 获取澄清能力画像失败: user=%s error=%s", user_id, exc)

        try:
            stats = await stats_service.get_user_stats(user_id)
            weekly_activity = " / ".join(str(minutes) for minutes in stats.weekly_activity)
            learning_stats = (
                f"- 已完成题目: {stats.completed_exercises}/{stats.total_exercises}\n"
                f"- 平均正确率: {int(stats.accuracy_rate * 100)}%\n"
                f"- 连续学习: {stats.streak_days} 天\n"
                f"- 最近7天学习时长: {stats.total_study_minutes} 分钟\n"
                f"- 最近7天每日投入(分钟): {weekly_activity}"
            )
        except Exception as exc:
            logger.warning("[AI Path] 获取澄清学习统计失败: user=%s error=%s", user_id, exc)

        return {
            "ability_tags_detail": ability_tags_detail,
            "learning_stats": learning_stats,
        }

    @staticmethod
    def _build_open_supplement_fallback_question(state: dict[str, Any]) -> str:
        if state.get("ready"):
            return (
                f"我已经拿到足够信息，可以直接为你生成新版本。"
                f"如果你愿意，也可以先快速看一眼我的当前理解：{state['summary']}"
            )
        return f"已收敛，可继续补充。{state['summary']}。你可以继续补充细节，或直接进入生成。"

    @staticmethod
    def _build_open_supplement_dynamic_fallback_question(state: dict[str, Any], latest_user_reply: str) -> str:
        if state.get("ready"):
            return (
                f"现在信息已经足够，我可以直接为你生成新版本。"
                f"如果你还想微调重点，也可以在生成前再补充一句。当前理解是：{state['summary']}"
            )
        normalized_reply = re.sub(r"\s+", " ", (latest_user_reply or "").strip())
        if not normalized_reply:
            return f"已收敛，可继续补充。{state['summary']}。你可以继续补充细节，或直接进入生成。"

        excerpt = normalized_reply[:48]
        return f"收到补充：{excerpt}。基于这部分内容，你更希望我先细化哪一块？"

    @staticmethod
    def _build_open_supplement_dynamic_quick_options(latest_user_reply: str, ready: bool = False) -> list[str]:
        if ready:
            return ["🚀 直接生成新版本", "我再微调一下重点", "先看下当前理解"]
        normalized_reply = re.sub(r"[。！？；;，,、]", " ", (latest_user_reply or "").strip())
        if not normalized_reply:
            return ["🚀 直接生成计划", "继续补充细节", "换个角度细化"]

        if any(hint in normalized_reply for hint in _CONFIRMATION_HINTS):
            return ["🚀 直接生成计划", "继续补充细节"]

        segments = [segment.strip() for segment in re.split(r"\s+|和|与|以及|并且|并", normalized_reply) if segment.strip()]
        filtered = [segment for segment in segments if len(segment) >= 2 and segment not in {"补充", "推进", "围绕", "希望", "更想"}]
        deduped: list[str] = []
        for segment in filtered:
            option = f"先聊{segment[:10]}" if len(segment) <= 10 else segment[:10]
            if option not in deduped:
                deduped.append(option)
            if len(deduped) == 2:
                break

        if len(deduped) < 2:
            deduped.extend(["继续补充细节", "🚀 直接生成计划"])

        if "🚀 直接生成计划" not in deduped:
            deduped.append("🚀 直接生成计划")

        return deduped[:3]

    @staticmethod
    def _should_continue_guided_clarification(state: dict[str, Any], current_turn: int) -> bool:
        missing_items = list(state.get("missing_items") or [])
        if not missing_items:
            return False
        if current_turn < _MAX_PROACTIVE_CLARIFICATION_TURNS:
            return True
        return any(item != "confirmation" for item in missing_items)

    @staticmethod
    def _build_post_soft_cap_guided_quick_options(subject_name: str, state: dict[str, Any]) -> list[str]:
        missing_items = list(state.get("missing_items") or [])
        if "goal" in missing_items:
            return [
                "先打好基础再深入",
                f"先做出一个可运行的 {subject_name} 示例",
                "先建立完整知识框架",
            ]
        if "current_level" in missing_items:
            return [
                "我是零基础，请从最基础带我开始",
                "我有 Python 基础，但这门方向刚接触",
                "我学过一点概念，但需要系统梳理",
            ]
        if "target_scope" in missing_items:
            return [
                "先讲基础概念和术语",
                "先带我跑通第一个示例",
                "先帮我理解完整学习路线",
            ]
        if "time_budget" in missing_items:
            return [
                "每周 3-5 小时",
                "每周 5-8 小时",
                "每周 8 小时以上",
            ]
        return [
            "我不太确定，请你推荐",
            "先从基础开始",
            "继续问我几个关键问题",
        ]

    def _build_post_soft_cap_guided_question(
        self,
        subject_key: str,
        state: dict[str, Any],
    ) -> str:
        subject_name = SUBJECT_CONFIGS.get(subject_key).name if subject_key in SUBJECT_CONFIGS else subject_key
        missing_items = list(state.get("missing_items") or [])
        if "goal" in missing_items:
            return (
                f"先别急着定具体模块，方向还可以慢慢收窄。"
                f"为了把这条 {subject_name} 学习路线排得更贴近你，你现在最希望先达成哪一种结果？"
            )
        if "current_level" in missing_items:
            return (
                f"不用担心说不专业，我会按你的起点来安排。"
                f"为了把这条 {subject_name} 路线的起步节奏放稳一些，你现在更接近哪种状态？"
            )
        if "target_scope" in missing_items:
            return (
                f"你还不用马上决定具体模块，我可以先陪你把范围缩小。"
                f"这条 {subject_name} 路线，你更希望我先把哪一块讲明白？"
            )
        if "time_budget" in missing_items:
            return (
                "这一步主要是帮你安排节奏，不需要特别精确。"
                "你目前比较接近哪种学习投入方式？"
            )
        return (
            f"我还差一点关键信息，就能把这条 {subject_name} 路线安排得更贴近你。"
            "你更希望我先帮你确认哪一块？"
        )

    @staticmethod
    def _build_open_supplement_structured_payload(
        state: dict[str, Any],
        quick_options: list[str],
    ) -> dict[str, Any]:
        return {
            "mode": _OPEN_SUPPLEMENT_MODE,
            "ready": state["ready"],
            "missing_items": state["missing_items"],
            "summary": state["summary"],
            "quick_options": quick_options,
        }

    @staticmethod
    def _extract_partial_streaming_question(raw_content: str) -> str:
        match = re.search(r'"question"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)', raw_content, re.DOTALL)
        if not match:
            return ""

        fragment = match.group(1)
        return (
            fragment
            .replace('\\"', '"')
            .replace("\\n", "\n")
            .replace("\\r", "")
            .replace("\\t", "\t")
            .replace("\\\\", "\\")
        )

    @staticmethod
    def _extract_partial_streaming_quick_options(raw_content: str) -> list[str]:
        match = re.search(r'"quick_options"\s*:\s*(\[[\s\S]*?\])', raw_content, re.DOTALL)
        if not match:
            return []

        try:
            parsed = json.loads(match.group(1))
        except Exception:
            return []

        if not isinstance(parsed, list):
            return []

        options: list[str] = []
        seen: set[str] = set()
        for item in parsed:
            text = normalize_clarification_text(str(item or ""))
            if not text or text in seen:
                continue
            seen.add(text)
            options.append(text)
        return options[:4]

    async def _stream_generate_clarification_turn(
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
    ) -> AsyncGenerator[dict[str, Any], None]:
        llm_service = await self._parent._get_llm_service(user_id)
        if not llm_service:
            yield {"type": "content", "content": fallback_question}
            yield {
                "type": "options",
                "quick_options": list(fallback_quick_options),
            }
            yield {
                "type": "done",
                "question": fallback_question,
                "quick_options": list(fallback_quick_options),
                "source": "fallback",
            }
            return

        subject_name = SUBJECT_CONFIGS.get(subject_key).name if subject_key in SUBJECT_CONFIGS else subject_key
        personalization = await self._build_clarification_personalization_context(user_id)
        prompt_registry = get_prompt_registry()
        prompt_definition = prompt_registry.get_definition("ai_learning_path.clarify_question")
        latest_user_reply = normalize_clarification_text(
            next(
                (
                    message.get("content", "")
                    for message in reversed(recent_messages)
                    if message.get("role") == "user"
                ),
                "",
            )
        )
        previous_assistant_question = normalize_clarification_text(
            next(
                (
                    message.get("content", "")
                    for message in reversed(recent_messages)
                    if message.get("role") == "assistant"
                ),
                "",
            )
        )
        messages = prompt_registry.render_messages(
            "ai_learning_path.clarify_question",
            {
                "subject_key": subject_key,
                "subject_name": subject_name,
                "turn_index": turn_index,
                "ready_summary": ready_summary or "暂无摘要。",
                "missing_items_json": json.dumps(missing_items, ensure_ascii=False),
                "completed_items_json": json.dumps(
                    [item for item in ("goal", "current_level", "target_scope", "time_budget", "confirmation") if item not in missing_items],
                    ensure_ascii=False,
                ),
                "generation_ready": "true" if len(missing_items) == 0 else "false",
                "ready_to_generate_hint": (
                    "信息已经足够，请停止继续发散，明确告诉用户现在可以直接生成新版本，并只提供生成或微调类选项。"
                    if len(missing_items) == 0
                    else "信息尚未完全收敛，请围绕缺失项继续追问。"
                ),
                "snapshot_notes": snapshot_notes or "无",
                "ability_tags_detail": personalization["ability_tags_detail"],
                "learning_stats": personalization["learning_stats"],
                "recent_messages_json": json.dumps(recent_messages[-6:], ensure_ascii=False, indent=2),
                "latest_user_reply": latest_user_reply or "无",
                "previous_assistant_question": previous_assistant_question or "无",
                "fallback_question": fallback_question,
                "fallback_quick_options_json": json.dumps(fallback_quick_options, ensure_ascii=False),
            },
        )

        effective_timeout = max(int(getattr(llm_service, "timeout", 30)), 45)
        raw_content = ""
        emitted_question = ""
        emitted_quick_options: list[str] = []
        effective_max_tokens = self._parent._resolve_llm_max_tokens(llm_service, prompt_definition.max_tokens)
        try:
            async for event in llm_service.raw_completion_stream(
                messages,
                temperature=prompt_definition.temperature,
                max_tokens=effective_max_tokens,
                timeout_override=effective_timeout,
            ):
                if event["type"] == "done":
                    break
                delta_content = event.get("content", "")
                if not delta_content:
                    continue

                raw_content += delta_content
                current_question = normalize_clarification_text(
                    self._extract_partial_streaming_question(raw_content)
                )
                if not current_question:
                    continue

                if current_question.startswith(emitted_question):
                    next_piece = current_question[len(emitted_question):]
                else:
                    next_piece = current_question

                if next_piece:
                    emitted_question = current_question
                    yield {"type": "content", "content": next_piece}

                current_quick_options = self._extract_partial_streaming_quick_options(raw_content)
                if current_quick_options and current_quick_options != emitted_quick_options:
                    emitted_quick_options = current_quick_options
                    yield {
                        "type": "options",
                        "quick_options": current_quick_options,
                    }

            data = parse_llm_json(str(raw_content or ""))
            final_question = normalize_clarification_text(str(data.get("question") or ""))
            if not final_question:
                raise ValueError("LLM clarification output missing question")

            if final_question.startswith(emitted_question):
                tail = final_question[len(emitted_question):]
            else:
                tail = final_question if final_question != emitted_question else ""
            if tail:
                yield {"type": "content", "content": tail}

            final_quick_options = self._normalize_quick_options(
                data.get("quick_options"),
                fallback_quick_options,
            )
            if final_quick_options != emitted_quick_options:
                yield {
                    "type": "options",
                    "quick_options": final_quick_options,
                }

            yield {
                "type": "done",
                "question": final_question,
                "quick_options": final_quick_options,
                "source": "llm",
            }
        except Exception as exc:
            logger.warning(
                "[AI Path] 流式澄清问题生成失败，回退静态问题: subject=%s turn=%s error=%s",
                subject_key,
                turn_index,
                exc,
            )
            if not emitted_question:
                yield {"type": "content", "content": fallback_question}
                final_question = fallback_question
            else:
                final_question = emitted_question

            if list(fallback_quick_options) != emitted_quick_options:
                yield {
                    "type": "options",
                    "quick_options": list(fallback_quick_options),
                }

            yield {
                "type": "done",
                "question": normalize_clarification_text(final_question) or fallback_question,
                "quick_options": list(fallback_quick_options),
                "source": "fallback",
            }
    async def stream_start_clarification_session(
        self,
        user_id: str,
        subject_key: str,
    ) -> AsyncGenerator[dict[str, Any], None]:
        await self._parent.get_active_subject_skill_map(subject_key)

        session = LearningPathClarificationSession(
            user_id=uuid.UUID(user_id),
            subject_key=subject_key,
            status="collecting",
            current_turn_index=0,
        )
        self.db.add(session)
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(session)

        yield {
            "type": "start",
            "session": self._serialize_clarification_session(session, []),
        }

        subject_name = SUBJECT_CONFIGS.get(subject_key).name if subject_key in SUBJECT_CONFIGS else subject_key
        fallback_question = f"我们先聚焦学习目标。你这次最想优先掌握哪些 {subject_name} 能力？"
        fallback_quick_options = self._build_quick_options(1)
        final_turn: dict[str, Any] | None = None

        async for event in self._stream_generate_clarification_turn(
            user_id=str(session.user_id),
            subject_key=subject_key,
            turn_index=1,
            recent_messages=[],
            missing_items=["goal", "current_level", "target_scope", "time_budget", "confirmation"],
            ready_summary="尚未开始收集学习路径澄清信息。",
            fallback_question=fallback_question,
            fallback_quick_options=fallback_quick_options,
            snapshot_notes="",
        ):
            if event["type"] in {"content", "options"}:
                yield event
                continue
            final_turn = event

        if final_turn is None:
            raise RuntimeError("流式澄清问题未产生最终结果")

        first_message = LearningPathClarificationMessage(
            session_id=session.id,
            role="assistant",
            message_type="question",
            content=final_turn["question"],
            structured_payload={"quick_options": final_turn["quick_options"]},
            turn_index=1,
        )
        self.db.add(first_message)
        session.status = "awaiting_user"
        session.current_turn_index = 1
        await self.db.commit()

        detail = await self.get_clarification_session(str(session.id))
        if detail is None:
            raise ValueError("澄清会话不存在")

        yield {
            "type": "done",
            "session": detail,
            "ready_check": await self.get_ready_check(str(session.id)),
            "source": final_turn.get("source", "fallback"),
        }

    async def stream_reply_clarification_session(
        self,
        session_id: str,
        content: str,
    ) -> AsyncGenerator[dict[str, Any], None]:
        result = await self.db.execute(
            select(LearningPathClarificationSession).where(
                LearningPathClarificationSession.id == uuid.UUID(session_id)
            )
        )
        session = result.scalar_one_or_none()
        if session is None:
            raise ValueError("澄清会话不存在")

        current_turn = max(session.current_turn_index, 1)
        user_message = LearningPathClarificationMessage(
            session_id=session.id,
            role="user",
            message_type="answer",
            content=content,
            turn_index=current_turn,
        )
        self.db.add(user_message)
        await self.db.flush()
        await self.db.commit()
        await self.db.refresh(session)

        start_detail = await self.get_clarification_session(session_id)
        if start_detail is None:
            raise ValueError("澄清会话不存在")

        yield {
            "type": "start",
            "session": start_detail,
        }

        final_turn: dict[str, Any] | None = None
        snapshot = await self._get_preference_snapshot(session_id)
        state = await self._collect_clarification_state(start_detail, snapshot)

        # ── 就绪时直接收敛，不再生成新的 AI 提问 ──────────────
        if state.get("ready"):
            session.status = "awaiting_user"
            session.current_turn_index = max(current_turn, _MAX_PROACTIVE_CLARIFICATION_TURNS)
            await self.db.commit()

            detail = await self.get_clarification_session(session_id)
            if detail is None:
                raise ValueError("澄清会话不存在")

            yield {
                "type": "done",
                "session": detail,
                "ready_check": await self.get_ready_check(session_id),
                "source": "ready",
            }
            return

        if self._should_continue_guided_clarification(state, current_turn):
            next_turn_index = current_turn + 1
            if current_turn < _MAX_PROACTIVE_CLARIFICATION_TURNS:
                fallback_question = self._build_follow_up_question(session.subject_key, content, next_turn_index)
                fallback_quick_options = self._build_quick_options(next_turn_index)
            else:
                subject_name = (
                    SUBJECT_CONFIGS.get(session.subject_key).name
                    if session.subject_key in SUBJECT_CONFIGS
                    else session.subject_key
                )
                fallback_question = self._build_post_soft_cap_guided_question(session.subject_key, state)
                fallback_quick_options = self._build_post_soft_cap_guided_quick_options(subject_name, state)

            async for event in self._stream_generate_clarification_turn(
                user_id=str(session.user_id),
                subject_key=session.subject_key,
                turn_index=next_turn_index,
                recent_messages=start_detail["messages"],
                missing_items=state["missing_items"],
                ready_summary=state["summary"],
                fallback_question=fallback_question,
                fallback_quick_options=fallback_quick_options,
                snapshot_notes=normalize_clarification_text(
                    snapshot.free_text_notes if snapshot else ""
                ),
            ):
                if event["type"] in {"content", "options"}:
                    yield event
                    continue
                final_turn = {
                    **event,
                    "message_type": "question",
                    "turn_index": next_turn_index,
                    "structured_payload": {"quick_options": event["quick_options"]},
                }
            session.current_turn_index = next_turn_index
        else:
            latest_user_reply = start_detail["messages"][-1]["content"] if start_detail["messages"] else ""
            fallback_question = self._build_open_supplement_dynamic_fallback_question(state, latest_user_reply)
            fallback_quick_options = self._build_open_supplement_dynamic_quick_options(
                latest_user_reply,
                ready=bool(state.get("ready")),
            )
            async for event in self._stream_generate_clarification_turn(
                user_id=str(session.user_id),
                subject_key=session.subject_key,
                turn_index=current_turn + 1,
                recent_messages=start_detail["messages"],
                missing_items=state["missing_items"],
                ready_summary=state["summary"],
                fallback_question=fallback_question,
                fallback_quick_options=fallback_quick_options,
                snapshot_notes=normalize_clarification_text(
                    snapshot.free_text_notes if snapshot else ""
                ),
            ):
                if event["type"] in {"content", "options"}:
                    yield event
                    continue
                final_turn = {
                    **event,
                    "message_type": "summary",
                    "turn_index": max(current_turn, _MAX_PROACTIVE_CLARIFICATION_TURNS),
                    "structured_payload": self._build_open_supplement_structured_payload(
                        state,
                        event["quick_options"],
                    ),
                }
            session.current_turn_index = max(current_turn, _MAX_PROACTIVE_CLARIFICATION_TURNS)

        if final_turn is None:
            raise RuntimeError("流式回复未产生最终结果")

        assistant_message = LearningPathClarificationMessage(
            session_id=session.id,
            role="assistant",
            message_type=final_turn["message_type"],
            content=final_turn["question"],
            structured_payload=final_turn["structured_payload"],
            turn_index=final_turn["turn_index"],
        )
        self.db.add(assistant_message)
        session.status = "awaiting_user"
        await self.db.commit()

        detail = await self.get_clarification_session(session_id)
        if detail is None:
            raise ValueError("澄清会话不存在")

        yield {
            "type": "done",
            "session": detail,
            "ready_check": await self.get_ready_check(session_id),
            "source": final_turn.get("source", "fallback"),
        }

    async def _resolve_clarification_turn(
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
    ) -> dict[str, Any]:
        try:
            payload = await self._generate_clarification_turn(
                user_id=user_id,
                subject_key=subject_key,
                turn_index=turn_index,
                recent_messages=recent_messages,
                missing_items=missing_items,
                ready_summary=ready_summary,
                fallback_question=fallback_question,
                fallback_quick_options=fallback_quick_options,
                snapshot_notes=snapshot_notes,
            )
            question = normalize_clarification_text(str(payload.get("question") or ""))
            if not question:
                raise ValueError("LLM clarification question is empty")
            return {
                "question": question,
                "quick_options": self._normalize_quick_options(
                    payload.get("quick_options"),
                    fallback_quick_options,
                ),
            }
        except Exception as exc:
            logger.warning(
                "[AI Path] 澄清问题生成失败，回退静态问题: subject=%s turn=%s error=%s",
                subject_key,
                turn_index,
                exc,
            )
            return {
                "question": fallback_question,
                "quick_options": list(fallback_quick_options),
            }

    async def _generate_clarification_turn(
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
    ) -> dict[str, Any]:
        llm_service = await self._parent._get_llm_service(user_id)
        if not llm_service:
            raise LLMServiceError("未找到可用的澄清问题 LLM 配置")

        subject_name = SUBJECT_CONFIGS.get(subject_key).name if subject_key in SUBJECT_CONFIGS else subject_key
        personalization = await self._build_clarification_personalization_context(user_id)
        prompt_registry = get_prompt_registry()
        prompt_definition = prompt_registry.get_definition("ai_learning_path.clarify_question")
        latest_user_reply = normalize_clarification_text(
            next(
                (
                    message.get("content", "")
                    for message in reversed(recent_messages)
                    if message.get("role") == "user"
                ),
                "",
            )
        )
        previous_assistant_question = normalize_clarification_text(
            next(
                (
                    message.get("content", "")
                    for message in reversed(recent_messages)
                    if message.get("role") == "assistant"
                ),
                "",
            )
        )
        messages = prompt_registry.render_messages(
            "ai_learning_path.clarify_question",
            {
                "subject_key": subject_key,
                "subject_name": subject_name,
                "turn_index": turn_index,
                "ready_summary": ready_summary or "暂无摘要。",
                "missing_items_json": json.dumps(missing_items, ensure_ascii=False),
                "completed_items_json": json.dumps(
                    [item for item in ("goal", "current_level", "target_scope", "time_budget", "confirmation") if item not in missing_items],
                    ensure_ascii=False,
                ),
                "generation_ready": "true" if len(missing_items) == 0 else "false",
                "ready_to_generate_hint": (
                    "信息已经足够，请停止继续发散，明确告诉用户现在可以直接生成新版本，并只提供生成或微调类选项。"
                    if len(missing_items) == 0
                    else "信息尚未完全收敛，请围绕缺失项继续追问。"
                ),
                "snapshot_notes": snapshot_notes or "无",
                "ability_tags_detail": personalization["ability_tags_detail"],
                "learning_stats": personalization["learning_stats"],
                "recent_messages_json": json.dumps(recent_messages[-6:], ensure_ascii=False, indent=2),
                "latest_user_reply": latest_user_reply or "无",
                "previous_assistant_question": previous_assistant_question or "无",
                "fallback_question": fallback_question,
                "fallback_quick_options_json": json.dumps(fallback_quick_options, ensure_ascii=False),
            },
        )

        effective_timeout = max(int(getattr(llm_service, "timeout", 30)), 45)
        effective_max_tokens = self._parent._resolve_llm_max_tokens(llm_service, prompt_definition.max_tokens)
        raw_content, _ = await llm_service.raw_completion(
            messages,
            temperature=prompt_definition.temperature,
            max_tokens=effective_max_tokens,
            timeout_override=effective_timeout,
        )
        data = parse_llm_json(raw_content)
        question = normalize_clarification_text(str(data.get("question") or ""))
        if not question:
            raise ValueError(f"LLM clarification output missing question: {raw_content[:200]}")

        return {
            "question": question,
            "quick_options": self._normalize_quick_options(
                data.get("quick_options"),
                fallback_quick_options,
            ),
        }


    async def _get_preference_snapshot(self, session_id: str) -> Optional[LearningPathPreferenceSnapshot]:
        snapshot_result = await self.db.execute(
            select(LearningPathPreferenceSnapshot).where(
                LearningPathPreferenceSnapshot.session_id == uuid.UUID(session_id)
            )
        )
        return snapshot_result.scalar_one_or_none()

    async def _build_snapshot_node_label_map(
        self,
        subject_key: str,
        user_id: Optional[str],
    ) -> dict[str, str]:
        active_map = await self._parent.get_active_subject_skill_map(subject_key, user_id)
        tree = (active_map or {}).get("tree")
        if not isinstance(tree, dict):
            return {}

        label_map: dict[str, str] = {}

        def walk(node: dict[str, Any]) -> None:
            node_id = str(node.get("id") or "").strip()
            label = normalize_clarification_text(str(node.get("label") or ""))
            if node_id:
                label_map[node_id] = label or node_id
            for child in node.get("children", []) or []:
                if isinstance(child, dict):
                    walk(child)

        walk(tree)
        return label_map

    async def _resolve_snapshot_node_labels(
        self,
        snapshot: Optional[LearningPathPreferenceSnapshot],
        subject_key: str,
        user_id: Optional[str],
    ) -> dict[str, list[str]]:
        if snapshot is None:
            return {"known": [], "target": [], "avoid": []}

        label_map = await self._build_snapshot_node_label_map(subject_key, user_id)

        def resolve(node_ids: list[str]) -> list[str]:
            values: list[str] = []
            seen: set[str] = set()
            for node_id in node_ids or []:
                text = label_map.get(node_id, node_id)
                normalized = normalize_clarification_text(str(text or ""))
                if not normalized or normalized in seen:
                    continue
                seen.add(normalized)
                values.append(normalized)
            return values

        return {
            "known": resolve(list(snapshot.known_node_ids or [])),
            "target": resolve(list(snapshot.target_node_ids or [])),
            "avoid": resolve(list(snapshot.avoid_node_ids or [])),
        }

    async def _collect_rule_based_clarification_state(
        self,
        detail: dict,
        snapshot: Optional[LearningPathPreferenceSnapshot],
    ) -> dict[str, Any]:
        user_messages: list[str] = []
        latest_user_reply = ""

        goal = ""
        current_level = ""
        target_scope = ""
        time_budget = ""
        confirmation = False
        last_assistant_question = ""

        for message in detail["messages"]:
            if message["role"] == "assistant":
                last_assistant_question = normalize_clarification_text(message.get("content", ""))
                continue
            if message["role"] != "user":
                continue

            text = normalize_clarification_text(message["content"])
            if not text:
                continue

            user_messages.append(text)
            latest_user_reply = text
            inferred_slot = self._infer_slot_from_assistant_question(last_assistant_question)
            is_uncertain_reply = self._is_uncertain_reply(text)

            if not goal and not is_uncertain_reply:
                goal = text

            if inferred_slot == "goal" and not is_uncertain_reply:
                goal = text

            if (not current_level and any(keyword in text for keyword in _CURRENT_LEVEL_HINTS)) or (
                inferred_slot == "current_level" and not is_uncertain_reply
            ):
                current_level = text

            if any(keyword in text for keyword in _TARGET_SCOPE_HINTS) or (
                inferred_slot == "target_scope" and not is_uncertain_reply
            ):
                target_scope = text
            elif inferred_slot == "target_scope" and is_uncertain_reply and not target_scope:
                target_scope = self._default_value_for_uncertain_slot("target_scope")

            if re.search(r"(\d{1,3})\s*(分钟|小时)", text) or any(
                keyword in text for keyword in _TIME_BUDGET_HINTS
            ) or (inferred_slot == "time_budget" and not is_uncertain_reply):
                time_budget = text
            elif inferred_slot == "time_budget" and is_uncertain_reply and not time_budget:
                time_budget = self._default_value_for_uncertain_slot("time_budget")

            if any(keyword in text for keyword in _CONFIRMATION_HINTS):
                confirmation = True
                if not target_scope:
                    target_scope = self._extract_target_scope_from_confirmation_question(last_assistant_question)

        notes = normalize_clarification_text(snapshot.free_text_notes if snapshot else "")
        if snapshot:
            snapshot_node_labels = await self._resolve_snapshot_node_labels(
                snapshot,
                detail["subject_key"],
                detail["user_id"],
            )
            scope_fragments: list[str] = []
            if snapshot_node_labels["target"]:
                scope_fragments.append(f"目标节点：{', '.join(snapshot_node_labels['target'])}")
            if snapshot_node_labels["avoid"]:
                scope_fragments.append(f"暂不学习：{', '.join(snapshot_node_labels['avoid'])}")
            if notes:
                scope_fragments.append(f"偏好备注：{notes}")

            snapshot_scope = "；".join(scope_fragments)
            if snapshot_scope:
                target_scope = "；".join(part for part in [target_scope, snapshot_scope] if part)

            if not time_budget and (
                re.search(r"(\d{1,3})\s*(分钟|小时)", notes)
                or any(keyword in notes for keyword in _TIME_BUDGET_HINTS)
            ):
                time_budget = notes

        has_open_supplement_summary = any(
            message["role"] == "assistant"
            and ((message.get("structured_payload") or {}).get("mode") == _OPEN_SUPPLEMENT_MODE)
            for message in detail["messages"]
        )
        confirmation = confirmation or has_open_supplement_summary

        # ── 提取 open_supplement 模式下的用户补充信息 ──────
        supplement_dict: dict[str, str] = {}
        in_supplement_mode = False
        last_question = "其他补充"
        for message in detail["messages"]:
            if (
                message["role"] == "assistant"
                and ((message.get("structured_payload") or {}).get("mode") == _OPEN_SUPPLEMENT_MODE)
            ):
                in_supplement_mode = True
                last_question = normalize_clarification_text(message["content"])
                continue
            if in_supplement_mode and message["role"] == "user":
                text = normalize_clarification_text(message["content"])
                if text:
                    is_pure_confirmation = any(hint == text for hint in _CONFIRMATION_HINTS)
                    if not is_pure_confirmation:
                        if last_question in supplement_dict:
                            supplement_dict[last_question] = supplement_dict[last_question] + "，" + text
                        else:
                            supplement_dict[last_question] = text
        
        supplement_str = _format_supplement_display(supplement_dict)

        missing_items: list[str] = []
        if not goal:
            missing_items.append("goal")
        if not current_level:
            missing_items.append("current_level")
        if not target_scope:
            missing_items.append("target_scope")
        if not time_budget:
            missing_items.append("time_budget")
        if not confirmation:
            missing_items.append("confirmation")

        summary = "；".join(
            [
                f"学习目标：{goal or '待补充'}",
                f"当前水平：{current_level or '待补充'}",
                f"重点范围：{target_scope or '待补充'}",
                f"时间安排：{time_budget or '待补充'}",
                f"补充信息：{supplement_str or '无'}",
                f"确认状态：{'已确认，可生成' if confirmation else '待确认'}",
            ]
        )

        return {
            "goal": goal,
            "current_level": current_level,
            "target_scope": target_scope,
            "snapshot_scope": snapshot_scope if snapshot else "",
            "time_budget": time_budget,
            "supplement_info": supplement_dict,
            "confirmation": confirmation,
            "latest_user_reply": latest_user_reply,
            "missing_items": missing_items,
            "ready": len(missing_items) == 0,
            "summary": summary,
        }

    async def _build_snapshot_summary(
        self,
        snapshot: Optional[LearningPathPreferenceSnapshot],
        subject_key: str,
        user_id: Optional[str],
    ) -> str:
        if snapshot is None:
            return "无偏好快照"

        snapshot_node_labels = await self._resolve_snapshot_node_labels(snapshot, subject_key, user_id)
        parts: list[str] = []
        if snapshot_node_labels["known"]:
            parts.append(f"已掌握节点: {', '.join(snapshot_node_labels['known'])}")
        if snapshot_node_labels["target"]:
            parts.append(f"目标节点: {', '.join(snapshot_node_labels['target'])}")
        if snapshot_node_labels["avoid"]:
            parts.append(f"暂不学习节点: {', '.join(snapshot_node_labels['avoid'])}")
        if snapshot.free_text_notes:
            parts.append(f"备注: {snapshot.free_text_notes}")
        return "；".join(parts) if parts else "无偏好快照"

    async def _extract_clarification_state_with_llm(
        self,
        *,
        user_id: str,
        detail: dict,
        snapshot: Optional[LearningPathPreferenceSnapshot],
        rule_state: dict[str, Any],
    ) -> dict[str, Any]:
        bind = getattr(self.db, "bind", None)
        bind_url = str(getattr(bind, "url", "")) if bind is not None else ""
        if "sqlite+aiosqlite:///:memory:" in bind_url:
            raise LLMServiceError("Skip LLM state extraction in in-memory test DB")

        llm_service = await self._parent._get_llm_service(user_id)
        if not llm_service:
            raise LLMServiceError("未找到可用的澄清状态提取 LLM 配置")

        personalization = await self._build_clarification_personalization_context(user_id)
        prompt_registry = get_prompt_registry()
        prompt_definition = prompt_registry.get_definition("ai_learning_path.extract_state")
        messages = prompt_registry.render_messages(
            "ai_learning_path.extract_state",
            {
                "session_messages_json": json.dumps(detail["messages"], ensure_ascii=False, indent=2),
                "snapshot_summary": await self._build_snapshot_summary(
                    snapshot,
                    detail["subject_key"],
                    detail["user_id"],
                ),
                "ability_tags_detail": personalization["ability_tags_detail"],
                "learning_stats": personalization["learning_stats"],
                "rule_state_json": json.dumps(
                    {
                        "goal": rule_state["goal"],
                        "current_level": rule_state["current_level"],
                        "target_scope": rule_state["target_scope"],
                        "time_budget": rule_state["time_budget"],
                        "confirmation": rule_state["confirmation"],
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
            },
        )

        effective_timeout = max(int(getattr(llm_service, "timeout", 30)), 45)
        effective_max_tokens = self._parent._resolve_llm_max_tokens(llm_service, prompt_definition.max_tokens)
        raw_content, _ = await llm_service.raw_completion(
            messages,
            temperature=prompt_definition.temperature,
            max_tokens=effective_max_tokens,
            timeout_override=effective_timeout,
        )
        data = parse_llm_json(raw_content)
        confirmation_raw = data.get("confirmation")
        if isinstance(confirmation_raw, bool):
            confirmation = confirmation_raw
        else:
            confirmation = str(confirmation_raw or "").strip().lower() in {"true", "1", "yes", "y", "confirmed", "ok"}

        return {
            "goal": normalize_clarification_text(str(data.get("goal") or "")),
            "current_level": normalize_clarification_text(str(data.get("current_level") or "")),
            "target_scope": normalize_clarification_text(str(data.get("target_scope") or "")),
            "time_budget": normalize_clarification_text(str(data.get("time_budget") or "")),
            "confirmation": confirmation,
        }

    def _merge_clarification_states(
        self,
        *,
        rule_state: dict[str, Any],
        llm_state: dict[str, Any] | None,
    ) -> dict[str, Any]:
        merged_goal = normalize_clarification_text((llm_state or {}).get("goal") or rule_state["goal"])
        merged_current_level = normalize_clarification_text((llm_state or {}).get("current_level") or rule_state["current_level"])
        merged_target_scope = normalize_clarification_text((llm_state or {}).get("target_scope") or rule_state["target_scope"])
        
        # 核心修复：强制追加星图快照描述，避免 LLM 在合并状态时丢失用户点击的节点变更
        snapshot_scope = rule_state.get("snapshot_scope", "")
        if snapshot_scope and snapshot_scope not in merged_target_scope:
            merged_target_scope = "；".join(part for part in [merged_target_scope, snapshot_scope] if part)

        merged_time_budget = normalize_clarification_text((llm_state or {}).get("time_budget") or rule_state["time_budget"])
        merged_confirmation = bool((llm_state or {}).get("confirmation")) or bool(rule_state["confirmation"])

        # 补充信息直接来自 rule_state（基于消息的时序判断，不依赖 LLM 提取）
        merged_supplement_info = rule_state.get("supplement_info", {})
        supplement_str = _format_supplement_display(merged_supplement_info)

        missing_items: list[str] = []
        if not merged_goal:
            missing_items.append("goal")
        if not merged_current_level:
            missing_items.append("current_level")
        if not merged_target_scope:
            missing_items.append("target_scope")
        if not merged_time_budget:
            missing_items.append("time_budget")
        if not merged_confirmation:
            missing_items.append("confirmation")

        summary = "；".join(
            [
                f"学习目标：{merged_goal or '待补充'}",
                f"当前水平：{merged_current_level or '待补充'}",
                f"重点范围：{merged_target_scope or '待补充'}",
                f"时间安排：{merged_time_budget or '待补充'}",
                f"补充信息：{supplement_str or '无'}",
                f"确认状态：{'已确认，可生成' if merged_confirmation else '待确认'}",
            ]
        )

        return {
            "goal": merged_goal,
            "current_level": merged_current_level,
            "target_scope": merged_target_scope,
            "time_budget": merged_time_budget,
            "supplement_info": merged_supplement_info,
            "confirmation": merged_confirmation,
            "latest_user_reply": rule_state["latest_user_reply"],
            "missing_items": missing_items,
            "ready": len(missing_items) == 0,
            "summary": summary,
        }

    async def _collect_clarification_state(
        self,
        detail: dict,
        snapshot: Optional[LearningPathPreferenceSnapshot],
    ) -> dict[str, Any]:
        rule_state = await self._collect_rule_based_clarification_state(detail, snapshot)
        llm_state: dict[str, Any] | None = None

        try:
            llm_state = await self._extract_clarification_state_with_llm(
                user_id=detail["user_id"],
                detail=detail,
                snapshot=snapshot,
                rule_state=rule_state,
            )
        except Exception as exc:
            logger.warning("[AI Path] 澄清状态 LLM 提取失败，回退规则识别: %s", exc)
            llm_state = None

        return self._merge_clarification_states(rule_state=rule_state, llm_state=llm_state)

    async def reply_clarification_session(self, session_id: str, content: str) -> dict:
        """提交用户回复，并返回下一轮 AI 提问。"""
        result = await self.db.execute(
            select(LearningPathClarificationSession).where(
                LearningPathClarificationSession.id == uuid.UUID(session_id)
            )
        )
        session = result.scalar_one_or_none()
        if session is None:
            raise ValueError("澄清会话不存在")

        current_turn = max(session.current_turn_index, 1)
        user_message = LearningPathClarificationMessage(
            session_id=session.id,
            role="user",
            message_type="answer",
            content=content,
            turn_index=current_turn,
        )
        self.db.add(user_message)

        await self.db.flush()

        detail = await self.get_clarification_session(session_id)
        if detail is None:
            raise ValueError("澄清会话不存在")
        snapshot = await self._get_preference_snapshot(session_id)
        state = await self._collect_clarification_state(detail, snapshot)

        # ── 就绪时直接收敛，不再生成新的 AI 提问 ──────────────
        if state.get("ready"):
            session.status = "awaiting_user"
            session.current_turn_index = max(current_turn, _MAX_PROACTIVE_CLARIFICATION_TURNS)
            await self.db.commit()

            detail = await self.get_clarification_session(session_id)
            if detail is None:
                raise ValueError("澄清会话不存在")
            return detail

        if self._should_continue_guided_clarification(state, current_turn):
            next_turn_index = current_turn + 1
            if current_turn < _MAX_PROACTIVE_CLARIFICATION_TURNS:
                fallback_question = self._build_follow_up_question(session.subject_key, content, next_turn_index)
                fallback_quick_options = self._build_quick_options(next_turn_index)
            else:
                subject_name = (
                    SUBJECT_CONFIGS.get(session.subject_key).name
                    if session.subject_key in SUBJECT_CONFIGS
                    else session.subject_key
                )
                fallback_question = self._build_post_soft_cap_guided_question(session.subject_key, state)
                fallback_quick_options = self._build_post_soft_cap_guided_quick_options(subject_name, state)
            next_turn = await self._resolve_clarification_turn(
                user_id=str(session.user_id),
                subject_key=session.subject_key,
                turn_index=next_turn_index,
                recent_messages=detail["messages"],
                missing_items=state["missing_items"],
                ready_summary=state["summary"],
                fallback_question=fallback_question,
                fallback_quick_options=fallback_quick_options,
                snapshot_notes=normalize_clarification_text(
                    snapshot.free_text_notes if snapshot else ""
                ),
            )
            assistant_message = LearningPathClarificationMessage(
                session_id=session.id,
                role="assistant",
                message_type="question",
                content=next_turn["question"],
                structured_payload={"quick_options": next_turn["quick_options"]},
                turn_index=next_turn_index,
            )
            session.current_turn_index = next_turn_index
        else:
            latest_user_reply = detail["messages"][-1]["content"] if detail["messages"] else ""
            fallback_question = self._build_open_supplement_dynamic_fallback_question(state, latest_user_reply)
            fallback_quick_options = self._build_open_supplement_dynamic_quick_options(
                latest_user_reply,
                ready=bool(state.get("ready")),
            )
            next_turn = await self._resolve_clarification_turn(
                user_id=str(session.user_id),
                subject_key=session.subject_key,
                turn_index=current_turn + 1,
                recent_messages=detail["messages"],
                missing_items=state["missing_items"],
                ready_summary=state["summary"],
                fallback_question=fallback_question,
                fallback_quick_options=fallback_quick_options,
                snapshot_notes=normalize_clarification_text(
                    snapshot.free_text_notes if snapshot else ""
                ),
            )
            assistant_message = LearningPathClarificationMessage(
                session_id=session.id,
                role="assistant",
                message_type="summary",
                content=next_turn["question"],
                structured_payload=self._build_open_supplement_structured_payload(
                    state,
                    next_turn["quick_options"],
                ),
                turn_index=_MAX_PROACTIVE_CLARIFICATION_TURNS,
            )
            session.current_turn_index = _MAX_PROACTIVE_CLARIFICATION_TURNS

        self.db.add(assistant_message)

        session.status = "awaiting_user"
        await self.db.commit()

        detail = await self.get_clarification_session(session_id)
        if detail is None:
            raise ValueError("澄清会话不存在")
        return detail

    async def get_ready_check(self, session_id: str) -> dict:
        """判断当前会话是否具备生成条件。"""
        detail = await self.get_clarification_session(session_id)
        if detail is None:
            raise ValueError("澄清会话不存在")

        snapshot = await self._get_preference_snapshot(session_id)
        state = await self._collect_clarification_state(detail, snapshot)

        return {
            "session_id": session_id,
            "ready": state["ready"],
            "missing_items": state["missing_items"],
            "summary": state["summary"],
        }

    def _infer_daily_minutes(
        self,
        snapshot: Optional[LearningPathPreferenceSnapshot],
        time_budget_text: str = "",
    ) -> int:
        text_candidates = [time_budget_text, (snapshot.free_text_notes if snapshot else "") or ""]
        joined_text = " ".join(candidate for candidate in text_candidates if candidate)
        match = re.search(r"(\d{2,3})\s*分钟", joined_text)
        if match:
            try:
                return max(15, min(180, int(match.group(1))))
            except ValueError:
                return 60
        return 60

    def _infer_total_days(
        self,
        snapshot: Optional[LearningPathPreferenceSnapshot],
        time_budget_text: str = "",
        goal_text: str = "",
    ) -> int:
        """从用户对话或偏好快照中推断总天数。

        支持的表达: "2天", "两天速成", "一周", "两周", "3天集中学习" 等。
        返回值范围: 1 ~ 90，默认 14。
        """
        _CN_DIGIT_MAP = {
            "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5,
            "六": 6, "七": 7, "八": 8, "九": 9, "十": 10,
        }
        text_candidates = [
            time_budget_text,
            goal_text,
            (snapshot.free_text_notes if snapshot else "") or "",
        ]
        joined_text = " ".join(candidate for candidate in text_candidates if candidate)
        if not joined_text:
            return 14

        # 匹配 "2天", "14天" 等阿拉伯数字+天
        match = re.search(r"(\d{1,3})\s*天", joined_text)
        if match:
            try:
                return max(1, min(90, int(match.group(1))))
            except ValueError:
                pass

        # 匹配 "两天", "三天" 等中文数字+天
        cn_match = re.search(r"([一二两三四五六七八九十])\s*天", joined_text)
        if cn_match:
            days = _CN_DIGIT_MAP.get(cn_match.group(1))
            if days:
                return max(1, min(90, days))

        # 匹配 "一周"/"两周"/"1周"
        week_match = re.search(r"(\d{1,2}|[一二两三四])\s*周", joined_text)
        if week_match:
            raw = week_match.group(1)
            weeks = _CN_DIGIT_MAP.get(raw) if raw in _CN_DIGIT_MAP else int(raw) if raw.isdigit() else None
            if weeks:
                return max(1, min(90, weeks * 7))

        # 匹配 "速成" 暗示短期（默认 3 天）
        if "速成" in joined_text:
            return 3

        return 14

    @staticmethod
    def _normalize_difficulty_level(current_level_text: str) -> str:
        """将用户自然语言水平描述归一化为 '初级'/'中级'/'高级'。"""
        text = (current_level_text or "").strip()
        if not text:
            return "初级"

        _ADVANCED_HINTS = (
            "高级", "进阶", "高难度", "深入", "高阶", "精通", "熟练",
            "资深", "专业", "实战经验丰富", "有丰富经验", "工作经验",
        )
        _BEGINNER_HINTS = (
            "初级", "入门", "零基础", "新手", "初学", "没有基础",
            "没学过", "完全不会", "刚开始", "从零",
        )

        for hint in _ADVANCED_HINTS:
            if hint in text:
                return "高级"
        for hint in _BEGINNER_HINTS:
            if hint in text:
                return "初级"

        # 有经验但非高级/初级 → 中级
        _INTERMEDIATE_HINTS = (
            "中级", "中等", "有基础", "有经验", "有些经验", "学过",
            "了解", "接触过", "会一些", "一定基础", "系统学习",
            "系统提升",
        )
        for hint in _INTERMEDIATE_HINTS:
            if hint in text:
                return "中级"

        return "中级"

    async def build_generation_context(self, session_id: str) -> dict:
        """组装并持久化生成上下文快照。"""
        detail = await self.get_clarification_session(session_id)
        if detail is None:
            raise ValueError("澄清会话不存在")

        snapshot = await self._get_preference_snapshot(session_id)
        state = await self._collect_clarification_state(detail, snapshot)
        notes = normalize_clarification_text(snapshot.free_text_notes if snapshot else "")
        supplement_info = state.get("supplement_info", {})
        supplement_str = _format_supplement_display(supplement_info)

        # goal_summary 仅保留核心学习目标，不再混入偏好和补充信息
        goal_summary = "；".join(
            part
            for part in [
                state["goal"],
                state["time_budget"],
            ]
            if part
        ).strip()
        if not goal_summary:
            goal_summary = "为用户生成一个聚焦核心目标的个性化学习路线。"

        # 构建独立的偏好摘要文本（用于 prompt 中单独段落）
        snapshot_node_labels = await self._resolve_snapshot_node_labels(
            snapshot, detail["subject_key"], detail["user_id"],
        )
        preference_parts: list[str] = []
        if snapshot_node_labels["target"]:
            preference_parts.append(f"想重点学习的节点：{', '.join(snapshot_node_labels['target'])}")
        if snapshot_node_labels["known"]:
            preference_parts.append(f"已掌握的节点（可跳过基础）：{', '.join(snapshot_node_labels['known'])}")
        if snapshot_node_labels["avoid"]:
            preference_parts.append(f"暂不学习的节点：{', '.join(snapshot_node_labels['avoid'])}")
        if notes:
            preference_parts.append(f"偏好备注：{notes}")
        snapshot_labels_text = "\n".join(preference_parts) if preference_parts else "无"

        # 归一化难度级别
        difficulty_level = self._normalize_difficulty_level(state["current_level"])

        # 推断 total_days
        inferred_total_days = self._infer_total_days(
            snapshot, state["time_budget"], state["goal"],
        )

        constraints_json = {
            "known_node_ids": list(snapshot.known_node_ids) if snapshot else [],
            "target_node_ids": list(snapshot.target_node_ids) if snapshot else [],
            "avoid_node_ids": list(snapshot.avoid_node_ids) if snapshot else [],
            "free_text_notes": notes,
            "supplement_info": supplement_info,
            "daily_minutes": self._infer_daily_minutes(snapshot, state["time_budget"]),
            "total_days": inferred_total_days,
            "difficulty_level": difficulty_level,
            "snapshot_labels_text": snapshot_labels_text,
            "supplement_text": supplement_str or "无",
            "clarification_fields": {
                "goal": state["goal"],
                "current_level": state["current_level"],
                "target_scope": state["target_scope"],
                "time_budget": state["time_budget"],
                "supplement_info": supplement_info,
                "confirmation": state["confirmation"],
            },
        }
        prompt_inputs_json = {
            "session_messages": detail["messages"],
            "subject_key": detail["subject_key"],
            "goal_summary": goal_summary,
            "ready_summary": state["summary"],
            "constraints": constraints_json,
        }

        context_result = await self.db.execute(
            select(LearningPathGenerationContext).where(
                LearningPathGenerationContext.session_id == uuid.UUID(session_id)
            )
        )
        context = context_result.scalar_one_or_none()

        if context is None:
            context = LearningPathGenerationContext(
                session_id=uuid.UUID(session_id),
                goal_summary=goal_summary,
                constraints_json=constraints_json,
                prompt_inputs_json=prompt_inputs_json,
            )
            self.db.add(context)
        else:
            context.goal_summary = goal_summary
            context.constraints_json = constraints_json
            context.prompt_inputs_json = prompt_inputs_json

        await self.db.commit()

        return {
            "session_id": session_id,
            "goal_summary": goal_summary,
            "constraints_json": constraints_json,
            "prompt_inputs_json": prompt_inputs_json,
        }

    async def _generate_path_from_context(
        self,
        *,
        user_id: str,
        subject_key: str,
        goal: str,
        total_days: int,
        daily_minutes: int,
        level: str = "初级",
        target_node_ids: list[str] | None = None,
        known_node_ids: list[str] | None = None,
        avoid_node_ids: list[str] | None = None,
        snapshot_labels_text: str = "无",
        supplement_text: str = "无",
    ) -> Optional[LearningPath]:
        return await self._parent.generate_learning_path(
            user_id=user_id,
            goal=goal,
            subject_key=subject_key,
            total_days=total_days,
            daily_minutes=daily_minutes,
            level=level,
            target_node_ids=target_node_ids,
            known_node_ids=known_node_ids,
            avoid_node_ids=avoid_node_ids,
            snapshot_labels_text=snapshot_labels_text,
            supplement_text=supplement_text,
        )

    async def generate_learning_path_from_session(self, session_id: str) -> dict:
        """基于当前会话上下文生成新的学习路线版本。"""
        ready_check = await self.get_ready_check(session_id)

        detail = await self.get_clarification_session(session_id)
        if detail is None:
            raise ValueError("澄清会话不存在")

        context_payload = await self.build_generation_context(session_id)
        constraints = context_payload["constraints_json"]

        # 使用归一化的难度级别而非原始自然语言
        level = constraints.get("difficulty_level") or "初级"

        # 使用从用户对话中推断的总天数
        total_days = int(constraints.get("total_days") or 14)

        path = await self._generate_path_from_context(
            user_id=detail["user_id"],
            subject_key=detail["subject_key"],
            goal=context_payload["goal_summary"],
            total_days=total_days,
            daily_minutes=int(constraints.get("daily_minutes") or 60),
            level=level,
            target_node_ids=constraints.get("target_node_ids"),
            known_node_ids=constraints.get("known_node_ids"),
            avoid_node_ids=constraints.get("avoid_node_ids"),
            snapshot_labels_text=constraints.get("snapshot_labels_text") or "无",
            supplement_text=constraints.get("supplement_text") or "无",
        )
        if path is None:
            raise RuntimeError("学习路线生成失败")

        context_result = await self.db.execute(
            select(LearningPathGenerationContext).where(
                LearningPathGenerationContext.session_id == uuid.UUID(session_id)
            )
        )
        context = context_result.scalar_one_or_none()
        if context is not None:
            context.generated_path_id = uuid.UUID(path.id)

        session_result = await self.db.execute(
            select(LearningPathClarificationSession).where(
                LearningPathClarificationSession.id == uuid.UUID(session_id)
            )
        )
        session = session_result.scalar_one_or_none()
        if session is not None:
            session.status = "generated"

        await self.db.commit()

        return {
            "session_id": session_id,
            "ready_check": await self.get_ready_check(session_id),
            "context": context_payload,
            "path": path.model_dump(),
        }

