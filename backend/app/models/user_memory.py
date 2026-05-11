import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Float, Index, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, utcnow_naive


class UserBehaviorMemory(Base):
    """
    用户行为记忆表
    
    记录用户的学习行为事件,用于分析学习习惯和模式。
    支持的行为类型:
    - login: 登录
    - node_visit: 知识节点访问
    - exercise_start: 练习开始
    - exercise_complete: 练习完成
    - test_participate: 测试参与
    - ai_interaction: AI导师交互
    - path_generate: 学习路径生成
    """
    
    __tablename__ = "user_behavior_memory"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    
    # 行为类型和上下文
    behavior_type = Column(String(64), nullable=False, index=True)  # login, node_visit, exercise_complete等
    context = Column(String(255), nullable=True)  # 简短上下文描述,如节点code或练习id
    
    # 详细元数据(JSON存储)
    event_metadata = Column(JSON, nullable=True)  # 额外的行为详情,如性能指标、错误信息等
    
    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    
    # 复合索引优化查询
    __table_args__ = (
        Index('idx_behavior_user_time', 'user_id', 'created_at'),
        Index('idx_behavior_user_type', 'user_id', 'behavior_type'),
    )


class UserPreferenceMemory(Base):
    """
    用户偏好记忆表
    
    存储用户的学习偏好和习惯,支持基于行为的自动推断。
    偏好类型示例:
    - learning_time_slot: 学习时段偏好 (morning/afternoon/evening/night)
    - ai_tutor_role: AI导师角色偏好 (explainer/code_reviewer)
    - difficulty_preference: 难度偏好 (easy/medium/hard)
    - exercise_type_preference: 题型偏好 (fill_blank/bug_fix/completion)
    - pace_preference: 学习节奏 (light/medium/intense)
    """
    
    __tablename__ = "user_preference_memory"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    
    # 偏好键值对
    preference_key = Column(String(128), nullable=False, index=True)  # 偏好类型
    preference_value = Column(Text, nullable=False)  # 偏好值(可以是JSON字符串)
    
    # 置信度评分(0.0-1.0),基于观察次数动态更新
    confidence_score = Column(Float, default=0.5, nullable=False)
    
    # 偏好元数据
    evidence_count = Column(Integer, default=1, nullable=False)  # 观察到该偏好的次数
    last_observed_at = Column(DateTime, default=utcnow_naive, nullable=False)
    
    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)
    
    # 复合索引和唯一约束
    __table_args__ = (
        Index('idx_preference_user_key', 'user_id', 'preference_key', unique=True),
        Index('idx_preference_confidence', 'user_id', 'confidence_score'),
    )


class UserInteractionMemory(Base):
    """
    用户交互记忆表
    
    记录用户与AI导师的交互历史,支持上下文连续性和交互质量分析。
    """
    
    __tablename__ = "user_interaction_memory"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    
    # 交互类型
    interaction_type = Column(String(64), nullable=False)  # question, code_review, explanation等
    
    # 交互内容
    question = Column(Text, nullable=False)  # 用户的问题或请求
    response = Column(Text, nullable=False)  # AI的回答
    
    # 上下文信息
    context = Column(JSON, nullable=True)  # 当前学习上下文,如node_code, exercise_id等
    
    # 交互质量反馈
    is_helpful = Column(Boolean, nullable=True)  # 用户是否认为回答有帮助
    feedback_text = Column(Text, nullable=True)  # 用户的文字反馈
    
    # AI模型信息
    model_used = Column(String(64), nullable=True)  # 使用的AI模型
    
    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    
    # 索引优化
    __table_args__ = (
        Index('idx_interaction_user_time', 'user_id', 'created_at'),
        Index('idx_interaction_user_helpful', 'user_id', 'is_helpful'),
    )


class UserLearningPattern(Base):
    """
    学习模式总结表
    
    汇总和提炼用户的学习模式,由后台分析任务定期更新。
    模式类型示例:
    - time_pattern: 学习时间规律 (如"总是在晚上8-10点学习")
    - error_pattern: 错误模式 (如"经常在递归终止条件上出错")
    - strength_area: 强项领域 (如"在循环和条件判断上表现优秀")
    - weakness_area: 弱项领域 (如"在函数参数传递上经常出错")
    - learning_speed: 学习速度 (如"快速学习者,平均每节点用时15分钟")
    """
    
    __tablename__ = "user_learning_pattern"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    
    # 模式类型和描述
    pattern_type = Column(String(64), nullable=False, index=True)  # 模式类型
    pattern_description = Column(Text, nullable=False)  # 模式的详细描述
    
    # 模式元数据
    pattern_data = Column(JSON, nullable=True)  # 模式的结构化数据
    
    # 证据和置信度
    evidence_count = Column(Integer, default=1, nullable=False)  # 支持该模式的证据数量
    confidence = Column(Float, default=0.5, nullable=False)  # 模式的置信度(0.0-1.0)
    
    # 时间戳
    first_observed_at = Column(DateTime, default=utcnow_naive, nullable=False)
    last_observed_at = Column(DateTime, default=utcnow_naive, nullable=False)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)
    
    # 索引优化
    __table_args__ = (
        Index('idx_pattern_user_type', 'user_id', 'pattern_type'),
        Index('idx_pattern_confidence', 'user_id', 'confidence'),
    )


class UserContextMemory(Base):
    """
    上下文记忆表
    
    存储用户当前和最近的学习上下文,支持过期清理。
    上下文类型示例:
    - current_chapter: 当前章节
    - recent_errors: 最近错题列表
    - active_concept: 正在讨论的概念
    - session_state: 会话状态
    - learning_goal: 当前学习目标
    """
    
    __tablename__ = "user_context_memory"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    
    # 上下文类型和数据
    context_type = Column(String(64), nullable=False, index=True)  # 上下文类型
    context_data = Column(JSON, nullable=False)  # 上下文的详细数据
    
    # 过期时间(用于自动清理)
    expires_at = Column(DateTime, nullable=True)  # None表示永不过期
    
    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)
    
    # 索引优化
    __table_args__ = (
        Index('idx_context_user_type', 'user_id', 'context_type'),
        Index('idx_context_user_expires', 'user_id', 'expires_at'),
    )
