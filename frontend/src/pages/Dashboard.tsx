import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

import { AbilityRadarChart } from "@/components/AbilityRadarChart"
import { AchievementTreeCard } from "@/components/dashboard/AchievementTreeCard"
import LearningCommunity from "@/components/dashboard/LearningCommunity"
import { Icon } from "@/components/ui/Icon"
import { SubjectIcon } from "@/components/ui/SubjectIcon"
import { api } from "@/lib/api"
import type {
  DashboardDataResponse,
  LLMConfigListResponse,
  SystemLLMStatusResponse,
} from "@/lib/backendTypes"
import { useAuthStore } from "@/stores/auth"
import { useSubjectStore } from "@/stores/subject"

interface TagStat {
  tag: string
  count: number
  display: string
  color: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const subjects = useSubjectStore((s) => s.subjects)
  const currentSubjectId = useSubjectStore((s) => s.currentSubjectId)
  const [dashboardData, setDashboardData] = useState<DashboardDataResponse | null>(null)

  const [showApiError, setShowApiError] = useState(false)
  const [apiStatusMessage, setApiStatusMessage] = useState("")

  const [tagStats, setTagStats] = useState<TagStat[]>([])
  const communityRef = useRef<HTMLDivElement>(null)
  const apiErrorTimerRef = useRef<number | null>(null)

  const radarChartData = useMemo(() => {
    return dashboardData?.radar?.data?.map((datum) => ({
      ability: datum.category,
      score: datum.score,
    })) || []
  }, [dashboardData])

  const averageMastery = useMemo(() => {
    const tags = profile?.ability_tags ?? {}
    const values = Object.values(tags)
    if (values.length === 0) return 0
    return Math.round(values.reduce((a, b) => a + Number(b), 0) / values.length)
  }, [profile?.ability_tags])

  const apiStatusTitle = useMemo(() => {
    if (!apiStatusMessage) return "AI 服务连接失败"
    if (apiStatusMessage.includes("系统 LLM 未启用或未配置 API Key")) {
      return "未找到可用 LLM 配置"
    }
    return "AI 服务连接失败"
  }, [apiStatusMessage])

  const userLevel = useMemo(() => Math.floor(averageMastery / 20) + 1, [averageMastery])

  const learningStage = useMemo(() => {
    const stageMap: Record<string, string> = {
      beginner: "初学者",
      elementary: "基础档",
      intermediate: "进阶档",
      advanced: "精通档",
    }
    return stageMap[profile?.portrait?.learning_stage as string] || "探索者"
  }, [profile?.portrait?.learning_stage])

  useEffect(() => {
    if (!profile?.user_id) return
    if (subjects.length === 0) return

    let cancelled = false
    const currentSubject = subjects.find((subject) => subject.id === currentSubjectId)

    const params: Record<string, string> = {}
    if (currentSubject?.key) params.subject_key = currentSubject.key
    if (currentSubject?.id) params.subject_id = currentSubject.id

    api.get<DashboardDataResponse>(`/api/reporting/dashboard/${profile.user_id}`, { params })
      .then((res) => {
        if (!cancelled) setDashboardData(res.data)
      })
      .catch((err) => {
        console.error(err)
      })

    return () => {
      cancelled = true
    }
  }, [profile?.user_id, currentSubjectId, subjects])

  useEffect(() => {
    if (!profile?.user_id) return

    const scheduleHideApiError = () => {
      if (apiErrorTimerRef.current) {
        window.clearTimeout(apiErrorTimerRef.current)
      }
      apiErrorTimerRef.current = window.setTimeout(() => {
        setShowApiError(false)
        apiErrorTimerRef.current = null
      }, 5000)
    }

    const checkApiStatus = async () => {
      try {
        const res = await api.get<SystemLLMStatusResponse>("/api/llm-config/status")
        if (!res.data.connected) {
          const personalConfigs = await api.get<LLMConfigListResponse>("/api/llm-config/")
          const hasActivePersonalConfig = personalConfigs.data.configs.some((config) => config.is_active)
          if (hasActivePersonalConfig) {
            setShowApiError(false)
            setApiStatusMessage("")
            return
          }

          setApiStatusMessage(`${res.data.message}；当前账号也没有启用中的个人 LLM 配置`)
          setShowApiError(true)
          scheduleHideApiError()
        }
      } catch (err) {
        setApiStatusMessage("无法连接到服务器")
        setShowApiError(true)
        scheduleHideApiError()
      }
    }

    void checkApiStatus()

    return () => {
      if (apiErrorTimerRef.current) {
        window.clearTimeout(apiErrorTimerRef.current)
        apiErrorTimerRef.current = null
      }
    }
  }, [profile?.user_id])

