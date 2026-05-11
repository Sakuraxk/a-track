import { createPortal } from "react-dom"
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  BarChart3,
  Brain,
  Code,
  FunctionSquare,
  Layers,
  ListChecks,
  Loader2,
  Maximize2,
  Minimize2,
} from "lucide-react"

import { LearningWorkstation } from "@/features/studio/components/workstation/LearningWorkstation"
import { PracticeHero } from "@/features/studio/components/workstation/PracticeHero"
import { ProgressHero } from "@/features/studio/components/workstation/ProgressHero"
import { ReviewHero } from "@/features/studio/components/workstation/ReviewHero"
import {
  buildPreflightCopy,
  buildSummaryBridge,
} from "@/features/studio/components/workstation/workstationCopy"
import type { TransitionIntent } from "@/features/studio/components/workstation/workstationMotion"
import type {
  LearningWorkstationState,
  RuntimeShellState,
} from "@/features/studio/components/workstation/workstationTypes"
import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import { useLearningPathStore, type LearningPath } from "@/stores/learning-path"
import { useSubjectStore } from "@/stores/subject"
import { getSubjectCategory } from "@/lib/subjectCategory"
import { WorkstationSkeleton } from "@/features/studio/components/workstation/WorkstationSkeleton"

const CodeSandbox = lazy(() => import("@/components/subject-tools/CodeSandbox"))
const MathLab = lazy(() => import("@/components/subject-tools/MathLab"))
const FlashcardLab = lazy(() => import("@/components/subject-tools/FlashcardLab"))

const WORKSTATION_PRACTICE_ROUTE = "/app/problems"
const WORKSTATION_REVIEW_ROUTE = "/app/stats"
const HERO_INHERITANCE_NAV_DELAY_MS = 260

const GOAL_META: Record<string, string> = {
  basics: "掌握基础知识",
  career: "提升职业技能",
  exam: "备考认证考试",
  fun: "兴趣爱好学习",
}

const LEVEL_META: Record<string, { label: string; description: string }> = {
  beginner: {
    label: "零基础 / 萌新",
    description: "从基础概念和最小实践开始，先建立稳定理解。",
  },
  intermediate: {
    label: "有一定基础",
    description: "以主线任务带动复习和迁移，把零散知识拼成体系。",
  },
  advanced: {
    label: "进阶 / 精通",
    description: "优先冲击复杂场景、性能和综合应用，把时间花在高价值问题上。",
  },
}

interface SubjectProfileResponse {
  goal?: string
  level?: string
}

function isPracticeHeroTaskType(taskType?: string | null) {
  return (
    taskType === "exercise" ||
    taskType === "practice" ||
    taskType === "project"
  )
}

function isReviewSignalTaskType(taskType?: string | null) {
  return (
    taskType === "exercise" ||
    taskType === "practice" ||
    taskType === "review"
  )
}

function buildStrategySummary(
  hasPath: boolean,
  goalLabels: string[],
  levelMeta: { label: string; description: string },
  subjectName: string,
) {
  if (!hasPath) {
    return `你还没有为 ${subjectName} 生成可执行路线。先确认目标与基础，系统才会自动编排今天的主线任务。`
  }

  const goalText = goalLabels.length > 0 ? goalLabels.join("、") : "当前阶段目标"

  if (levelMeta.label.includes("零基础")) {
    return `当前策略偏向“稳扎稳打”：围绕 ${goalText} 先补关键概念，再通过练习建立基本把握。`
  }

  if (levelMeta.label.includes("有一定基础")) {
    return `当前策略偏向“任务驱动”：围绕 ${goalText} 先推进主线任务，再用练习和工具把理解转成稳定能力。`
  }

  return `当前策略偏向“高阶应用”：围绕 ${goalText} 快速进入复杂场景，通过路线与复盘不断压缩试错成本。`
}


function deriveHeroState(
  hasPath: boolean,
  isTodayComplete: boolean,
  taskType?: string | null,
): LearningWorkstationState {
  if (!hasPath) return "progress"
  if (isTodayComplete) return "review"
  if (isPracticeHeroTaskType(taskType)) return "practice"
  return "progress"
}

