import { useCallback, useEffect, useRef, useState, useMemo } from "react"
import {
  Loader2,
  CheckCircle2,
  Target,
  EyeOff,
  ArrowRight,
  MousePointerClick,
  Tags,
  Sparkles,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

import { SubjectGate } from "@/components/navigation/SubjectGate"
import { LearningPathAgentPanel } from "@/components/learning-path-workbench/LearningPathAgentPanel"
import { LearningPathTreePanel } from "@/components/learning-path-workbench/LearningPathTreePanel"
import { GeneratingOverlay } from "@/components/learning-path-workbench/GeneratingOverlay"
import { SkillTreeSnapshotSelector } from "@/components/learning-path-workbench/SkillTreeSnapshotSelector"
import { api, getApiErrorMessage } from "@/lib/api"
import {
  type AgentMessage,
  expandLearningPathSkillNode,
  fetchLearningPathMap,
  fetchSkillTreeSnapshots,
  createSkillTreeSnapshot,
  activateSkillTreeSnapshot,
  renameSkillTreeSnapshot,
  deleteSkillTreeSnapshot,
  resetSkillTreeSnapshot,
  generateLearningPathFromSession,
  getReadyCheck,
  replyClarificationSession,
  savePreferenceSnapshot,
  streamReplyClarificationSession,
  streamStartClarificationSession,
  startClarificationSession,
} from "@/lib/learningPathWorkbench"
import { useAuthStore } from "@/stores/auth"
import { useLearningPathStore, type LearningPath } from "@/stores/learning-path"
import { useLearningPathWorkbenchStore } from "@/stores/learning-path-workbench"
import { useSubjectStore } from "@/stores/subject"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type WorkbenchStep = "starmap" | "planner"

const ONBOARDING_KEY = "ai-learning-path-onboarding-seen"

/* ─────────────────────────── Step Indicator ─────────────────────────── */

function StepIndicator({
  current,
  onGoToStarmap,
}: {
  current: WorkbenchStep
  onGoToStarmap: () => void
}) {
  const steps = [
    { key: "starmap" as const, label: "标注学习星图", number: 1 },
    { key: "planner" as const, label: "AI 规划助手", number: 2 },
  ]

  return (
    <div className="flex items-center justify-center gap-2 select-none">
      {steps.map((step, idx) => {
        const isActive = step.key === current
        const isDone = current === "planner" && step.key === "starmap"

        return (
          <div key={step.key} className="flex items-center gap-2">
            {idx > 0 && (
              <div
                className={cn(
                  "hidden sm:block h-px w-10 transition-colors duration-500",
                  isDone || isActive ? "bg-teal-400" : "bg-slate-200"
                )}
              />
            )}
            <button
              type="button"
              disabled={step.key === "planner"}
              onClick={() => {
                if (step.key === "starmap") onGoToStarmap()
              }}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300",
                isActive
                  ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                  : isDone
                    ? "bg-teal-50 text-teal-700 border border-teal-200 cursor-pointer hover:bg-teal-100"
                    : "bg-slate-100 text-slate-400 cursor-default"
              )}
            >
              {isDone ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 text-slate-500"
                  )}
                >
                  {step.number}
                </span>
              )}
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.number === 1 ? "星图" : "规划"}</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────── Onboarding Overlay ──────────────────────── */

function OnboardingOverlay({ onDismiss }: { onDismiss: () => void }) {
  const guides = [
    {
      icon: MousePointerClick,
      title: "探索节点",
      desc: "点击星图中的节点查看详情，点击空白处收起",
    },
    {
      icon: Tags,
      title: "标注偏好",
      desc: "将每个知识节点标记为「已掌握」「想学习」或「暂不学」",
    },
    {
      icon: Sparkles,
      title: "进入规划",
      desc: "标注完成后，点击底部「下一步」进入 AI 规划助手",
    },
  ]

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-500">
      <div className="relative mx-4 w-full max-w-md rounded-3xl border border-white/10 bg-white p-8 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 shadow-lg shadow-teal-500/30">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            欢迎来到学习星图
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            用三步完成你的专属学习路线定制
          </p>
        </div>

        <div className="space-y-4">
          {guides.map((guide, index) => {
            const Icon = guide.icon
            return (
              <div
                key={guide.title}
                className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition-all hover:border-teal-200 hover:bg-teal-50/40"
                style={{
                  animationDelay: `${(index + 1) * 150}ms`,
                  animation: "fadeInUp 0.5s ease-out both",
                }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
                  <Icon className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {guide.title}
                  </div>
                  <div className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
                    {guide.desc}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <Button
          type="button"
          onClick={onDismiss}
          className="mt-6 h-12 w-full rounded-2xl bg-teal-600 text-sm font-semibold text-white shadow-md shadow-teal-600/20 transition-all hover:bg-teal-700 hover:shadow-lg"
        >
          开始探索
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

/* ─────────────────────── Preference Stats Bar ────────────────────────── */

function PreferenceStatsBar({
  preferences,
  onNext,
  disabled,
}: {
  preferences: {
    known_node_ids: string[]
    target_node_ids: string[]
    avoid_node_ids: string[]
  }
  onNext: () => void
  disabled: boolean
}) {
  const totalMarked =
    preferences.known_node_ids.length +
    preferences.target_node_ids.length +
    preferences.avoid_node_ids.length

  return (
    <div className="flex items-center justify-between gap-4 rounded-t-2xl border-t border-slate-200/80 bg-white/95 px-5 py-3 backdrop-blur-xl sm:px-8">
      {/* Stats */}
      <div className="flex items-center gap-3 overflow-x-auto">
        {[
          {
            icon: CheckCircle2,
            count: preferences.known_node_ids.length,
            label: "已掌握",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            border: "border-emerald-200",
          },
          {
            icon: Target,
            count: preferences.target_node_ids.length,
            label: "想学习",
            color: "text-sky-600",
            bg: "bg-sky-50",
            border: "border-sky-200",
          },
          {
            icon: EyeOff,
            count: preferences.avoid_node_ids.length,
            label: "暂不学",
            color: "text-amber-600",
            bg: "bg-amber-50",
            border: "border-amber-200",
          },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                stat.count > 0
                  ? `${stat.bg} ${stat.color} ${stat.border}`
                  : "border-slate-200 bg-slate-50 text-slate-400"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{stat.count}</span>
              <span className="hidden sm:inline">{stat.label}</span>
            </div>
          )
        })}
      </div>

      {/* Next Step */}
      <div className="flex shrink-0 items-center gap-3">
        <Button
          type="button"
          onClick={onNext}
          disabled={disabled}
          className="h-10 rounded-xl px-5 text-sm font-semibold transition-all duration-300 bg-teal-600 text-white shadow-md shadow-teal-600/20 hover:bg-teal-700 hover:shadow-lg hover:-translate-y-0.5"
        >
          {totalMarked === 0 ? "跳过标注，下一步" : "下一步"}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/* ════════════════════════════ MAIN COMPONENT ════════════════════════════ */

export default function AILearningPath() {
  const navigate = useNavigate()
  const profile = useAuthStore((state) => state.profile)
  const currentSubjectId = useSubjectStore((state) => state.currentSubjectId)
  const subjects = useSubjectStore((state) => state.subjects)
  const currentSubject = subjects.find((subject) => subject.id === currentSubjectId)
  const currentSubjectKey = currentSubject?.key || "python"

  const { setPathForSubject, startGenerating, stopGenerating } = useLearningPathStore()
  const cachedActivePath = useLearningPathStore((state) => state.getPathForSubject(currentSubjectKey))

  const {
    map,
    session,
    ready,
    selectedNodeId,
    preferences,
    snapshots,
    activeSnapshotId,
    setSubject,
    setMap,
    setSession,
    setReady,
    setSelectedNodeId,
    setNodePreference,
    setSnapshots,
  } = useLearningPathWorkbenchStore()

  const [loading, setLoading] = useState(true)
  const [replying, setReplying] = useState(false)
  const [savingPreference, setSavingPreference] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [expandingNode, setExpandingNode] = useState(false)
  const [expansionMode, setExpansionMode] = useState<"curriculum" | "practical">("curriculum")
  const [detailExpanded, setDetailExpanded] = useState(false)
  const [plannerLoading, setPlannerLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [_activePath, setActivePath] = useState<LearningPath | null>(cachedActivePath)
  const [streamingAssistantMessage, setStreamingAssistantMessage] = useState<AgentMessage | null>(null)

  /* ── Step management ── */
  const [currentStep, setCurrentStep] = useState<WorkbenchStep>("starmap")
  const [showOnboarding, setShowOnboarding] = useState(() => {
    // 调试期间强制显示，忽略 localStorage 缓存
    return true
  })
  const [stepTransitionClass, setStepTransitionClass] = useState("")

  const loadSeqRef = useRef(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const sessionStartedRef = useRef(false)

  useEffect(() => {
    setActivePath(cachedActivePath)
  }, [cachedActivePath])

  /* ── Data loading ── */

  // Step 1: Only load the star map on page mount
  const loadStarMap = useCallback(async (requestId?: number) => {
    if (!profile?.user_id) return

    const mapPayload = await fetchLearningPathMap(currentSubjectKey, profile.user_id)
    if (requestId !== undefined && requestId !== loadSeqRef.current) return
    setMap(mapPayload)
    setSelectedNodeId(null)
  }, [currentSubjectKey, profile?.user_id, setMap, setSelectedNodeId])

  const loadSnapshots = useCallback(async () => {
    if (!profile?.user_id) return
    try {
      const list = await fetchSkillTreeSnapshots(currentSubjectKey, profile.user_id)
      setSnapshots(list)
    } catch {
      // ignore - snapshots are optional UI
    }
  }, [currentSubjectKey, profile?.user_id, setSnapshots])

  // Step 2: Start the clarification session only when entering the planner step
  const startPlannerSession = useCallback(async () => {
    if (!profile?.user_id) return
    if (sessionStartedRef.current) return // already started
    sessionStartedRef.current = true

    setPlannerLoading(true)
    setErrorMessage(null)

    try {
      await streamStartClarificationSession(profile.user_id, currentSubjectKey, {
        onStart: (streamSession) => {
          setSession(streamSession)
          setReady(null)
          setStreamingAssistantMessage({
            role: "assistant",
            message_type: "question",
            content: "",
            structured_payload: null,
          })
          setPlannerLoading(false)
        },
        onContent: (content) => {
          setStreamingAssistantMessage((previous) => ({
            role: "assistant",
            message_type: previous?.message_type ?? "question",
            content: `${previous?.content ?? ""}${content}`,
            structured_payload: previous?.structured_payload ?? null,
          }))
        },
        onOptions: ({ quick_options, structured_payload }) => {
          setStreamingAssistantMessage((previous) => ({
            role: "assistant",
            message_type: previous?.message_type ?? "question",
            content: previous?.content ?? "",
            structured_payload: {
              ...(previous?.structured_payload ?? {}),
              ...(structured_payload ?? {}),
              quick_options,
            },
          }))
        },
        onDone: ({ session: nextSession, ready_check }) => {
          setSession(nextSession)
          setReady(ready_check)
          setStreamingAssistantMessage(null)
          setPlannerLoading(false)
        },
        onError: () => { setPlannerLoading(false) },
      })
    } catch {
      try {
        const sessionPayload = await startClarificationSession(profile.user_id, currentSubjectKey)
        setSession(sessionPayload)
        setStreamingAssistantMessage(null)
        const readyPayload = await getReadyCheck(sessionPayload.session_id)
        setReady(readyPayload)
      } catch (fallbackError) {
        setErrorMessage(getApiErrorMessage(fallbackError))
      } finally {
        setPlannerLoading(false)
      }
    }
  }, [currentSubjectKey, profile?.user_id, setReady, setSession])

  const loadActivePlan = useCallback(async (requestId?: number) => {
    if (!profile?.user_id) return

    const cachedPath = useLearningPathStore.getState().getPathForSubject(currentSubjectKey)
    if (cachedPath?.user_id === profile.user_id) {
      if (requestId !== undefined && requestId !== loadSeqRef.current) return
      setActivePath(cachedPath)
      return
    }

    try {
      const response = await api.get<LearningPath>(
        `/api/ai-learning-path/user/${profile.user_id}/active`,
        { params: { subject_key: currentSubjectKey } },
      )
      if (requestId !== undefined && requestId !== loadSeqRef.current) return
      setActivePath(response.data)
      setPathForSubject(currentSubjectKey, response.data)
    } catch (error: unknown) {
      if ((error as { response?: { status?: number } }).response?.status === 404) {
        if (requestId !== undefined && requestId !== loadSeqRef.current) return
        setActivePath(null)
        return
      }
      throw error
    }
  }, [currentSubjectKey, profile?.user_id, setPathForSubject])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      if (!profile?.user_id) return
      const requestId = ++loadSeqRef.current
      setLoading(true)
      setErrorMessage(null)
      setSubject(currentSubjectKey)
      // Reset session state when subject changes
      sessionStartedRef.current = false

      try {
        await Promise.all([
          loadStarMap(requestId),
          loadActivePlan(requestId),
          loadSnapshots(),
        ])
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getApiErrorMessage(error))
        }
      } finally {
        if (!cancelled && requestId === loadSeqRef.current) {
          setLoading(false)
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [currentSubjectKey, loadActivePlan, loadStarMap, profile?.user_id, setSubject])

  /* ── Preference persistence (unchanged) ── */

  const persistPreferences = useCallback(async () => {
    if (!session?.session_id) return

    setSavingPreference(true)
    try {
      await savePreferenceSnapshot(session.session_id, useLearningPathWorkbenchStore.getState().preferences)
      setReady(await getReadyCheck(session.session_id))
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setSavingPreference(false)
    }
  }, [session?.session_id, setReady])

  useEffect(() => {
    if (!session?.session_id) return
    const timer = window.setTimeout(() => {
      void persistPreferences()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [persistPreferences, preferences, session?.session_id])

  /* ── Handlers (unchanged logic) ── */

  const handleSetPreference = useCallback(
    (nodeId: string, preference: "known" | "target" | "avoid" | null) => {
      setNodePreference(nodeId, preference)
    },
    [setNodePreference],
  )

  const handleSendReply = useCallback(
    async (content: string) => {
      if (!session?.session_id) return
      setReplying(true)
      setErrorMessage(null)

      try {
        await streamReplyClarificationSession(session.session_id, content, {
          onStart: (streamSession) => {
            setSession(streamSession)
            setStreamingAssistantMessage({
              role: "assistant",
              message_type: "question",
              content: "",
              structured_payload: null,
            })
          },
          onContent: (chunk) => {
            setStreamingAssistantMessage((previous) => ({
              role: "assistant",
              message_type: previous?.message_type ?? "question",
              content: `${previous?.content ?? ""}${chunk}`,
              structured_payload: previous?.structured_payload ?? null,
            }))
          },
          onOptions: ({ quick_options, structured_payload }) => {
            setStreamingAssistantMessage((previous) => ({
              role: "assistant",
              message_type: previous?.message_type ?? "question",
              content: previous?.content ?? "",
              structured_payload: {
                ...(previous?.structured_payload ?? {}),
                ...(structured_payload ?? {}),
                quick_options,
              },
            }))
          },
          onDone: ({ session: nextSession, ready_check }) => {
            setSession(nextSession)
            setReady(ready_check)
            setStreamingAssistantMessage(null)
          },
          onError: () => {},
        })
      } catch (error) {
        setStreamingAssistantMessage(null)
        try {
          const nextSession = await replyClarificationSession(session.session_id, content)
          setSession(nextSession)
          setReady(await getReadyCheck(session.session_id))
        } catch (fallbackError) {
          setErrorMessage(getApiErrorMessage(fallbackError))
        }
      } finally {
        setReplying(false)
      }
    },
    [session?.session_id, setReady, setSession],
  )

  const visibleMessages = useMemo(() => {
    const baseMessages = session?.messages ?? []
    return streamingAssistantMessage ? [...baseMessages, streamingAssistantMessage] : baseMessages
  }, [session?.messages, streamingAssistantMessage])

  const selectedPreference = selectedNodeId
    ? preferences.known_node_ids.includes(selectedNodeId)
      ? "known"
      : preferences.target_node_ids.includes(selectedNodeId)
        ? "target"
        : preferences.avoid_node_ids.includes(selectedNodeId)
          ? "avoid"
          : null
    : null

  const handleGenerate = useCallback(async () => {
    if (!session?.session_id) return

    startGenerating()
    setGenerating(true)
    setErrorMessage(null)

    try {
      const payload = await generateLearningPathFromSession(session.session_id)
      setReady(payload.ready_check)
      setPathForSubject(currentSubjectKey, payload.path)
      setActivePath(payload.path)
      navigate(`/app/ai-learning-path/plan/${payload.path.id}`)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setGenerating(false)
      stopGenerating()
    }
  }, [currentSubjectKey, navigate, session?.session_id, setPathForSubject, setReady, startGenerating, stopGenerating])

  const handleExpandNode = useCallback(async () => {
    if (!selectedNodeId || !profile?.user_id || selectedPreference !== "target") return

    setExpandingNode(true)
    setErrorMessage(null)
    try {
      let currentSessionId = session?.session_id
      if (!currentSessionId) {
        sessionStartedRef.current = true
        const sessionPayload = await startClarificationSession(profile.user_id, currentSubjectKey)
        setSession(sessionPayload)
        currentSessionId = sessionPayload.session_id
        const readyPayload = await getReadyCheck(currentSessionId)
        setReady(readyPayload)
      }

      const payload = await expandLearningPathSkillNode(currentSessionId, selectedNodeId, expansionMode)
      setMap(payload as any)
      if (payload.new_node_ids.length > 0) {
        setSelectedNodeId(payload.new_node_ids[0])
      }
    } catch (error) {
      console.error("[AI Path] expand-node failed", error)
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setExpandingNode(false)
    }
  }, [expansionMode, profile?.user_id, selectedNodeId, selectedPreference, session?.session_id, currentSubjectKey, setSession, setReady, setMap, setSelectedNodeId])

  const selectedNode = useMemo(() => {
    if (!map || !selectedNodeId) return null
    const find = (n: any): any => {
      if (n.id === selectedNodeId) return n
      for (const c of n.children) {
        const found = find(c)
        if (found) return found
      }
      return null
    }
    return find(map.tree)
  }, [map, selectedNodeId])

  useEffect(() => {
    const handleGenerateRequest = () => {
      if (!ready?.ready || generating) return
      void handleGenerate()
    }

    window.addEventListener("ai-learning-path:generate-request", handleGenerateRequest)
    return () => window.removeEventListener("ai-learning-path:generate-request", handleGenerateRequest)
  }, [generating, handleGenerate, ready?.ready])

  const handleWorkbenchNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId)
  }, [setSelectedNodeId])

  /* ── Step navigation ── */

  const goToPlanner = useCallback(() => {
    setStepTransitionClass("animate-slide-out-left")
    setTimeout(() => {
      setCurrentStep("planner")
      setStepTransitionClass("animate-slide-in-right")
      setTimeout(() => setStepTransitionClass(""), 500)
      // Start the clarification session when entering the planner step
      void startPlannerSession()
    }, 300)
  }, [startPlannerSession])

  const goToStarmap = useCallback(() => {
    setStepTransitionClass("animate-slide-out-right")
    setTimeout(() => {
      setCurrentStep("starmap")
      setStepTransitionClass("animate-slide-in-left")
      setTimeout(() => setStepTransitionClass(""), 500)
    }, 300)
  }, [])

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false)
    try {
      localStorage.setItem(ONBOARDING_KEY, "1")
    } catch {
      // ignore storage errors
    }
  }, [])

  return (
    <SubjectGate featureName="AI 学习路线">
      <div
        className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-white"
        data-testid="learning-path-workbench-layout"
      >
        {/* ── Top Bar: Step Indicator ── */}
        <div className="relative z-20 shrink-0 flex items-center justify-between border-b border-slate-100 bg-white/95 px-6 py-3 backdrop-blur-xl">
          <div className="flex w-1/3 justify-start items-center gap-3">
            <h1 className="text-[1.35rem] font-black tracking-tight text-slate-900 drop-shadow-sm leading-none">
              {currentStep === "starmap" ? "学习星图" : "规划助手"}
            </h1>
          </div>
          <div className="flex shrink-0 items-center justify-center">
            <StepIndicator current={currentStep} onGoToStarmap={goToStarmap} />
          </div>
          <div className="flex w-1/3 justify-end items-center gap-3">
            {currentStep === "starmap" && profile?.user_id && (
              <SkillTreeSnapshotSelector
                snapshots={snapshots}
                activeSnapshotId={activeSnapshotId}
                activeSnapshotName={map?.snapshot_name ?? null}
                loading={loading}
                onActivate={async (snapshotId) => {
                  if (!profile?.user_id) return
                  await activateSkillTreeSnapshot(currentSubjectKey, snapshotId, profile.user_id)
                  await loadStarMap()
                  await loadSnapshots()
                }}
                onCreate={async (name, source) => {
                  if (!profile?.user_id) return
                  await createSkillTreeSnapshot(currentSubjectKey, profile.user_id, name, source)
                  await loadSnapshots()
                }}
                onRename={async (snapshotId, name) => {
                  if (!profile?.user_id) return
                  await renameSkillTreeSnapshot(currentSubjectKey, snapshotId, profile.user_id, name)
                  await loadSnapshots()
                  // 如果重命名的是当前活跃的快照，刷新 map 以更新名称
                  if (snapshotId === activeSnapshotId) {
                    await loadStarMap()
                  }
                }}
                onDelete={async (snapshotId) => {
                  if (!profile?.user_id) return
                  await deleteSkillTreeSnapshot(currentSubjectKey, snapshotId, profile.user_id)
                  // 如果删除的是当前 active，需要重新加载
                  if (snapshotId === activeSnapshotId) {
                    await loadStarMap()
                  }
                  await loadSnapshots()
                }}
                onReset={async (snapshotId) => {
                  if (!profile?.user_id) return
                  const result = await resetSkillTreeSnapshot(currentSubjectKey, snapshotId, profile.user_id)
                  setMap(result)
                  await loadSnapshots()
                }}
              />
            )}
          </div>
        </div>

        {/* ── Content Area with Transition ── */}
        <div className={cn("relative flex-1 min-h-0 overflow-hidden", stepTransitionClass)}>

          {/* ═══════════════ STEP 1: Star Map ═══════════════ */}
          {currentStep === "starmap" && (
            <div className="flex h-full w-full flex-col" data-testid="step-starmap">
              {/* Star Map Stage */}
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <div className="flex h-full w-full min-h-0 flex-col">
                  <div
                    ref={stageRef}
                    className="relative min-h-0 flex-1 flex flex-row overflow-hidden bg-white"
                    data-testid="learning-path-stage"
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-16 bg-gradient-to-b from-white to-transparent" />

                    {/* Tree Panel */}
                    <div className="flex-1 relative min-w-0 pointer-events-auto">
                      <div className="absolute left-5 top-5 z-10 flex flex-col items-start pointer-events-none">
                        <div className="text-xs font-semibold text-slate-600 bg-white/70 px-3 py-1.5 rounded-full backdrop-blur-md shadow-sm border border-slate-200/60">
                          {selectedNode ? `当前聚焦：${selectedNode.label}` : "点击节点查看详情"}
                        </div>
                      </div>
                      <LearningPathTreePanel
                        map={map}
                        selectedNodeId={selectedNodeId}
                        preferences={preferences}
                        onSelectNode={handleWorkbenchNodeSelect}
                        onSetPreference={handleSetPreference}
                      />
                    </div>

                    {/* ─── Bottom Peek Drawer (Desktop + Mobile unified) ─── */}
                    <div
                      className={cn(
                        "absolute bottom-0 left-0 right-0 z-20 pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                        selectedNode
                          ? "translate-y-0 opacity-100"
                          : "translate-y-full opacity-0 pointer-events-none"
                      )}
                    >
                      {/* Subtle gradient fade above the drawer */}
                      <div className="h-8 bg-gradient-to-t from-white/80 to-transparent pointer-events-none" />

                      <div
                        className="mx-3 mb-3 rounded-2xl border border-slate-200/80 bg-white/95 shadow-xl backdrop-blur-xl overflow-hidden xl:mx-auto xl:max-w-[36rem]"
                        data-testid="learning-path-detail-drawer"
                      >
                        {/* ── Collapsed Header (always visible) ── */}
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/60 group"
                          onClick={() => setDetailExpanded((v) => !v)}
                        >
                          {/* Drag handle */}
                          <div className="mx-auto mb-0 flex flex-col items-center absolute top-1.5 left-1/2 -translate-x-1/2">
                            <div className="h-1 w-8 rounded-full bg-slate-300/60 group-hover:bg-slate-400/80 transition-colors" />
                          </div>

                          <div className="flex-1 min-w-0 mt-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-slate-900 truncate">
                                {selectedNode?.label}
                              </h3>
                              {selectedNode?.tags?.includes("user-generated") && (
                                <span className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-teal-700">
                                  AI
                                </span>
                              )}
                            </div>
                            {!detailExpanded && selectedNode?.description && (
                              <p className="mt-0.5 text-[11px] text-slate-500 truncate leading-snug">
                                {selectedNode.description}
                              </p>
                            )}
                          </div>

                          {/* Quick Preference Pills (always visible in collapsed) */}
                          {!detailExpanded && (
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-[10px] font-bold transition-all",
                                  selectedPreference === "known"
                                    ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                                    : "bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
                                )}
                                onClick={(e) => { e.stopPropagation(); handleSetPreference(selectedNode!.id, selectedPreference === "known" ? null : "known") }}
                              >掌握</button>
                              <button
                                type="button"
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-[10px] font-bold transition-all",
                                  selectedPreference === "target"
                                    ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200"
                                    : "bg-slate-100 text-slate-500 hover:bg-sky-50 hover:text-sky-600"
                                )}
                                onClick={(e) => { e.stopPropagation(); handleSetPreference(selectedNode!.id, selectedPreference === "target" ? null : "target") }}
                              >学习</button>
                              <button
                                type="button"
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-[10px] font-bold transition-all",
                                  selectedPreference === "avoid"
                                    ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                                    : "bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                                )}
                                onClick={(e) => { e.stopPropagation(); handleSetPreference(selectedNode!.id, selectedPreference === "avoid" ? null : "avoid") }}
                              >跳过</button>
                            </div>
                          )}

                          {/* Expand/Collapse Chevron */}
                          <div className="shrink-0 rounded-full p-1 text-slate-400 transition-colors group-hover:text-slate-600">
                            {detailExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                          </div>

                          {/* Close button */}
                          <button
                            type="button"
                            className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setSelectedNodeId(null); setDetailExpanded(false) }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </button>

                        {/* ── Expanded Content (slides open) ── */}
                        <div
                          className={cn(
                            "grid transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                            detailExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                          )}
                        >
                          <div className="overflow-hidden">
                            <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                              {/* Description */}
                              {selectedNode?.description && (
                                <p className="text-xs leading-relaxed text-slate-600 mb-3">
                                  {selectedNode.description}
                                </p>
                              )}

                              {/* Tags */}
                              {selectedNode?.tags && selectedNode.tags.length > 0 && (
                                <div className="mb-3 flex flex-wrap gap-1.5">
                                  {selectedNode.tags.slice(0, 4).map((tag: string) => (
                                    <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Preference Toggle (full version in expanded) */}
                              <div className="flex w-full flex-row gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50 p-1.5 mb-3">
                                <button
                                  className={cn(
                                    "flex-1 rounded-lg py-1.5 text-xs font-bold transition-all",
                                    selectedPreference === "known" ? "bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200/50" : "text-slate-500 hover:text-slate-900"
                                  )}
                                  onClick={() => handleSetPreference(selectedNode!.id, selectedPreference === "known" ? null : "known")}
                                >已掌握</button>
                                <button
                                  className={cn(
                                    "flex-1 rounded-lg py-1.5 text-xs font-bold transition-all",
                                    selectedPreference === "target" ? "bg-white text-sky-700 shadow-sm ring-1 ring-slate-200/50" : "text-slate-500 hover:text-slate-900"
                                  )}
                                  onClick={() => handleSetPreference(selectedNode!.id, selectedPreference === "target" ? null : "target")}
                                >想学习</button>
                                <button
                                  className={cn(
                                    "flex-1 rounded-lg py-1.5 text-xs font-bold transition-all",
                                    selectedPreference === "avoid" ? "bg-white text-amber-700 shadow-sm ring-1 ring-slate-200/50" : "text-slate-500 hover:text-slate-900"
                                  )}
                                  onClick={() => handleSetPreference(selectedNode!.id, selectedPreference === "avoid" ? null : "avoid")}
                                >暂不学</button>
                              </div>

                              {/* Expansion Controls */}
                              <div className="border-t border-slate-100 pt-3 flex flex-col gap-2.5">
                                <div className="flex flex-row gap-2">
                                  <button
                                    className={cn(
                                      "flex-1 rounded-lg border py-2 text-xs font-bold transition-all",
                                      expansionMode === "curriculum"
                                        ? "border-teal-500 bg-teal-50 text-teal-800 shadow-sm"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                    )}
                                    onClick={() => setExpansionMode("curriculum")}
                                  >偏课程化</button>
                                  <button
                                    className={cn(
                                      "flex-1 rounded-lg border py-2 text-xs font-bold transition-all",
                                      expansionMode === "practical"
                                        ? "border-teal-500 bg-teal-50 text-teal-800 shadow-sm"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                                    )}
                                    onClick={() => setExpansionMode("practical")}
                                  >偏实战化</button>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                  <Button
                                    variant="outline"
                                    className="h-9 w-full rounded-lg border-slate-200 bg-white text-xs font-bold shadow-sm hover:border-teal-500 hover:text-teal-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60"
                                    disabled={selectedPreference !== "target" || expandingNode}
                                    onClick={() => void handleExpandNode()}
                                  >
                                    {expandingNode ? "正在发散..." : "继续发散"}
                                  </Button>
                                  {selectedPreference !== "target" && (
                                    <p className="text-center text-[10px] font-semibold text-slate-400 leading-snug">
                                      请先将节点标记为"想学习"<br />再进行发散
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Bottom Action Bar */}
              <PreferenceStatsBar
                preferences={preferences}
                onNext={goToPlanner}
                disabled={loading}
              />
            </div>
          )}

          {/* ═══════════════ STEP 2: Planner ═══════════════ */}
          {currentStep === "planner" && (
            <div className="flex h-full w-full flex-col relative" data-testid="step-planner">
              {/* Planner Loading State */}
              {plannerLoading && !visibleMessages.length && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative flex h-16 w-16">
                      <span className="absolute h-full w-full animate-ping rounded-full bg-teal-400 opacity-20"></span>
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-xl">
                        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                      </div>
                    </div>
                    <div className="text-sm font-medium text-slate-600">正在启动规划助手...</div>
                  </div>
                </div>
              )}
              {/* Full-screen Agent Panel */}
              <div className="flex-1 min-h-0 flex justify-center bg-white rounded-2xl">
                <div className="w-full h-full relative">
                  <LearningPathAgentPanel
                    messages={visibleMessages}
                    sessionStatus={session?.status ?? "--"}
                    readyCheck={ready as any}
                    replying={replying || savingPreference}
                    generating={generating}
                    map={map}
                    preferences={preferences}
                    onSend={handleSendReply}
                    onGenerate={handleGenerate}
                    onRemovePreference={(nodeId) => handleSetPreference(nodeId, null)}
                    onBack={goToStarmap}
                  />
                </div>
              </div>

              {/* Floating Back Button Removed */}
            </div>
          )}
        </div>

        {/* ── Loading Overlay ── */}
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex h-16 w-16">
                <span className="absolute h-full w-full animate-ping rounded-full bg-teal-400 opacity-20"></span>
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-xl">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                </div>
              </div>
              <div className="text-sm font-medium text-slate-600">正在构建您的学习星图...</div>
            </div>
          </div>
        )}

        {/* ── Error Notification ── */}
        {errorMessage && (
          <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-rose-600 px-6 py-3 text-sm font-medium text-white shadow-2xl animate-in fade-in slide-in-from-bottom-4">
            {errorMessage}
            <button className="ml-4 opacity-70 hover:opacity-100" onClick={() => setErrorMessage(null)}>✕</button>
          </div>
        )}

        {/* ── Generating Overlay ── */}
        <GeneratingOverlay show={generating} />

        {/* ── Onboarding Overlay ── */}
        {showOnboarding && !loading && currentStep === "starmap" && (
          <OnboardingOverlay onDismiss={dismissOnboarding} />
        )}

        {/* ── Step Transition Animations ── */}
        <style>{`
          @keyframes slideOutLeft {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(-40px); }
          }
          @keyframes slideInRight {
            from { opacity: 0; transform: translateX(40px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes slideOutRight {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(40px); }
          }
          @keyframes slideInLeft {
            from { opacity: 0; transform: translateX(-40px); }
            to { opacity: 1; transform: translateX(0); }
          }
          .animate-slide-out-left { animation: slideOutLeft 0.3s ease-in-out forwards; }
          .animate-slide-in-right { animation: slideInRight 0.35s ease-out forwards; }
          .animate-slide-out-right { animation: slideOutRight 0.3s ease-in-out forwards; }
          .animate-slide-in-left { animation: slideInLeft 0.35s ease-out forwards; }
        `}</style>
      </div>
    </SubjectGate>
  )
}