  useEffect(() => {
    let cancelled = false
    api.get<{ tags: TagStat[] }>("/api/community/tags/stats", { params: { limit: 6 } })
      .then((res) => {
        if (!cancelled) setTagStats(res.data.tags)
      })
      .catch((err) => console.error("Failed to load tag stats:", err))

    return () => {
      cancelled = true
    }
  }, [])

  const currentSubject = useMemo(() => {
    return subjects.find((subject) => subject.id === currentSubjectId) || subjects[0] || null
  }, [currentSubjectId, subjects])

  const currentSubjectName = currentSubject?.name || "当前学科"
  const completedExercises = dashboardData?.stats?.completed_exercises || 0
  const streakDays = dashboardData?.stats?.streak_days || 0
  const accuracyRate = Math.round((dashboardData?.stats?.accuracy_rate || 0) * 100)
  const totalStudyHours = ((dashboardData?.stats?.total_study_minutes || 0) / 60).toFixed(1)
  const nextLessonTitle = dashboardData?.next_lesson_title || "回到当前主线，继续今天的学习节奏"
  const radarScore = dashboardData?.radar?.overall_score || 0
  const focusSummary = currentSubjectId
    ? `从 ${currentSubjectName} 的主线出发，先推进今天最重要的一步，再决定是否切到练习或复盘。`
    : "先选定一个学科，系统会围绕你的当前阶段和学习目标安排下一步。"
  const progressHighlights = [
    {
      label: "已完成题目",
      value: `${completedExercises} 题`,
      note: completedExercises > 0 ? "正在积累稳定手感" : "从一小步开始也算前进",
      tone: "border-[oklch(90%_0.02_165)] bg-[linear-gradient(135deg,oklch(98%_0.012_165),oklch(99%_0.008_165))]",
      valueTone: "text-[oklch(45%_0.10_165)]",
      labelTone: "text-[oklch(52%_0.05_165)]",
    },
    {
      label: "连续节奏",
      value: `${streakDays} 天`,
      note: streakDays > 0 ? "保持学习惯性" : "今天很适合重新起步",
      tone: "border-[oklch(90%_0.02_80)] bg-[linear-gradient(135deg,oklch(98.2%_0.012_80),oklch(99%_0.008_80))]",
      valueTone: "text-[oklch(52%_0.11_80)]",
      labelTone: "text-[oklch(55%_0.05_80)]",
    },
    {
      label: "平均正确率",
      value: `${accuracyRate}%`,
      note: accuracyRate > 0 ? "用结果校准主线节奏" : "开始练习后会逐步形成反馈",
      tone: "border-[oklch(90%_0.016_220)] bg-[linear-gradient(135deg,oklch(98%_0.01_220),oklch(99%_0.008_220))]",
      valueTone: "text-[oklch(45%_0.09_220)]",
      labelTone: "text-[oklch(52%_0.045_220)]",
    },
  ]

  return (
    <div className="space-y-8 pb-20 p-6 lg:p-10">
      {showApiError && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-from-top">
          <div className="flex max-w-sm items-center gap-3 rounded-2xl bg-red-500 px-4 py-3 text-white shadow-lg">
            <Icon icon="solar:danger-triangle-bold-duotone" className="h-6 w-6 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">{apiStatusTitle}</p>
              <p className="mt-0.5 text-xs text-red-100">
                {apiStatusTitle === apiStatusMessage
                  ? "主页使用的是系统默认 LLM 配置，可在服务器配置中启用或补充 API Key"
                  : (apiStatusMessage || "请检查网络或 API 配置")}
              </p>
            </div>
            <button onClick={() => setShowApiError(false)} className="text-red-200 transition-colors hover:text-white">
              ×
            </button>
          </div>
        </div>
      )}

