import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { API_BASE_URL, api, getApiErrorMessage } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import { useLearningPathStore } from "@/stores/learning-path"
import { useNotificationStore } from "@/stores/notification"
import {
  Sparkles, Loader2, BookOpen, FolderOpen, Search, Library, ChevronDown,
} from "lucide-react"
import { SubjectGate } from "@/components/navigation/SubjectGate"
import { StudioPageHeader } from "@/components/navigation/StudioPageHeader"
import { QuestionGeneratingOverlay } from "@/components/QuestionGeneratingOverlay"
import {
  QuestionGroup,
  QuestionGroupCard,
  PracticeSession,
  SessionSummary,
} from "@/features/practice"
import { useSubjectStore } from "@/stores/subject"
import { Input } from "@/components/ui/input"

interface Option {
  label: string
  text: string
  is_correct?: boolean
}

interface Question {
  id: string
  question_type: "mcq" | "coding" | "fill_blank" | "short_answer" | "essay"
  stem: string
  options?: Option[] | null
  answer_key?: unknown
  hints?: string[] | null
  difficulty: number
  initial_code?: string
  expected_output?: string
  test_cases?: unknown
}

interface SessionResult {
  totalQuestions: number
  correctCount: number
  wrongCount: number
  answers: { questionId: string; isCorrect: boolean | null; response?: unknown }[]
}

interface QuestionGroupListResponse {
  success: boolean
  groups: QuestionGroup[]
}

interface GroupItemsResponse {
  success: boolean
  items: Question[]
}

interface GenerateQuestionResponse {
  success: boolean
  message: string
  questions: Question[]
  source: "ai" | "database" | "template"
  group_id?: string | null
}

type ViewMode = "dashboard" | "focus" | "summary"
type SourceFilter = "all" | "concept_learning" | "ai_generated"

interface SessionSummaryData {
  results: SessionResult
  xpGained: number
  leveledUp: boolean
  newBadges: Array<{ badge_id: string; name: string; icon?: string }>
  submitFailCount?: number
}

interface GradingDimension {
  name: string
  score: number
  feedback: string
}

interface GradingDetail {
  total_score?: number
  strengths?: string[]
  improvements?: string[]
  dimensions?: GradingDimension[]
}

interface SubmitAttemptApiResponse {
  success: boolean
  is_correct: boolean | null
  score?: number | null
  scoring_method?: string | null
  feedback?: string | null
  grading_detail?: GradingDetail | null
  grading_trace?: string[]
  progress: unknown
  xp_gained: number
  leveled_up: boolean
  new_badges: Array<{ badge_id: string; name: string; icon?: string }>
}

interface GradingEvent {
  type: "start" | "grading_step" | "result" | "done" | "error"
  content?: string
  result?: SubmitAttemptApiResponse
}

type ChapterBucket = {
  chapterKey: string
  chapterTitle: string
  concept: QuestionGroup[]
  ai: QuestionGroup[]
  other: QuestionGroup[]
  total: number
}

type VersionBucket = {
  versionKey: string
  versionTitle: string
  chapters: ChapterBucket[]
  total: number
  chapterCount: number
  isActive: boolean
  version: number | null
}

const SOURCE_FILTERS: Array<{ value: SourceFilter; label: string }> = [
  { value: "all", label: "全部来源" },
  { value: "concept_learning", label: "概念学习" },
  { value: "ai_generated", label: "课后练习" },
]