export default function LearningStudio() {
  const navigate = useNavigate()
  const { subjectId } = useParams()
  const userId = useAuthStore((s) => s.profile?.user_id)
  const currentSubjectId = useSubjectStore((s) => s.currentSubjectId)
  const subjects = useSubjectStore((s) => s.subjects)
  const getPathForSubject = useLearningPathStore((s) => s.getPathForSubject)
  const setPathForSubject = useLearningPathStore((s) => s.setPathForSubject)

  const effectiveSubjectId = currentSubjectId || subjectId || "python"
  const currentSubject = subjects.find((subject) => subject.id === effectiveSubjectId) || null
  const subjectName = currentSubject?.name || "当前学科"
  const subjectKey = currentSubject?.key || effectiveSubjectId

  const path = getPathForSubject(subjectKey)
  const hasPath = !!path
  const hasPlanDays = !!path && path.days.length > 0
  const hasTaskData = !!path && path.days.some((day) => day.tasks.length > 0)

  const [learningGoals, setLearningGoals] = useState<string[]>([])
  const [level, setLevel] = useState<string>("beginner")
  const [isPathLoading, setIsPathLoading] = useState(true)
  const [showTool, setShowTool] = useState(false)
  const [isToolFullscreen, setIsToolFullscreen] = useState(false)
  const [transitionIntentOverride, setTransitionIntentOverride] =
    useState<TransitionIntent | null>(null)
  const nextStepTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (currentSubjectId && subjectId && subjectId !== currentSubjectId) {
      navigate(`/app/studio/${currentSubjectId}`, { replace: true })
    }
  }, [currentSubjectId, navigate, subjectId])

  useEffect(() => {
    return () => {
      if (nextStepTimerRef.current !== null) {
        window.clearTimeout(nextStepTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadActivePath = async () => {
      if (!userId || path) {
        setIsPathLoading(false)
        return
      }

      setIsPathLoading(true)

      try {
        const response = await api.get<LearningPath>(`/api/ai-learning-path/user/${userId}/active`, {
          params: { subject_key: subjectKey },
        })

        if (!cancelled) {
          setPathForSubject(subjectKey, response.data)
        }
      } catch (error: unknown) {
        if ((error as { response?: { status?: number } }).response?.status !== 404) {
          console.error("Failed to load active learning path for studio:", error)
        }
      } finally {
        if (!cancelled) {
          setIsPathLoading(false)
        }
      }
    }

    void loadActivePath()

    return () => {
      cancelled = true
    }
  }, [path, setPathForSubject, subjectKey, userId])

  useEffect(() => {
    let cancelled = false

    const loadSubjectProfile = async () => {
      if (!userId || !effectiveSubjectId) return

      try {
        const response = await api.get<SubjectProfileResponse>(`/api/subjects/${effectiveSubjectId}/profile`, {
          params: { user_id: userId },
        })

        if (cancelled) return

        const goalString = response.data.goal || ""
        setLearningGoals(goalString ? goalString.split(",").filter(Boolean) : [])
        setLevel(response.data.level || "beginner")
      } catch (error: unknown) {
        if ((error as { response?: { status?: number } }).response?.status !== 404) {
          console.error("Failed to load subject profile for studio:", error)
        }
        if (!cancelled) {
          setLearningGoals([])
          setLevel("beginner")
        }
      }
    }

    void loadSubjectProfile()

    return () => {
      cancelled = true
    }
  }, [effectiveSubjectId, userId])

  const todayDay = useMemo(() => {
    if (!hasTaskData || !path) return null
    return (
      path.days.find(
        (day) => day.day === path.current_day && day.tasks.length > 0,
      ) ||
      path.days.find((day) => day.tasks.length > 0) ||
      null
    )
  }, [hasTaskData, path])

  const nextTask = useMemo(() => {
    if (!todayDay) return null
    return todayDay.tasks.find((task) => !task.completed) || todayDay.tasks[0] || null
  }, [todayDay])

  const tomorrowDay = useMemo(() => {
    if (!hasTaskData || !path || !todayDay) return null
    return path.days.find((day) => day.day > todayDay.day && day.tasks.length > 0) || null
  }, [hasTaskData, path, todayDay])

  const totalTaskCount = todayDay?.tasks.length || 0
  const completedTaskCount = todayDay?.tasks.filter((task) => task.completed).length || 0
  const completedTasks = todayDay?.tasks.filter((task) => task.completed) || []
  const isTodayComplete = totalTaskCount > 0 && completedTaskCount === totalTaskCount
  const focusTask = isTodayComplete ? completedTasks[completedTasks.length - 1] || nextTask : nextTask
  const heroState = deriveHeroState(hasTaskData, isTodayComplete, focusTask?.type)
  const hasReviewSignals = completedTasks.some(
    (task) => isReviewSignalTaskType(task.type),
  )
  const isReviewDegraded = hasTaskData && isTodayComplete && !hasReviewSignals
  const runtimeState: RuntimeShellState =
    isPathLoading
      ? "loading"
      : !hasPath || !hasPlanDays || !hasTaskData
      ? "preflight"
      : isReviewDegraded
        ? "degraded"
        : "ready"

  const currentPlanUrl = useMemo(() => {
    if (!hasPath || !path) return "/app/ai-learning-path"
    return `/app/ai-learning-path/plan/${path.id}?day=${path.current_day || todayDay?.day || 1}`
  }, [hasPath, path, todayDay?.day])

  const nextPlanUrl = useMemo(() => {
    if (!hasPath || !path) return "/app/ai-learning-path"

    const fallbackDay =
      todayDay?.day && path.total_days
        ? Math.min(todayDay.day + 1, path.total_days)
        : path.current_day || 1
    return `/app/ai-learning-path/plan/${path.id}?day=${tomorrowDay?.day || fallbackDay}`
  }, [hasPath, path, todayDay?.day, tomorrowDay?.day])

  const handleContinueLearning = () => {
    if (!hasPath) {
      navigate("/app/ai-learning-path")
      return
    }
    navigate(currentPlanUrl)
  }

  const handleAdjustStrategy = () => {
    navigate("/app/ai-learning-path")
  }


  const handleStartPractice = () => {
    navigate(WORKSTATION_PRACTICE_ROUTE)
  }

  const handleViewReview = () => {
    navigate(WORKSTATION_REVIEW_ROUTE)
  }

  const handleContinueNextTask = () => {
    if (nextStepTimerRef.current !== null) {
      window.clearTimeout(nextStepTimerRef.current)
      nextStepTimerRef.current = null
    }

    if (tomorrowDay) {
      setTransitionIntentOverride("inherit-hero")
      nextStepTimerRef.current = window.setTimeout(() => {
        navigate(nextPlanUrl)
      }, HERO_INHERITANCE_NAV_DELAY_MS)
      return
    }

    navigate(nextPlanUrl)
  }

  const category = useMemo(() => getSubjectCategory(subjectKey), [subjectKey])

  const subjectToolAction = useMemo(() => {
    const tools = {
      engineering: {
        title: "代码沙箱",
        description: "把今天的概念直接跑成代码，及时验证理解。",
        icon: Code,
      },
      "math-logic": {
        title: "数学实验室",
        description: "把公式、函数和推导过程可视化，减少抽象阻力。",
        icon: FunctionSquare,
      },
      humanities: {
        title: "记忆闪卡",
        description: "把今天的关键知识点加入复习队列，避免学完就忘。",
        icon: Layers,
      },
    }

    return tools[category]
  }, [category])

  const levelMeta = LEVEL_META[level] || LEVEL_META.beginner
  const goalChips = learningGoals.map((goalId) => ({
    id: goalId,
    label: GOAL_META[goalId] || goalId,
  }))

  const strategySummary = useMemo(
    () =>
      buildStrategySummary(
        hasTaskData,
        goalChips.map((goal) => goal.label),
        levelMeta,
        subjectName,
      ),
    [goalChips, hasTaskData, levelMeta, subjectName],
  )

  const routeLabel = hasTaskData
    ? `${subjectName} · ${path.version_name || `路线 v${path.version || 1}`}`
    : `${subjectName} · 等待路线生成`

  const missionDescription = focusTask
    ? isTodayComplete
      ? `你已经围绕“${goalChips[0]?.label || path?.goal || "当前目标"}”完成了今天的主线任务，现在进入总结、预告和数据反馈阶段。`
      : `基于你的“${goalChips[0]?.label || path?.goal || "当前目标"}”和当前基础，今天先完成这条主线任务，再进入练习与复盘。`
    : `先明确目标与基础，再生成路线。系统会围绕你的学习阶段安排今天的主任务、练习和复盘。`

  const taskTypeLabelMap: Record<string, string> = {
    concept: "概念理解",
    exercise: "专项练习",
    practice: "专项练习",
    review: "复盘巩固",
    project: "实战任务",
  }

  const signalSummary = focusTask
    ? isTodayComplete
      ? `今天主线已经完成，策略树会把焦点切到明日节点，帮助你从复盘平滑过渡到下一步。`
      : `今天还有 ${Math.max(totalTaskCount - completedTaskCount, 1)} 个任务待推进，建议先完成“${focusTask.title}”后再切到练习或工具。`
    : hasTaskData
      ? "路线已经生成，但今天的任务还未完全展开，可以先查看完整路线确认下一步。"
      : "当前还没有可执行任务，先完成路线规划后系统才会自动组织主线学习。"

  const summaryMetrics = [
    {
      label: "完成进度",
      value: totalTaskCount > 0 ? `${completedTaskCount}/${totalTaskCount} 项已完成` : "待生成",
    },
    {
      label: "学习节奏",
      value: path?.daily_minutes ? `${path.daily_minutes} 分钟/天` : "等待系统安排",
    },
    {
      label: "明日焦点",
      value: tomorrowDay?.tasks[0]?.title ? `下一步：${tomorrowDay.tasks[0].title}` : "等待明日任务生成",
    },
  ]

  const summaryBridge = buildSummaryBridge(tomorrowDay?.tasks[0]?.title || null)
  const preflightCopy = buildPreflightCopy(subjectName)
  const loadingCopy = {
    title: "正在载入学习工作台",
    reason: "正在同步当前路线、今日任务和学习画像，请稍候。",
  }

  const progressHeroTitle = focusTask ? `推进主线：${focusTask.title}` : `${subjectName} 学习工作台`
  const practiceHeroTitle = focusTask?.title ? `专项练习：${focusTask.title}` : "专项练习"
  const practiceProgressLabel =
    totalTaskCount > 0
      ? `已完成 ${completedTaskCount}/${totalTaskCount} 项主线任务，准备进入练习验证。`
      : "主线任务生成后，将在这里进入练习验证。"
  const reviewHeroTitle = focusTask ? `今日已完成：${focusTask.title}` : "今日主线已完成"
  const reviewHeroLabel =
    isReviewDegraded
      ? "复盘数据正在补齐"
      : totalTaskCount > 0
      ? `完成进度 ${completedTaskCount}/${totalTaskCount}，建议先复盘再进入明日任务。`
      : "今日任务已完成，建议先复盘再进入明日任务。"

  const actionItems = [
    {
      title: "专项练习",
      description: focusTask
        ? isTodayComplete
          ? `今天主线已完成，继续用题目巩固「${focusTask.title}」并检查是否真的掌握。`
          : `完成“${focusTask.title}”后，用经典题巩固今天的主线理解。`
        : "通过阶段性练习验证本阶段的基础掌握情况。",
      icon: ListChecks,
      badge: "练习",
      onClick: () => navigate(WORKSTATION_PRACTICE_ROUTE),
    },
    {
      title: "动态题库",
      description: "获取 AI 生成的个性化练习，围绕当前路线补强薄弱点。",
      icon: Brain,
      badge: "AI",
      onClick: () => navigate("/app/question-bank"),
    },
    {
      title: subjectToolAction.title,
      description: subjectToolAction.description,
      icon: subjectToolAction.icon,
      badge: "工具",
      onClick: () => setShowTool(true),
    },
    {
      title: "查看学习复盘",
      description: "回到统计页看正确率、学习时长与能力分布，再决定是否调整路线。",
      icon: BarChart3,
      badge: "复盘",
      onClick: () => navigate(WORKSTATION_REVIEW_ROUTE),
    },
  ]

  const buildHero = (activeState: LearningWorkstationState) => {
    if (runtimeState === "loading") {
      return (
        <ProgressHero
          title={loadingCopy.title}
          reason={loadingCopy.reason}
          primaryLabel="正在载入"
          onPrimary={() => undefined}
          primaryDisabled
        />
      )
    }

    if (activeState === "progress") {
      return (
        <ProgressHero
          title={hasTaskData ? progressHeroTitle : preflightCopy.title}
          reason={missionDescription}
          primaryLabel={hasTaskData ? "进入概念学习" : preflightCopy.ctaLabel}
          onPrimary={handleContinueLearning}
        />
      )
    }

    if (activeState === "practice") {
      return (
        <PracticeHero
          title={practiceHeroTitle}
          progressLabel={practiceProgressLabel}
          onPrimary={handleStartPractice}
        />
      )
    }

    return (
      <ReviewHero
        summaryTitle={reviewHeroTitle}
        resultLabel={reviewHeroLabel}
        onPrimary={handleViewReview}
        onNext={handleContinueNextTask}
      />
    )
  }

  // Act 1: 主线任务 (拆除 LearningCanvas)
  const buildMainTaskAct = (activeState: LearningWorkstationState) =>
    runtimeState === "loading" ? (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-900">正在载入学习工作台</h3>
          <p className="max-w-md text-sm text-slate-500">
            系统正在同步你的学习路线、今日任务和学习画像。
          </p>
        </div>
      </div>
    ) : hasTaskData ? (
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {taskTypeLabelMap[focusTask?.type || "concept"] || "今日主线"}
          </div>
          <h3 className="text-2xl font-black text-slate-900">
            {focusTask?.title || "主线加载中"}
          </h3>
          <p className="text-base leading-relaxed text-slate-600">
            {focusTask?.description || "今天我们需要通过这条主线任务，建立核心理解并为后续练习做好准备。"}
          </p>
          
          {focusTask?.resources && focusTask.resources.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {focusTask.resources.slice(0, 3).map(res => (
                <span key={res} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                  {res}
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
          {activeState !== "review" && (
            <button
              type="button"
              onClick={handleContinueLearning}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/30 active:scale-95"
            >
              继续当前任务
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(currentPlanUrl)}
            className="flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-6 py-3.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95"
          >
            查看路线图
          </button>
        </div>
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <ListChecks className="h-6 w-6 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">{preflightCopy.sectionTitle}</h3>
        <p className="mt-2 max-w-md text-sm text-slate-500">{preflightCopy.sectionDescription}</p>
        <button
          type="button"
          onClick={handleContinueLearning}
          className="mt-6 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-slate-800"
        >
          {preflightCopy.ctaLabel}
        </button>
      </div>
    )

  // Act 2: 策略星图 (拆除 LearningRail)
  const strategyAct = (
    <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
      <div className="flex-1 space-y-4">
        <h4 className="text-sm font-bold text-slate-900">当前策略：{levelMeta.label}</h4>
        <p className="text-sm leading-relaxed text-slate-600">
          {strategySummary}
        </p>
        <p className="text-sm leading-relaxed text-slate-600">
          {signalSummary}
        </p>
        <button
          type="button"
          onClick={handleAdjustStrategy}
          className="text-sm font-bold text-indigo-600 hover:text-indigo-500"
        >
          调整学习策略 &rarr;
        </button>
      </div>
      
      <div className="w-full shrink-0 md:w-64 lg:w-80">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
          <div className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">路线状态指引</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-slate-300" />已完成
              </span>
              <span className="font-medium text-slate-900">{completedTaskCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />进行中
              </span>
              <span className="font-medium text-slate-900">{totalTaskCount - completedTaskCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2 w-2 rounded-full border border-slate-300" />待学习
              </span>
              <span className="font-medium text-slate-900">{path?.total_days ? path.total_days - (todayDay?.day || 0) : 0} 天</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Act 3: 动作面板
  const actionAct = (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {actionItems.filter((item) => !item.hidden).map((item) => (
        <button
          key={item.title}
          type="button"
          onClick={item.onClick}
          className="group relative flex flex-col items-start overflow-hidden rounded-2xl border border-slate-200/50 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] transition-all hover:-translate-y-1 hover:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.08)]"
        >
          <div className="mb-4 inline-flex rounded-xl bg-slate-50 p-3 text-slate-600 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
            <item.icon className="h-6 w-6" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 line-clamp-2">
              {item.description}
            </p>
          </div>
          <div className="absolute right-4 top-4 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
            {item.badge}
          </div>
        </button>
      ))}
    </div>
  )

  // Act 4: 进度核心
  const progressAct = (
    <div className="grid gap-6 md:grid-cols-3">
      {summaryMetrics.map((metric, index) => (
        <div key={metric.label} className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-b from-white to-slate-50/50 p-6 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
            {metric.label}
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <div className="text-2xl font-black text-slate-900 tracking-tight">{metric.value.split(" ")[0]}</div>
            <div className="text-sm font-medium text-slate-500">{metric.value.split(" ").slice(1).join(" ")}</div>
          </div>
          {index === 0 && (
             <div className="absolute -bottom-2 -right-2 h-20 w-20 rounded-full bg-emerald-500/10 blur-xl" />
          )}
          {index === 2 && (
             <div className="absolute -bottom-2 -right-2 h-20 w-20 rounded-full bg-blue-500/10 blur-xl" />
          )}
        </div>
      ))}
    </div>
  )

  // Act 5: 明日预告
  const nextAct = (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white shadow-xl sm:p-10">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-[60px] transition-all duration-700 group-hover:bg-indigo-500/30" />
      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-sm">
            <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-200">
              明日衔接预告
            </span>
          </div>
          <div className="text-2xl font-black tracking-tight sm:text-3xl">
            {tomorrowDay?.tasks[0]?.title || "等待明日任务生成"}
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-slate-300">
            {summaryBridge}
          </p>
        </div>
        
        {tomorrowDay?.tasks[0]?.title && (
          <button
            type="button"
            onClick={handleContinueNextTask}
            className="shrink-0 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:scale-105 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            查看路线
          </button>
        )}
      </div>
    </div>
  )

  const buildActs = (activeState: LearningWorkstationState) => ({
    act1: {
      title: "主线双步",
      summary: focusTask?.title || "今日主线待生成",
      eyebrow: "Act 1",
      content: buildMainTaskAct(activeState),
    },
    act2: {
      title: "策略星图",
      summary: routeLabel,
      eyebrow: "Act 2",
      content: strategyAct,
    },
    act3: {
      title: "行动面板",
      summary: isTodayComplete ? "复盘与巩固入口" : "练习、工具与复盘入口",
      eyebrow: "Act 3",
      content: actionAct,
    },
    act4: {
      title: "完成进度",
      summary: totalTaskCount > 0 ? `${completedTaskCount}/${totalTaskCount}` : "待生成",
      eyebrow: "Act 4",
      content: progressAct,
    },
    act5: {
      title: "明日衔接",
      summary: tomorrowDay?.tasks[0]?.title || "等待生成",
      eyebrow: "Act 5",
      content: nextAct,
    },
  })

  if (isPathLoading) {
    return <WorkstationSkeleton />
  }

  return (
    <div className="animate-in fade-in duration-700 ease-out">
      <LearningWorkstation
        systemState={heroState}
        runtimeState={runtimeState}
        subjectName={subjectName}
        storageScope={subjectKey}
        transitionIntentOverride={transitionIntentOverride}
        stageTitle={
          runtimeState === "loading"
            ? loadingCopy.title
            : focusTask?.title || `${subjectName} 学习工作台`
        }
        stageMeta={
          runtimeState === "loading"
            ? `${subjectName} · 正在同步路线`
            : todayDay?.day
              ? `${subjectName} · Day ${todayDay.day}`
              : routeLabel
        }
        hero={buildHero}
        acts={buildActs}
      />

      {showTool && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setShowTool(false)}
            >
              <div
                className={`overflow-auto bg-white shadow-2xl transition-all duration-300 ease-in-out dark:bg-slate-900 ${
                  isToolFullscreen
                    ? "m-0 h-full max-h-none w-full max-w-none rounded-none"
                    : "m-4 max-h-[85vh] w-full max-w-5xl rounded-2xl"
                }`}
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  className={`sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 ${
                    isToolFullscreen ? "" : "rounded-t-3xl"
                  }`}
                >
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-white">
                    <subjectToolAction.icon className="h-5 w-5 text-primary" />
                    {subjectToolAction.title}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsToolFullscreen((prev) => !prev)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                      {isToolFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTool(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className={isToolFullscreen ? "h-[calc(100vh-65px)] p-4" : "p-6"}>
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    }
                  >
                    {category === "engineering" && <CodeSandbox subjectKey={subjectKey} isFullscreen={isToolFullscreen} />}
                    {category === "math-logic" && <MathLab subjectKey={subjectKey} />}
                    {category === "humanities" && <FlashcardLab subjectKey={subjectKey} />}
                  </Suspense>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