      <section
        data-testid="dashboard-focus-hero"
        className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:p-10"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(91%_0.05_165_/_0.18),transparent_30%),radial-gradient(circle_at_top_right,oklch(92%_0.04_220_/_0.14),transparent_26%),radial-gradient(circle_at_bottom_right,oklch(93%_0.04_80_/_0.10),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.98))]" />
        <div className="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[oklch(88%_0.03_165)] bg-[linear-gradient(135deg,oklch(97%_0.016_165),oklch(98.4%_0.012_80))] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.26em] text-[oklch(48%_0.09_165)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              今日学习起点
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <button
                  type="button"
                  onClick={() => navigate("/app/profile")}
                  className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/80 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-white"
                >
                  <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 text-sm font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                    {profile?.portrait?.avatar_url ? (
                      <img
                        key={profile.portrait.avatar_url}
                        src={profile.portrait.avatar_url}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement
                          img.style.display = "none"
                          const fallback = img.parentElement?.querySelector(".dashboard-avatar-fallback") as HTMLElement | null
                          if (fallback) fallback.style.display = "flex"
                        }}
                      />
                    ) : null}
                    {!profile?.portrait?.avatar_url && (
                      <span className="dashboard-avatar-fallback flex items-center justify-center">
                        {profile?.portrait?.nickname?.charAt(0) || profile?.user_id?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                    )}
                    {profile?.portrait?.avatar_url && (
                      <span className="dashboard-avatar-fallback items-center justify-center" style={{ display: "none" }}>
                        {profile?.portrait?.nickname?.charAt(0) || profile?.user_id?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                    )}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-slate-800">
                      {profile?.portrait?.nickname || "新用户"}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">{learningStage} · Lv.{userLevel}</span>
                  </span>
                </button>
                <span className="rounded-full border border-[oklch(89%_0.02_220)] bg-[linear-gradient(135deg,oklch(98%_0.01_220),oklch(99%_0.008_165))] px-3 py-1.5 text-xs font-medium text-[oklch(45%_0.08_220)]">
                  当前焦点：{currentSubjectName}
                </span>
              </div>

              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-5xl">
                  今天先回到 {currentSubjectName}，让学习重新进入同一条主线。
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                  {focusSummary}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  if (currentSubjectId) {
                    navigate(`/app/studio/${currentSubjectId}`)
                    return
                  }
                  navigate("/app/ai-learning-path")
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,oklch(31%_0.035_215),oklch(37%_0.05_165))] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] transition-all hover:brightness-105 active:scale-95"
              >
                <span>继续学习</span>
                <Icon icon="solar:arrow-right-bold-duotone" className="h-5 w-5" />
              </button>
              <button
                onClick={() => navigate("/app/stats")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[oklch(89%_0.02_80)] bg-[linear-gradient(135deg,oklch(99%_0.008_80),oklch(98.8%_0.008_165))] px-6 py-3.5 text-sm font-medium text-[oklch(43%_0.05_80)] transition-colors hover:border-[oklch(86%_0.03_80)] hover:bg-white"
              >
                <Icon icon="solar:chart-square-bold-duotone" className="h-5 w-5 text-[oklch(55%_0.11_80)]" />
                查看学习复盘
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,white,oklch(99%_0.004_210))] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
            <p className="text-[18px] font-semibold uppercase tracking-[0.28em] text-slate-400">下一步建议</p>
            <div className="mt-4 rounded-2xl bg-[linear-gradient(145deg,oklch(29%_0.03_215),oklch(34%_0.05_165))] px-5 py-6 text-white shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
              <p className="text-sm text-[oklch(92%_0.02_165_/_0.72)]">今日主线</p>
              <p className="mt-3 text-2xl font-semibold leading-tight">{nextLessonTitle}</p>
              <p className="mt-4 text-sm leading-7 text-[oklch(93%_0.018_165_/_0.78)]">
                先用学习工作台衔接当前概念，再根据练习反馈决定是否进入题库或复盘。
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-[oklch(90%_0.016_220)] bg-[linear-gradient(135deg,oklch(98%_0.01_220),oklch(99%_0.008_220))] px-4 py-4">
                <p className="text-xs font-medium text-[oklch(52%_0.045_220)]">综合能力概览</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <span className="text-3xl font-semibold text-[oklch(45%_0.09_220)]">{radarScore}</span>
                  <span className="text-xs text-slate-500">能力画像会随着练习与复盘持续更新</span>
                </div>
              </div>
              <div className="rounded-2xl border border-[oklch(89%_0.02_80)] bg-[linear-gradient(135deg,oklch(98.8%_0.008_80),oklch(99%_0.006_80))] px-4 py-4">
                <p className="text-xs font-medium text-[oklch(55%_0.05_80)]">累计投入</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <span className="text-3xl font-semibold text-[oklch(52%_0.11_80)]">{totalStudyHours}h</span>
                  <span className="text-xs text-slate-500">保持节奏比一次冲刺更重要</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6">
          <section
            data-testid="dashboard-progress-brief"
            className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[18px] font-semibold uppercase tracking-[0.28em] text-slate-500">学习摘要</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {progressHighlights.map((item) => (
                <div key={item.label} className={`rounded-2xl border p-5 ${item.tone}`}>
                  <p className={`text-sm font-medium ${item.labelTone}`}>{item.label}</p>
                  <p className={`mt-3 text-3xl font-semibold tracking-tight ${item.valueTone}`}>{item.value}</p>
                  <p className="mt-3 text-sm leading-7 text-slate-500">{item.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="text-[18px] font-semibold uppercase tracking-[0.28em] text-slate-500">学科切换入口</p>
                <div className="flex items-center gap-4">
                  {currentSubject ? (
                    <>
                      <SubjectIcon subject={currentSubject} className="h-14 w-14" />
                      <div>
                        <h2 className="text-xl font-semibold tracking-tight text-slate-900 md:text-[1.65rem]">
                          {currentSubject.name}
                        </h2>
                        <p className="mt-1 text-sm leading-7 text-slate-500">
                          {currentSubject.onboarding_status === "completed"
                            ? `已激活 · 进度 ${currentSubject.progress_percent.toFixed(0)}%`
                            : currentSubject.onboarding_status === "in_progress"
                              ? "已开始学习，尚未完成入门评估"
                              : "尚未开始学习"}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">还没有激活学科</h2>
                      <p className="mt-1 text-sm leading-7 text-slate-500">
                        先切换到一个学科，Dashboard 才能围绕它给出概览与学习入口。
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 md:max-w-[18rem] md:items-end">
                <button
                  type="button"
                  onClick={() => navigate("/app/subjects")}
                  className="inline-flex h-[54px] min-w-[150px] items-center justify-center gap-2 rounded-full border border-[oklch(89%_0.018_220)] bg-[linear-gradient(135deg,oklch(99%_0.006_220),oklch(98.8%_0.008_165))] px-6 text-sm font-medium text-[oklch(44%_0.08_220)] transition-colors hover:border-[oklch(86%_0.03_220)] hover:bg-white"
                >
                  <Icon icon="solar:book-bookmark-bold-duotone" className="h-5 w-5" />
                  切换学科
                </button>
                <p className="max-w-xs text-sm leading-7 text-slate-500 md:text-right">
                  首页只保留一个轻量切换入口，详细的学科选择与扩展管理放到独立页面里。
                </p>
              </div>
            </div>
          </section>

          <AchievementTreeCard />
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,white,oklch(99%_0.004_220))] p-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[18px] font-semibold uppercase tracking-[0.28em] text-[oklch(52%_0.045_220)]">能力画像</p>
              </div>
              <span className="rounded-full border border-[oklch(89%_0.02_165)] bg-[linear-gradient(135deg,oklch(97%_0.016_165),oklch(98.8%_0.01_220))] px-3 py-1 text-xs font-medium text-[oklch(47%_0.09_165)]">
                综合评分 {radarScore}
              </span>
            </div>
            <div className="mt-6 rounded-2xl border border-[oklch(90%_0.016_220)] bg-[linear-gradient(135deg,oklch(98.6%_0.01_220),oklch(99%_0.006_220))] p-4">
              <div className="min-h-[260px]">
                <AbilityRadarChart data={radarChartData} hideCard />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,white,oklch(99%_0.004_80))] p-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[18px] font-semibold uppercase tracking-[0.28em] text-[oklch(55%_0.05_80)]">社区动向</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">把有用的话题留在手边</h3>
              </div>
              <button
                onClick={() => {
                  communityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                }}
                className="inline-flex items-center gap-2 rounded-full border border-[oklch(89%_0.02_80)] bg-[linear-gradient(135deg,oklch(99%_0.008_80),oklch(98.8%_0.008_165))] px-3 py-1.5 text-xs font-medium text-[oklch(43%_0.05_80)] transition-colors hover:border-[oklch(86%_0.03_80)] hover:bg-white"
              >
                查看社区
                <Icon icon="solar:arrow-down-bold-duotone" className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 space-y-3">
              {tagStats.length > 0 ? tagStats.map((topic) => (
                <button
                  key={topic.tag}
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl border border-[oklch(89%_0.018_80)] bg-[linear-gradient(135deg,oklch(99%_0.006_80),oklch(98.8%_0.008_165))] px-4 py-4 text-left transition-colors hover:border-[oklch(86%_0.03_80)] hover:bg-white"
                  onClick={() => {
                    communityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${topic.color}`} />
                    <span className="text-sm font-medium text-slate-700">#{topic.tag}</span>
                  </div>
                  <span className="text-xs text-slate-500">{topic.display}</span>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                  暂无社区热点
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <div ref={communityRef} className="mt-8 w-full scroll-mt-6">
        <LearningCommunity />
      </div>
    </div>
  )
}
