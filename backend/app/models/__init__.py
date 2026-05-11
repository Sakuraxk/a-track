from .base import Base
from .user import User, UserProfile
from .learning import KnowledgeNode, UserNodeState, LearningTask
from .practice import Exercise, ExerciseResult, Weakness
from .llm_config import UserLLMConfig, ConversationSession, ConversationMessage
from .subject import (
    Subject,
    Chapter,
    ExerciseItem,
    UserSubjectProfile,
    UserNodeMastery,
    Attempt,
    QuestionGroup,
    UserExerciseProgress,
    UserQuestionGroupStats,
    UserWrongQuestion,
    UserPracticeStreak,
    AchievementBadge,
    UserAchievement,
    UserGamificationProfile,
    QuestionRecommendation,
    ExerciseHintCache,
)
from .concept_content import ConceptContent
from .learning_path_workbench import (
    SubjectSkillMap,
    LearningPathClarificationSession,
    LearningPathClarificationMessage,
    LearningPathPreferenceSnapshot,
    LearningPathGenerationContext,
    UserSubjectSkillExpansionNode,
    UserSkillTreeSnapshot,
)
from .user_memory import (
    UserBehaviorMemory,
    UserPreferenceMemory,
    UserInteractionMemory,
    UserLearningPattern,
    UserContextMemory,
)
from .community import (
    CommunityPost,
    CommunityComment,
    CommunityPostLike,
)
from .community_notification import CommunityNotification

__all__ = [
    "Base",
    "User",
    "UserProfile",
    "KnowledgeNode",
    "UserNodeState",
    "LearningTask",
    "Exercise",
    "ExerciseResult",
    "Weakness",
    "UserLLMConfig",
    "ConversationSession",
    "ConversationMessage",
    # Multi-subject models
    "Subject",
    "Chapter",
    "ExerciseItem",
    "UserSubjectProfile",
    "UserNodeMastery",
    "Attempt",
    # Question bank enhancements
    "QuestionGroup",
    "UserExerciseProgress",
    "UserQuestionGroupStats",
    "UserWrongQuestion",
    "UserPracticeStreak",
    "AchievementBadge",
    "UserAchievement",
    "UserGamificationProfile",
    "QuestionRecommendation",
    "ExerciseHintCache",
    "ConceptContent",
    "SubjectSkillMap",
    "LearningPathClarificationSession",
    "LearningPathClarificationMessage",
    "LearningPathPreferenceSnapshot",
    "LearningPathGenerationContext",
    "UserSubjectSkillExpansionNode",
    "UserSkillTreeSnapshot",
    # User memory models
    "UserBehaviorMemory",
    "UserPreferenceMemory",
    "UserInteractionMemory",
    "UserLearningPattern",
    "UserContextMemory",
    # Community models
    "CommunityPost",
    "CommunityComment",
    "CommunityPostLike",
    "CommunityNotification",
]
