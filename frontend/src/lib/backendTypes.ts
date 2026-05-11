export type UUID = string

export type ProfileResponse = {
  user_id: UUID
  email?: string | null
  phone?: string | null
  pace_preference: string | null
  ability_tags: Record<string, number>
  portrait: Record<string, string>
  created_at?: string | null
  last_login?: string | null
}

export type AuthResponse = {
  access_token: string
  token_type: string
  user: ProfileResponse
}

export type KnowledgeNode = {
  code: string
  title: string
  difficulty: number
  duration_minutes: number
  prerequisites: string[]
  attributes: Record<string, string>
}

export type UserNodeState = {
  node_code: string
  status: string
  mastery: number
  latest_errors: string[]
}

export type LearningPathItem = {
  node: KnowledgeNode
  status: UserNodeState
}

export type Exercise = {
  id: UUID
  title: string
  exercise_type: string
  difficulty: number
  linked_nodes: string[]
  content: Record<string, unknown>
  subject_key?: string
}

export type ExerciseSubmissionResponse = {
  success: boolean
  status: "submitted" | "correct" | "wrong" | "error" | "timeout"
  score: number
  output: string
  expected_output?: string | null
  error?: string | null
  execution_time_ms: number
  error_tags: string[]
}

export type ExerciseRecommendationResponse = {
  items: Exercise[]
  rationale: string
}

export type TutorRequest = {
  prompt: string
  role?: string
  model?: string | null
  context_nodes?: string[]
  recent_errors?: string[]
}

export type TutorResponse = {
  message: string
  model_used: string
  guidance_only: boolean
  tips: string[]
  references: string[]
}

export type ProgressSummary = {
  total_minutes: number
  completed_nodes: number
  completed_exercises: number
  recent_activity: string[]
}

export type WeeklyReport = {
  highlights: string[]
  weaknesses: Record<string, number>
  recommendations: string[]
}

// ==================== LLM Configuration Types ====================

export type LLMConfigResponse = {
  id: string
  user_id: string
  model_role: string
  api_base_url: string
  model_name: string
  temperature: number
  max_tokens: number
  timeout_seconds: number
  is_active: boolean
  created_at: string
  updated_at: string
  api_key_masked: string
}

export type LLMConfigListResponse = {
  configs: LLMConfigResponse[]
  total: number
}

export type LLMConfigCreate = {
  api_base_url: string
  api_key: string
  model_name: string
  temperature?: number
  max_tokens?: number
  timeout_seconds?: number
}

export type LLMConfigUpdate = {
  api_base_url?: string
  api_key?: string
  model_name?: string
  temperature?: number
  max_tokens?: number
  timeout_seconds?: number
  is_active?: boolean
}

export type LLMConfigTestRequest = {
  config_id?: string
  api_base_url?: string
  api_key?: string
  model_name?: string
  temperature?: number
  max_tokens?: number
  timeout_seconds?: number
}

export type LLMConfigTestResponse = {
  success: boolean
  message: string
  latency_ms: number | null
  model_info: Record<string, unknown> | null
}

// ==================== Conversation Types ====================

export type ConversationContext = {
  knowledge_node_code?: string
  exercise_id?: string
  recent_errors?: string[]
  user_ability_tags?: Record<string, number>
}

export type ChatRequest = {
  session_id?: string
  message: string
  tutor_role?: string
  context?: ConversationContext
  request_direct_answer?: boolean
  scope_type?: "concept" | "practice" | "global"
  scope_id?: string
}

export type ChatResponse = {
  session_id: string
  message: string
  guidance_only: boolean
  hints: string[]
  follow_up_questions: string[]
  recommended_nodes: string[]
  model_used: string
  tokens_used: number | null
}

export type SessionResponse = {
  id: string
  user_id: string
  title: string | null
  role: string
  knowledge_node_code: string | null
  exercise_id: string | null
  scope_type: "concept" | "practice" | "global" | null
  scope_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  message_count: number
}

export type SessionListResponse = {
  sessions: SessionResponse[]
  total: number
}

export type ChatMessage = {
  role: "user" | "assistant" | "system"
  content: string
  created_at?: string
}

export type SessionHistoryResponse = {
  session: SessionResponse
  messages: ChatMessage[]
}

// ==================== Code Execution Types ====================

export type CodeExecutionRequest = {
  code: string
  timeout?: number
}

export type CodeExecutionResponse = {
  success: boolean
  output: string
  error: string | null
  execution_time_ms: number
}

// ==================== Assessment Types ====================

export type AssessmentQuestion = {
  id: number
  category: string
  difficulty: number
  question: string
  options: string[]
  correct_answer: number
  explanation: string
}

export type AssessmentStartResponse = {
  assessment_id: string
  questions: AssessmentQuestion[]
  total_questions: number
  estimated_time_minutes: number
}

export type AssessmentSubmission = {
  assessment_id: string
  answers: Record<number, number>
}

export type AssessmentResult = {
  total_score: number
  level: string
  ability_tags: Record<string, number>
  recommendations: string[]
  summary: string
}

export type AssessmentResultResponse = {
  result: AssessmentResult
  ability_tags: Record<string, number>
  next_steps: string[]
}

// ==================== Dashboard/Reporting Types ====================

export type RadarDataPoint = {
  category: string
  score: number
  full_score: number
}

export type AbilityRadarResponse = {
  data: RadarDataPoint[]
  overall_score: number
  level: string
  summary: string
}

export type LearningStatsResponse = {
  total_exercises: number
  completed_exercises: number
  accuracy_rate: number
  total_study_minutes: number
  streak_days: number
  weekly_activity: number[]
}

export type RecommendedExercise = {
  id: string
  title: string
  difficulty: number
  category: string
  reason: string
}

export type DashboardDataResponse = {
  radar: AbilityRadarResponse
  stats: LearningStatsResponse
  recommendations: RecommendedExercise[]
  next_lesson: string | null
  next_lesson_title: string | null
}

// ==================== Community Types ====================

export type PostAuthor = {
  id: string
  nickname: string
  avatar: string
  role: string
}

export type CommunityPost = {
  id: string
  author: PostAuthor
  title: string
  content: string
  tags: string[]
  likes: number
  comments_count: number
  is_liked: boolean
  created_at: string
}

export type PostListResponse = {
  posts: CommunityPost[]
  total: number
  page: number
  page_size: number
}

export type PostComment = {
  id: string
  post_id: string
  author: PostAuthor
  content: string
  created_at: string
  likes: number
  is_liked?: boolean
  parent_id?: string | null
  replies?: PostComment[]
}

export type LikeResponse = {
  post_id: string
  likes: number
  is_liked: boolean
}

export type CommentListResponse = {
  comments: PostComment[]
  total: number
}

export type CreatePostRequest = {
  title: string
  content: string
  tags: string[]
}

export type CreateCommentRequest = {
  content: string
  parent_id?: string | null
}

export type UpdatePostRequest = {
  title?: string
  content?: string
  tags?: string[]
}

export type DeletePostResponse = {
  success: boolean
  message: string
}

// ==================== LLM Status Types ====================

export type SystemLLMStatusResponse = {
  connected: boolean
  model: string
  message: string
  latency_ms: number
}

export type DailyDetailItem = {
  date: string
  exercises_count: number
  correct_count: number
  study_minutes: number
}

export type DailyDetailResponse = {
  items: DailyDetailItem[]
  total_days: number
}