export default function QuestionBank() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const userId = useAuthStore((s) => s.profile?.user_id)
  const getCurrentSubject = useSubjectStore((s) => s.getCurrentSubject)
  const currentSubject = getCurrentSubject()
  const updateTaskCompletion = useLearningPathStore((s) => s.updateTaskCompletion)
  const pathsBySubject = useLearningPathStore((s) => s.pathsBySubject)
  const activeLearningPathId = currentSubject
    ? pathsBySubject?.[currentSubject.key]?.id ?? null
    : null

  const fromLearningPath = searchParams.get("from") === "learning-path"
  const lpTaskTitle = searchParams.get("taskTitle") || ""
  const lpTaskDescription = searchParams.get("taskDescription") || ""
  const lpTaskId = searchParams.get("taskId") || ""
  const lpGroupId = searchParams.get("groupId") || ""
  const lpEntrySource = searchParams.get("entrySource") || ""
  const lpReturnTo = searchParams.get("returnTo") || ""
  const lpPathId = searchParams.get("pathId") || ""
  const lpVersion = (() => {
    const raw = searchParams.get("version")
    if (!raw) return null
    const parsed = parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  })()
  const lpVersionName = searchParams.get("versionName") || ""
  const lpDay = (() => {
    const d = parseInt(searchParams.get("day") || "", 10)
    return Number.isFinite(d) && d > 0 ? d : 1
  })()
  const lpChapterId = searchParams.get("chapterId") || ""
  const lpChapterTitle = searchParams.get("chapterTitle") || ""
  const lpSubjectKey = searchParams.get("subjectKey") || currentSubject?.key || "python"
  const learningPlanTarget = lpPathId ? `/app/ai-learning-path/plan/${lpPathId}?day=${lpDay}` : `/app/ai-learning-path?day=${lpDay}`
  const summaryBackLabel = lpEntrySource === "concept-learning" && lpReturnTo
    ? "返回文档"
    : fromLearningPath
      ? "返回路线"
      : "返回题库"

  const [viewMode, setViewMode] = useState<ViewMode>("dashboard")
  const [groups, setGroups] = useState<QuestionGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lpGenerating, setLpGenerating] = useState(false)
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")

  // Explicit per-version expansion overrides. Empty map = use default rule.
  const [expandOverride, setExpandOverride] = useState<Record<string, boolean>>({})

  const [currentGroup, setCurrentGroup] = useState<QuestionGroup | null>(null)
  const [practiceQuestions, setPracticeQuestions] = useState<Question[]>([])
  const [practiceLoading, setPracticeLoading] = useState(false)

  const [summaryData, setSummaryData] = useState<SessionSummaryData | null>(null)
  const [isCompletingSession, setIsCompletingSession] = useState(false)

  const backendXpRef = useRef(0)
  const backendBadgesRef = useRef<Array<{ badge_id: string; name: string; icon?: string }>>([])
  const backendLevelUpRef = useRef(false)
  const lpBootstrappedRef = useRef(false)
  const lpCompletionSyncedRef = useRef(false)

  const versionGroups = useMemo(() => {
    const versionMap = new Map<string, VersionBucket>()
    const query = searchQuery.trim().toLowerCase()

    for (const g of groups) {
      if (sourceFilter !== "all" && g.source_type !== sourceFilter) continue

      const versionTitle = g.learning_path_version_name?.trim()
        || (g.learning_path_version ? `学习计划 v${g.learning_path_version}` : "其他来源")
      const versionKey = g.learning_path_id?.trim()
        || (g.learning_path_version ? `learning-path-v${g.learning_path_version}` : "legacy")
      const chapterTitle = g.source_chapter_title?.trim() || g.source_annotation?.trim() || "其他"
      const chapterKey = g.source_chapter_id?.trim() || chapterTitle

      if (query) {
        const searchable = `${versionTitle} ${chapterTitle} ${g.title || ""} ${g.description || ""} ${g.source_task_title || ""}`.toLowerCase()
        if (!searchable.includes(query)) continue
      }

      let versionBucket = versionMap.get(versionKey)
      if (!versionBucket) {
        versionBucket = {
          versionKey,
          versionTitle,
          chapters: [],
          total: 0,
          chapterCount: 0,
          isActive: !!(g.learning_path_id && g.learning_path_id === activeLearningPathId),
          version: g.learning_path_version ?? null,
        }
        versionMap.set(versionKey, versionBucket)
      }

      let chapterBucket = versionBucket.chapters.find((item) => item.chapterKey === chapterKey)
      if (!chapterBucket) {
        chapterBucket = {
          chapterKey,
          chapterTitle,
          concept: [],
          ai: [],
          other: [],
          total: 0,
        }
        versionBucket.chapters.push(chapterBucket)
        versionBucket.chapterCount += 1
      }

      if (g.source_type === "concept_learning") chapterBucket.concept.push(g)
      else if (g.source_type === "ai_generated") chapterBucket.ai.push(g)
      else chapterBucket.other.push(g)
      chapterBucket.total += 1
      versionBucket.total += 1
    }

    return Array.from(versionMap.values())
  }, [groups, searchQuery, sourceFilter, activeLearningPathId])

  const totalGroups = useMemo(
    () => versionGroups.reduce((sum, v) => sum + v.total, 0),
    [versionGroups]
  )
  const activeVersionNode = useMemo(
    () => versionGroups.find((v) => v.isActive) ?? versionGroups[0] ?? null,
    [versionGroups]
  )
  const activeChapterNode = useMemo(
    () => activeVersionNode?.chapters.find((chapter) => chapter.total > 0) ?? null,
    [activeVersionNode]
  )
  const libraryLead = useMemo(() => {
    if (!activeVersionNode) {
      return {
        headline: "练习题将在此处汇总",
        narrative: "随着您在学习计划中的推进，系统会自动将各个环节的练习题整理并归档到这里。",
      }
    }

    if (activeChapterNode) {
      return {
        headline: `建议从「${activeChapterNode.chapterTitle}」继续练习`,
        narrative: `在当前的「${activeVersionNode.versionTitle}」计划中，该章节已有 ${activeChapterNode.total} 组练习可供巩固。`,
      }
    }

    return {
      headline: `继续完成「${activeVersionNode.versionTitle}」的练习`,
      narrative: `这里为您汇总了 ${activeVersionNode.chapterCount} 个章节的练习内容，您可以按章节顺序进行复习。`,
    }
  }, [activeChapterNode, activeVersionNode])

  // Default expand rule:
  //  - if the user is searching, always expand (to not hide matches)
  //  - if there are ≤ 2 versions, expand all (no overwhelm)
  //  - otherwise: expand only the active learning path's version
  const isSearching = searchQuery.trim().length > 0
  const shouldDefaultExpand = useCallback((v: VersionBucket) => {
    if (isSearching) return true
    if (versionGroups.length <= 2) return true
    return v.isActive
  }, [isSearching, versionGroups.length])

  const isVersionExpanded = useCallback((v: VersionBucket) => {
    const override = expandOverride[v.versionKey]
    if (typeof override === "boolean") return override
    return shouldDefaultExpand(v)
  }, [expandOverride, shouldDefaultExpand])

  const toggleVersion = (v: VersionBucket) => {
    setExpandOverride((prev) => ({
      ...prev,
      [v.versionKey]: !isVersionExpanded(v),
    }))
  }

  const fetchGroups = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const resp = await api.get<QuestionGroupListResponse>("/api/question-bank/groups", {
        params: {
          user_id: userId,
          subject_id: currentSubject?.id || undefined,
        },
      })
      if (resp.data.success) {
        setGroups(Array.isArray(resp.data.groups) ? resp.data.groups : [])
      }
    } catch (e) {
      console.error("Failed to load question groups", e)
      setError(getApiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [userId, currentSubject?.id])

  useEffect(() => {
    if (viewMode === "dashboard" && !fromLearningPath) {
      fetchGroups()
    }
  }, [viewMode, fetchGroups, fromLearningPath])

  useEffect(() => {
    if (!fromLearningPath || !userId || lpBootstrappedRef.current) return
    lpBootstrappedRef.current = true

    const bootstrap = async () => {
      setError(null)
      try {
        const groupsResp = await api.get<QuestionGroupListResponse>("/api/question-bank/groups", {
          params: { user_id: userId, subject_id: currentSubject?.id },
        })
        const groups = Array.isArray(groupsResp.data.groups) ? groupsResp.data.groups : []
        const existingGroup = lpGroupId
          ? groups.find((g) => g.id === lpGroupId)
          : groups.find(
            (g) =>
              g.source_task_id === lpTaskId
              && (g.source_type === "ai_generated" || g.source_type === "concept_learning")
              && (g.learning_path_id || "") === lpPathId
              && (g.learning_path_version ?? null) === lpVersion
              && (g.source_chapter_id || "") === lpChapterId
          )

        if (existingGroup) {
          const itemsResp = await api.get<GroupItemsResponse>(
            `/api/question-bank/groups/${existingGroup.id}/items`,
            { params: { user_id: userId } }
          )
          if (itemsResp.data.success && itemsResp.data.items.length > 0) {
            setPracticeQuestions(itemsResp.data.items)
            setCurrentGroup(existingGroup)
            setViewMode("focus")
            return
          }
        }

        if (lpGroupId) {
          try {
            const itemsResp = await api.get<GroupItemsResponse>(
              `/api/question-bank/groups/${lpGroupId}/items`,
              { params: { user_id: userId } }
            )
            if (itemsResp.data.success && itemsResp.data.items.length > 0) {
              setPracticeQuestions(itemsResp.data.items)
              setCurrentGroup({
                id: lpGroupId,
                source_type: lpEntrySource === "concept-learning" ? "concept_learning" : "ai_generated",
                source_task_id: lpTaskId || "",
                learning_path_id: lpPathId || null,
                learning_path_version: lpVersion,
                learning_path_version_name: lpVersionName || null,
                source_day: lpDay,
                source_chapter_id: lpChapterId || null,
                source_chapter_title: lpChapterTitle || null,
                source_task_title: lpTaskTitle || null,
                title: lpTaskTitle || "学习路线练习",
                item_count: itemsResp.data.items.length,
                progress: {
                  attempts_count: 0,
                  correct_count: 0,
                  wrong_count: 0,
                  accuracy_rate: 0,
                  completed_count: 0,
                  total_count: itemsResp.data.items.length,
                  last_practiced_at: null,
                },
              })
              setViewMode("focus")
              return
            }
          } catch (directLoadError) {
            console.error("Failed to load explicit concept-learning group", directLoadError)
          }

          setError("未找到对应题组,请返回概念学习页后重试")
          return
        }

        setLpGenerating(true)
        const resp = await api.post<GenerateQuestionResponse>(
          "/api/question-bank/generate",
          {
            subject_key: lpSubjectKey,
            topic: lpTaskTitle,
            question_type: "mcq",
            difficulty: 2,
            count: 5,
            persist: true,
            group_title: lpTaskTitle,
            group_source_type: "ai_generated",
            group_source_task_id: lpTaskId,
            learning_path_id: lpPathId,
            learning_path_version: lpVersion,
            learning_path_version_name: lpVersionName || undefined,
            source_day: lpDay,
            source_chapter_id: lpChapterId || undefined,
            source_chapter_title: lpChapterTitle || undefined,
            source_task_title: lpTaskTitle || undefined,
          },
          { params: { user_id: userId } }
        )

        if (!resp.data.success || resp.data.questions.length === 0) {
          setError(resp.data.message || "未生成到可练习的题目")
          return
        }

        if (resp.data.group_id) {
          const itemsResp = await api.get<GroupItemsResponse>(
            `/api/question-bank/groups/${resp.data.group_id}/items`,
            { params: { user_id: userId } }
          )
          if (itemsResp.data.success && itemsResp.data.items.length > 0) {
            setPracticeQuestions(itemsResp.data.items)
            setCurrentGroup({
              id: resp.data.group_id,
              source_type: "ai_generated",
              source_task_id: lpTaskId || "",
              learning_path_id: lpPathId || null,
              learning_path_version: lpVersion,
              learning_path_version_name: lpVersionName || null,
              source_day: lpDay,
              source_chapter_id: lpChapterId || null,
              source_chapter_title: lpChapterTitle || null,
              source_task_title: lpTaskTitle || null,
              title: lpTaskTitle || "学习路线练习",
              item_count: itemsResp.data.items.length,
              progress: {
                attempts_count: 0,
                correct_count: 0,
                wrong_count: 0,
                accuracy_rate: 0,
                completed_count: 0,
                total_count: itemsResp.data.items.length,
                last_practiced_at: null,
              },
            })
            setViewMode("focus")
            return
          }
        }

        setError("题目生成成功但保存失败,请返回重试")
      } catch (e) {
        console.error("Failed to bootstrap learning path questions", e)
        setError(getApiErrorMessage(e))
        lpBootstrappedRef.current = false
      } finally {
        setLpGenerating(false)
      }
    }

    bootstrap()
  }, [fromLearningPath, userId, lpSubjectKey, lpTaskTitle, lpTaskDescription, lpTaskId, lpGroupId, lpPathId, lpVersion, lpVersionName, lpDay, lpChapterId, lpChapterTitle, currentSubject?.id])

  const handleDeleteGroup = useCallback(async (group: QuestionGroup) => {
    if (!userId) return
    const groupName = group.title?.trim() || "这组练习"
    try {
      await api.delete(`/api/question-bank/groups/${group.id}`, {
        params: { user_id: userId },
      })
      setGroups((prev) => prev.filter((g) => g.id !== group.id))
      setError(null)
      toast.success(`已移出「${groupName}」`, {
        description: "答题记录保留在学习路径的复盘里。",
      })
    } catch (e) {
      console.error("Failed to delete question group", e)
      const message = getApiErrorMessage(e)
      setError(message)
      toast.error("移出失败", { description: message })
    }
  }, [userId])

  const handleStartPractice = async (group: QuestionGroup) => {
    if (!userId) return
    setCurrentGroup(group)
    setPracticeLoading(true)

    try {
      const resp = await api.get<GroupItemsResponse>(
        `/api/question-bank/groups/${group.id}/items`,
        { params: { user_id: userId } }
      )

      if (resp.data.success && resp.data.items.length > 0) {
        setPracticeQuestions(resp.data.items)
        setViewMode("focus")
      } else {
        setError("该题组暂无题目")
      }
    } catch (e) {
      console.error("Failed to load questions", e)
      setError(getApiErrorMessage(e))
    } finally {
      setPracticeLoading(false)
    }
  }

  const handleSubmitToBackend = async (
    questionId: string,
    answer: unknown,
    onGradingEvent?: (event: GradingEvent) => void
  ): Promise<{
    is_correct: boolean | null
    score?: number | null
    scoring_method?: string | null
    feedback?: string
    grading_detail?: GradingDetail | null
    grading_trace?: string[]
  }> => {
    if (!userId) throw new Error("未登录")
    let data: SubmitAttemptApiResponse
    if (onGradingEvent) {
      const response = await fetch(
        `${API_BASE_URL}/api/question-bank/attempts/stream?user_id=${encodeURIComponent(userId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exercise_item_id: questionId, response: answer }),
        }
      )
      if (!response.ok || !response.body) {
        throw new Error("AI 判题流式提交失败")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let streamResult: SubmitAttemptApiResponse | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split("\n\n")
        buffer = chunks.pop() || ""
        for (const chunk of chunks) {
          const line = chunk.trim()
          if (!line.startsWith("data:")) continue
          const event = JSON.parse(line.slice(5).trim()) as GradingEvent
          onGradingEvent(event)
          if (event.type === "error") {
            throw new Error(event.content || "AI 判题失败")
          }
          if (event.type === "result" && event.result) {
            streamResult = event.result
          }
        }
      }

      if (buffer.trim().startsWith("data:")) {
        const event = JSON.parse(buffer.trim().slice(5).trim()) as GradingEvent
        onGradingEvent(event)
        if (event.type === "result" && event.result) {
          streamResult = event.result
        }
      }

      if (!streamResult) {
        throw new Error("AI 判题没有返回结果")
      }
      data = streamResult
    } else {
      const resp = await api.post<SubmitAttemptApiResponse>(
        "/api/question-bank/attempts",
        { exercise_item_id: questionId, response: answer },
        { params: { user_id: userId } }
      )
      data = resp.data
    }
    backendXpRef.current += data.xp_gained || 0
    if (data.leveled_up) backendLevelUpRef.current = true
    if (data.new_badges?.length) {
      backendBadgesRef.current.push(...data.new_badges)
    }
    return {
      is_correct: data.is_correct ?? null,
      score: data.score ?? null,
      scoring_method: data.scoring_method ?? null,
      feedback: data.feedback ?? undefined,
      grading_detail: data.grading_detail ?? null,
      grading_trace: data.grading_trace ?? [],
    }
  }

  const handleGetExplanation = async (questionId: string) => {
    if (!userId) return null
    const question = practiceQuestions.find((q) => q.id === questionId)
    if (!question) return null
    try {
      const resp = await api.post<{
        success: boolean
        explanation?: string | null
        key_points?: string[] | null
        similar_examples?: string[] | null
        error?: string | null
      }>(
        "/api/question-bank/explain",
        {
          question_id: questionId,
          question: question.stem,
          user_answer: "",
          question_type: question.question_type,
        },
        { params: { user_id: userId } }
      )
      return resp.data
    } catch (e) {
      console.error("Failed to get explanation", e)
      return { success: false, error: getApiErrorMessage(e) } as const
    }
  }

  const handleGetHint = async (
    questionId: string,
    hintLevel: number
  ): Promise<{ hint_text: string } | null> => {
    if (!userId) return null
    try {
      const resp = await api.post<{
        success: boolean
        hint_text?: string
      }>(
        "/api/question-bank/hints",
        { exercise_item_id: questionId, hint_level: hintLevel },
        { params: { user_id: userId } }
      )
      if (resp.data.success && resp.data.hint_text) {
        return { hint_text: resp.data.hint_text }
      }
      return null
    } catch (e) {
      console.error("Failed to get hint", e)
      return null
    }
  }

  const handleRunCode = async (
    code: string
  ): Promise<{ success: boolean; output: string; error: string | null; execution_time_ms: number }> => {
    const resp = await api.post<{
      success: boolean
      output: string
      error: string | null
      execution_time_ms: number
    }>("/api/practice/execute", { code, timeout: 10 })
    return resp.data
  }

  const handlePracticeComplete = async (results: SessionResult) => {
    setIsCompletingSession(true)
    try {
      let totalXp = 0
      let didLevelUp = false
      const allBadges: Array<{ badge_id: string; name: string; icon?: string }> = []
      let submitFailCount = 0

      if (userId && currentGroup) {
        const mcqIds = new Set(
          practiceQuestions
            .filter((q) => q.question_type === "mcq")
            .map((q) => q.id)
        )
        for (const answer of results.answers) {
          if (!mcqIds.has(answer.questionId)) continue
          try {
            const resp = await api.post<{
              success: boolean
              xp_gained: number
              leveled_up: boolean
              new_badges: Array<{ badge_id: string; name: string; icon?: string }>
            }>(
              "/api/question-bank/attempts",
              {
                exercise_item_id: answer.questionId,
                response: answer.response,
              },
              { params: { user_id: userId } }
            )

            if (resp.data.success) {
              totalXp += resp.data.xp_gained || 0
              if (resp.data.leveled_up) didLevelUp = true
              if (resp.data.new_badges?.length) {
                allBadges.push(...resp.data.new_badges)
              }
            }
          } catch (e) {
            console.error("Failed to save attempt", e)
            submitFailCount++
          }
        }
      }

      totalXp += backendXpRef.current
      if (backendLevelUpRef.current) didLevelUp = true
      allBadges.push(...backendBadgesRef.current)

      backendXpRef.current = 0
      backendBadgesRef.current = []
      backendLevelUpRef.current = false

      if (fromLearningPath && lpPathId && lpTaskId && !lpCompletionSyncedRef.current) {
        lpCompletionSyncedRef.current = true
        try {
          await api.put(`/api/ai-learning-path/${lpPathId}/progress`, {
            day: lpDay,
            task_id: lpTaskId,
            completed: true,
          })
          updateTaskCompletion(lpSubjectKey, lpDay, lpTaskId, true)
        } catch (e) {
          console.error("Failed to sync learning path progress", e)
        }
      }

      setSummaryData({
        results,
        xpGained: totalXp,
        leveledUp: didLevelUp,
        newBadges: allBadges,
        submitFailCount,
      })
      setViewMode("summary")

      const notifStore = useNotificationStore.getState()
      notifStore.addNotification("exercise_complete")
      if (didLevelUp) {
        notifStore.addNotification("level_up")
      }
      for (const badge of allBadges) {
        notifStore.addNotification("badge", `🏅 获得徽章:${badge.name}`, `恭喜你解锁了「${badge.name}」徽章,继续努力吧!`)
      }
    } finally {
      setIsCompletingSession(false)
    }
  }

  const handleExitPractice = () => {
    if (lpEntrySource === "concept-learning" && lpReturnTo) {
      navigate(lpReturnTo, { replace: true })
      return
    }
    if (fromLearningPath) {
      navigate(learningPlanTarget, { replace: true })
      return
    }
    setViewMode("dashboard")
    setPracticeQuestions([])
    setCurrentGroup(null)
  }

  const handleBackToDashboard = () => {
    if (lpEntrySource === "concept-learning" && lpReturnTo) {
      navigate(lpReturnTo, { replace: true })
      return
    }
    if (fromLearningPath) {
      navigate(learningPlanTarget, { replace: true })
      return
    }
    setViewMode("dashboard")
    setPracticeQuestions([])
    setCurrentGroup(null)
    setSummaryData(null)
  }

  const handleReviewWrong = () => {
    if (summaryData) {
      const wrongIds = new Set(
        summaryData.results.answers
          .filter((a) => a.isCorrect === false)
          .map((a) => a.questionId)
      )
      const wrongQuestions = practiceQuestions.filter((q) => wrongIds.has(q.id))
      if (wrongQuestions.length > 0) {
        setPracticeQuestions(wrongQuestions)
        setSummaryData(null)
        setViewMode("focus")
      } else {
        handleBackToDashboard()
      }
    }
  }

  if (lpGenerating) {
    return (
      <QuestionGeneratingOverlay
        title={lpTaskTitle || "学习路线练习"}
        description={lpTaskDescription || undefined}
      />
    )
  }

  if (viewMode === "summary" && summaryData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <SessionSummary
          results={summaryData.results}
          xpGained={summaryData.xpGained}
          leveledUp={summaryData.leveledUp}
          newBadges={summaryData.newBadges}
          submitFailCount={summaryData.submitFailCount}
          backLabel={summaryBackLabel}
          onReviewWrong={handleReviewWrong}
          onBackToDashboard={handleBackToDashboard}
        />
      </div>
    )
  }

  if (viewMode === "focus") {
    return (
      <>
        <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-950">
          <PracticeSession
            questions={practiceQuestions}
            onExit={handleExitPractice}
            onComplete={handlePracticeComplete}
            onGetExplanation={handleGetExplanation}
            onSubmitToBackend={handleSubmitToBackend}
            onGetHint={handleGetHint}
            onRunCode={handleRunCode}
          />
        </div>
        {isCompletingSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 shadow-2xl dark:bg-slate-900">
              <Loader2 className="h-8 w-8 animate-spin text-[oklch(50%_0.1_165)]" />
              <p className="font-medium text-slate-700 dark:text-slate-300">正在保存练习进度…</p>
            </div>
          </div>
        )}
      </>
    )
  }

  // ─── Dashboard Mode ──────────────────────────────────────────
  return (
    <SubjectGate featureName="智能题库">
      <div className="mx-auto flex max-w-[92rem] flex-col gap-10 pb-16">
        <StudioPageHeader
          label="题库"
          labelLatin="LIBRARY"
          title="智能题库"
          subtitle="自动汇总您在学习过程中产生的所有练习题，并按章节分类，方便您随时复习和巩固。"
          meta={
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-[0_8px_28px_rgba(15,23,42,0.04)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-[oklch(90%_0.03_165)] bg-[oklch(97%_0.018_165)] px-3.5 py-1.5 text-[13px] font-medium text-[oklch(36%_0.08_165)] dark:border-[oklch(30%_0.05_165)] dark:bg-[oklch(22%_0.035_165)] dark:text-[oklch(82%_0.08_165)]">
                  <BookOpen className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {currentSubject?.name || "未选择科目"}
                </span>
                <span className="hidden font-mono text-[12px] tracking-wider text-slate-400 md:inline">
                  {totalGroups.toString().padStart(2, "0")} 个题组
                </span>
              </div>
              <div className="flex flex-col gap-2 md:ml-auto md:flex-row md:items-center md:gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索章节或题组标题…"
                    className="h-11 w-full min-w-[260px] rounded-xl border-slate-200 bg-white pl-10 text-[14px] transition-colors focus-visible:border-[oklch(55%_0.1_165)] focus-visible:ring-2 focus-visible:ring-[oklch(55%_0.1_165)]/20 dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div role="radiogroup" aria-label="题目来源" className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white p-1 dark:border-slate-800 dark:bg-slate-900/60">
                  {SOURCE_FILTERS.map(({ value, label }) => {
                    const active = sourceFilter === value
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSourceFilter(value)}
                        className={`h-9 rounded-lg px-3.5 text-[13px] font-medium transition-all ${
                          active
                            ? "bg-slate-900 text-white shadow-[0_6px_18px_-8px_rgba(15,23,42,0.5)] dark:bg-slate-100 dark:text-slate-900"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          }
        />

        {error && (
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/70 px-5 py-4 text-[14px] leading-6 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-[oklch(50%_0.1_165)]" />
          </div>
        ) : versionGroups.length > 0 ? (
          <div className="space-y-12">
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
              <article className="rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-7 shadow-[0_18px_60px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.78))]">
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[oklch(48%_0.08_165)] dark:text-[oklch(80%_0.07_165)]">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[oklch(88%_0.03_165)] bg-white/75 px-3 py-1 shadow-sm dark:border-[oklch(32%_0.03_165)] dark:bg-slate-900/60">
                    <BookOpen className="h-3.5 w-3.5" strokeWidth={1.8} />
                    当前继续
                  </span>
                  {activeVersionNode && (
                    <span className="font-mono text-[10px] tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      {activeVersionNode.versionTitle}
                    </span>
                  )}
                </div>
                <h2 className="mt-5 max-w-[15ch] font-display text-[clamp(1.85rem,2.8vw,2.6rem)] font-semibold leading-[1.08] tracking-tight text-slate-900 dark:text-slate-50">
                  {libraryLead.headline}
                </h2>
                <p className="mt-4 max-w-[60ch] text-[15px] leading-8 text-slate-600 dark:text-slate-300">
                  {libraryLead.narrative}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {activeChapterNode && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3.5 py-2 text-[13px] font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200">
                      <span className="h-2 w-2 rounded-full bg-[oklch(55%_0.11_165)]" />
                      当前章节 · {activeChapterNode.chapterTitle}
                    </span>
                  )}
                  {sourceFilter !== "all" && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3.5 py-2 text-[13px] font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200">
                      来源筛选 · {SOURCE_FILTERS.find((item) => item.value === sourceFilter)?.label}
                    </span>
                  )}
                  {searchQuery.trim() && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3.5 py-2 text-[13px] font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200">
                      搜索中 · {searchQuery.trim()}
                    </span>
                  )}
                </div>
              </article>

              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <article className="rounded-[1.6rem] border border-slate-200/80 bg-white p-5 shadow-[0_10px_32px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900/55">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    当前计划
                  </div>
                  <div className="mt-3 text-[18px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                    {activeVersionNode?.versionTitle || "暂无学习计划"}
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
                    {activeVersionNode ? `包含 ${activeVersionNode.chapterCount} 个章节，共 ${activeVersionNode.total} 组练习` : "开始练习后，这里将显示您当前的进度。"}
                  </p>
                </article>

                <article className="rounded-[1.6rem] border border-slate-200/80 bg-white p-5 shadow-[0_10px_32px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900/55">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    推荐练习
                  </div>
                  <div className="mt-3 text-[18px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                    {activeChapterNode?.chapterTitle || "暂无推荐章节"}
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
                    {activeChapterNode ? "建议优先复习此章节的练习内容。" : "当有新的练习生成时，系统会在此推荐给您。"}
                  </p>
                </article>

                <article className="rounded-[1.6rem] border border-slate-200/80 bg-white p-5 shadow-[0_10px_32px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900/55">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    题库总量
                  </div>
                  <div className="mt-3 text-[18px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                    {totalGroups} 组练习
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
                    {searchQuery.trim() || sourceFilter !== "all"
                      ? "显示当前筛选条件下的题组数量。"
                      : "展示所有可用的练习题组。您可以使用搜索或筛选功能查找特定内容。"}
                  </p>
                </article>
              </div>
            </section>

            <div className="space-y-14">
              {versionGroups.map((versionNode, vIdx) => {
                const expanded = isVersionExpanded(versionNode)
                return (
                  <section key={versionNode.versionKey} className="space-y-8">
                    {/* Version row — clickable to collapse / expand */}
                    <button
                      type="button"
                      onClick={() => toggleVersion(versionNode)}
                      aria-expanded={expanded}
                      className="group/row flex w-full flex-wrap items-end justify-between gap-3 border-b border-slate-200/80 pb-4 text-left transition-colors hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                    >
                      <div className="flex items-baseline gap-4">
                        <span className="font-mono text-[12px] font-medium tracking-[0.16em] text-slate-400">
                          {String(vIdx + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[oklch(52%_0.06_165)] dark:text-[oklch(72%_0.06_165)]">
                            <span>学习计划</span>
                            {versionNode.isActive && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(97%_0.022_165)] px-2 py-0.5 text-[10px] font-medium tracking-[0.1em] text-[oklch(40%_0.1_165)] dark:bg-[oklch(26%_0.03_165)] dark:text-[oklch(82%_0.08_165)]">
                                <span className="h-1 w-1 rounded-full bg-[oklch(62%_0.15_165)]" />
                                当前
                              </span>
                            )}
                          </div>
                          <h2 className="mt-1 font-display text-[1.45rem] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                            {versionNode.versionTitle}
                          </h2>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-[12px] text-slate-500 dark:text-slate-400">
                        <span className="font-mono tracking-wider">
                          {versionNode.total} 题组 · {versionNode.chapterCount} 章
                        </span>
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/80 text-slate-500 transition-transform group-hover/row:border-slate-300 group-hover/row:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:group-hover/row:text-slate-100">
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                            strokeWidth={1.8}
                          />
                        </span>
                      </div>
                    </button>

                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${
                        expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="space-y-10 pt-2">
                          {versionNode.chapters.map((chapterNode, cIdx) => {
                            const chapterGroups = [
                              ...chapterNode.concept,
                              ...chapterNode.ai,
                              ...chapterNode.other,
                            ]
                            const sourceSummary = [
                              {
                                key: "concept",
                                label: "概念学习",
                                count: chapterNode.concept.length,
                                icon: BookOpen,
                                className: "border-[oklch(88%_0.03_220)] bg-[oklch(97%_0.02_220)] text-[oklch(38%_0.07_220)] dark:border-[oklch(30%_0.03_220)] dark:bg-[oklch(24%_0.03_220)] dark:text-[oklch(82%_0.08_220)]",
                              },
                              {
                                key: "ai",
                                label: "课后练习",
                                count: chapterNode.ai.length,
                                icon: Sparkles,
                                className: "border-[oklch(88%_0.03_165)] bg-[oklch(97%_0.02_165)] text-[oklch(38%_0.08_165)] dark:border-[oklch(30%_0.03_165)] dark:bg-[oklch(24%_0.03_165)] dark:text-[oklch(82%_0.08_165)]",
                              },
                              {
                                key: "other",
                                label: "其他练习",
                                count: chapterNode.other.length,
                                icon: FolderOpen,
                                className: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
                              },
                            ].filter((item) => item.count > 0)

                            return (
                              <section
                                key={`${versionNode.versionKey}-${chapterNode.chapterKey}`}
                                className="space-y-5"
                              >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                  <div className="space-y-3">
                                    <div className="flex items-baseline gap-3">
                                      <span className="font-mono text-[12px] tracking-[0.16em] text-slate-400">
                                        §{String(cIdx + 1).padStart(2, "0")}
                                      </span>
                                      <h3 className="font-display text-[19px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                                        {chapterNode.chapterTitle}
                                      </h3>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {sourceSummary.map(({ key, label, count, icon: Icon, className }) => (
                                        <span
                                          key={key}
                                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium ${className}`}
                                        >
                                          <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                                          {label}
                                          <span className="font-mono text-[11px] opacity-70">{count}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <p className="max-w-[34ch] text-[13px] leading-6 text-slate-500 dark:text-slate-400">
                                    此章节的所有练习题已为您整理在此。您可以通过卡片上的标签了解题目的具体来源。
                                  </p>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                  {chapterGroups.map((group) => (
                                    <QuestionGroupCard
                                      key={group.id}
                                      group={group}
                                      onStart={handleStartPractice}
                                      onDelete={handleDeleteGroup}
                                      loading={practiceLoading && currentGroup?.id === group.id}
                                    />
                                  ))}
                                </div>
                              </section>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-8 py-16 text-center dark:border-slate-800 dark:bg-slate-900/40">
            <Library className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" strokeWidth={1.5} />
            <h3 className="mt-4 font-display text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              题库暂无内容
            </h3>
            <p className="mx-auto mt-2 max-w-[40ch] text-[14px] leading-7 text-slate-500 dark:text-slate-400">
              您还没有生成任何练习题。在概念学习或学习计划中完成学习任务后，相关的练习题会自动保存到这里。
            </p>
          </div>
        )}
      </div>
    </SubjectGate>
  )
}
