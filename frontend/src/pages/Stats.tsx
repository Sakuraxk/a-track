import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Clock, Trophy, Flame, ArrowUpRight, Lightbulb, Target,
  BookOpen, Loader2, Activity, Compass, CalendarRange,
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar,
} from "recharts"

import { api, getApiErrorMessage } from "@/lib/api"
import type {
  ProgressSummary, WeeklyReport, AbilityRadarResponse,
  LearningStatsResponse, DailyDetailResponse,
} from "@/lib/backendTypes"
import { useAuthStore } from "@/stores/auth"
import { useSubjectStore } from "@/stores/subject"
import { useLearningPathStore, type LearningPath, type VersionSummary } from "@/stores/learning-path"
import { StudioPageHeader } from "@/components/navigation/StudioPageHeader"

// ─── Chart palette ─ muted, tinted toward brand sage ────────────
const CHART = {
  ink: "#0f172a",
  muted: "#94a3b8",
  grid: "rgba(15,23,42,0.06)",
  sage: "#10b981",
  sageSoft: "#4fb89c",
  teal: "#4b7b9c",
  amber: "#d6975f",
  rose: "#d98888",
}

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: "12px",
  padding: "10px 14px",
  boxShadow: "0 6px 20px rgba(15,23,42,0.06)",
  fontSize: "12px",
}

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"]

// ─── Act heading ─ quiet section rhythm, Chinese-first ─────────
function Act({
  index, label, caption, children, aside,
}: {
  index: string
  label: string
  caption: string
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-1">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-[12px] font-medium tracking-[0.16em] text-slate-400">{index}</span>
          <div>
            <h2 className="font-display text-[1.45rem] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {label}
            </h2>
            <p className="mt-1.5 max-w-[54ch] text-[14px] leading-6 text-slate-500 dark:text-slate-400">
              {caption}
            </p>
          </div>
        </div>
        {aside && <div className="flex-shrink-0">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

// ─── Data tile ─ restrained, numeric-first ─────────────────────
interface MetricTileProps {
  label: string
  value: React.ReactNode
  unit?: string
  context?: string
  icon: React.ElementType
  accent?: "sage" | "teal" | "slate"
  progress?: number
}

const ACCENT_STYLES: Record<NonNullable<MetricTileProps["accent"]>, { icon: string; bar: string }> = {
  sage:  { icon: "text-[oklch(45%_0.11_165)] bg-[oklch(97%_0.022_165)] dark:text-[oklch(80%_0.11_165)] dark:bg-[oklch(26%_0.03_165)]",
           bar: "bg-[oklch(55%_0.11_165)]" },
  teal:  { icon: "text-[oklch(45%_0.09_220)] bg-[oklch(97%_0.02_220)] dark:text-[oklch(80%_0.1_220)] dark:bg-[oklch(26%_0.03_220)]",
           bar: "bg-[oklch(55%_0.10_220)]" },
  slate: { icon: "text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800",
           bar: "bg-slate-400" },
}

function MetricTile({ label, value, unit, context, icon: Icon, accent = "sage", progress }: MetricTileProps) {
  const styles = ACCENT_STYLES[accent]
  const pct = typeof progress === "number" ? Math.max(0, Math.min(1, progress)) * 100 : null
  return (
    <article className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_8px_28px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-[1px] hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex items-start justify-between">
        <span className="text-[12px] font-medium tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
          {label}
        </span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${styles.icon}`}>
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-[2.25rem] font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-slate-400 dark:text-slate-500">{unit}</span>
        )}
      </div>
      {context && (
        <p className="text-[13px] leading-6 text-slate-500 dark:text-slate-400">{context}</p>
      )}
      {pct !== null && (
        <div className="mt-auto h-[3px] w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full ${styles.bar} transition-[width] duration-1000 ease-out`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </article>
  )
}

// ─── Surface panel ─ quiet white card ──────────────────────────
function Surface({
  title, subtitle, icon: Icon, children, className = "",
}: {
  title: string
  subtitle?: string
  icon?: React.ElementType
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_8px_28px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/50 ${className}`}>
      <div className="mb-5 flex items-start gap-3">
        {Icon && (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[oklch(97%_0.02_165)] text-[oklch(45%_0.11_165)] dark:bg-[oklch(26%_0.03_165)] dark:text-[oklch(80%_0.11_165)]">
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[18px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-[13px] leading-6 text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Empty placeholder ─ gentle, no marketing icons ────────────
function QuietEmpty({ icon: Icon, message, hint }: { icon: React.ElementType; message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-10 text-center dark:border-slate-800 dark:bg-slate-900/40">
      <Icon className="h-6 w-6 text-slate-300 dark:text-slate-600" strokeWidth={1.5} />
      <p className="text-[14px] leading-6 text-slate-500 dark:text-slate-400">{message}</p>
      {hint && <p className="text-[12px] leading-5 text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────
export default function Stats() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [progress, setProgress] = useState<ProgressSummary | null>(null)
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null)
  const [radar, setRadar] = useState<AbilityRadarResponse | null>(null)
  const [daily, setDaily] = useState<DailyDetailResponse | null>(null)
  const [stats, setStats] = useState<LearningStatsResponse | null>(null)

  const currentSubjectId = useSubjectStore((s) => s.currentSubjectId)
  const subjects = useSubjectStore((s) => s.subjects)
  const currentSubject = subjects.find((s) => s.id === currentSubjectId)

  const pathsBySubject = useLearningPathStore((s) => s.pathsBySubject)
  const versionsBySubject = useLearningPathStore((s) => s.versionsBySubject)
  const currentPath: LearningPath | null = currentSubject
    ? pathsBySubject[currentSubject.key] ?? null
    : null
  const versions: VersionSummary[] = currentSubject
    ? versionsBySubject[currentSubject.key] ?? []
    : []

  const [selectedPathId, setSelectedPathId] = useState<string | null>(null)
  useEffect(() => {
    if (currentPath && !selectedPathId) {
      setSelectedPathId(currentPath.id)
    }
  }, [currentPath, selectedPathId])

  useEffect(() => {
    if (!profile?.user_id) return
    if (subjects.length === 0) return

    let cancelled = false
    setLoading(true)
    setError(null)

    const subject = subjects.find((s) => s.id === currentSubjectId)
    const params: Record<string, string> = {}
    if (subject?.id) params.subject_id = subject.id
    if (subject?.key) params.subject_key = subject.key
    if (selectedPathId) params.learning_path_id = selectedPathId

    Promise.all([
      api.get<ProgressSummary>(`/api/reporting/progress/${profile.user_id}`, { params }),
      api.get<WeeklyReport>(`/api/reporting/weekly/${profile.user_id}`, { params }),
      api.get<AbilityRadarResponse>(`/api/reporting/radar/${profile.user_id}`, { params }),
      api.get<DailyDetailResponse>(`/api/reporting/daily-detail/${profile.user_id}`, { params }),
      api.get<LearningStatsResponse>(`/api/reporting/stats/${profile.user_id}`, { params }),
    ])
      .then(([pRes, wRes, rRes, dRes, sRes]) => {
        if (cancelled) return
        setProgress(pRes.data)
        setWeekly(wRes.data)
        setRadar(rRes.data)
        setDaily(dRes.data)
        setStats(sRes.data)
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [profile?.user_id, currentSubjectId, selectedPathId, subjects])

  const totalHours = useMemo(() => {
    if (!stats) return "--"
    return (stats.total_study_minutes / 60).toFixed(1)
  }, [stats])

  const weaknessCount = useMemo(() => {
    if (!weekly) return 0
    return Object.keys(weekly.weaknesses ?? {}).length
  }, [weekly])

  const weeklyMinutes = useMemo(() => {
    if (!stats?.weekly_activity?.length) return 0
    return stats.weekly_activity.reduce((sum, m) => sum + (m || 0), 0)
  }, [stats])

  const trendData = useMemo(() => {
    if (!daily?.items?.length) return []
    return daily.items.map((item) => ({
      date: item.date.slice(5),
      做题数: item.exercises_count,
      正确数: item.correct_count,
      正确率: item.exercises_count > 0
        ? Math.round((item.correct_count / item.exercises_count) * 100) : 0,
    }))
  }, [daily])

  const radarData = useMemo(() => {
    if (!radar?.data?.length) return []
    return radar.data.map((d) => ({
      category: d.category,
      score: d.score,
      fullScore: d.full_score,
    }))
  }, [radar])

  const weeklyBarData = useMemo(() => {
    if (!stats?.weekly_activity?.length) return []
    const today = new Date()
    return stats.weekly_activity.map((minutes, idx) => {
      const d = new Date(today)
      d.setDate(d.getDate() - (6 - idx))
      const dayOfWeek = d.getDay()
      return {
        day: WEEKDAY_LABELS[dayOfWeek === 0 ? 6 : dayOfWeek - 1],
        学习时长: minutes,
      }
    })
  }, [stats])

  const selectedVersion = versions.find((v) => v.id === selectedPathId)

  const accuracyPct = stats ? Math.round(stats.accuracy_rate * 100) : null
  const sageStroke = CHART.sage
  const tealStroke = CHART.teal
  const versionSelectValue = selectedPathId ?? "__all__"
  const selectedVersionProgress = selectedVersion ? Math.round(selectedVersion.progress_percent) : null

  const reviewLead = useMemo(() => {
    if (loading) {
      return {
        eyebrow: "加载中",
        headline: "正在生成学习复盘数据",
        narrative: "请稍候，系统正在为您汇总最近的学习数据和指标图表。",
        nextStep: "请等待数据加载完成。",
      }
    }

    if (error) {
      return {
        eyebrow: "数据加载失败",
        headline: "无法获取复盘数据",
        narrative: "加载学习数据时出现问题，您可以稍后重试或先继续进行练习。",
        nextStep: "稍后重试，或先去完成一组练习。",
      }
    }

    if (!stats && !progress && !weekly) {
      return {
        eyebrow: "暂无数据",
        headline: "需要更多练习数据来生成复盘",
        narrative: "您还没有足够的学习记录。请先完成一些练习，系统才能为您生成分析报告。",
        nextStep: "先去完成一组练习，再回来查看您的学习进度。",
      }
    }

    if ((accuracyPct ?? 0) >= 85 && weaknessCount <= 1) {
      return {
        eyebrow: "表现优秀",
        headline: "知识掌握得很稳固，可以尝试更高难度的题目",
        narrative: "您的正确率很高，且薄弱点较少。建议继续挑战更难的题目，以提升自己的水平。",
        nextStep: "选择更高难度的练习，继续提升。",
      }
    }

    if (weaknessCount >= 3) {
      return {
        eyebrow: "需要巩固",
        headline: "发现一些薄弱点，建议优先复习错题",
        narrative: "近期练习中暴露了一些薄弱环节。建议先复习和巩固这些经常出错的知识点。",
        nextStep: "优先复习错题最多的章节或概念。",
      }
    }

    if (weeklyMinutes < 120) {
      return {
        eyebrow: "学习时长不足",
        headline: "本周学习时间较少，难以生成全面的复盘",
        narrative: "您本周的学习时间不足 120 分钟。建议增加学习时间，以便系统能更准确地分析您的学习状态。",
        nextStep: "增加本周的学习时间，再回来查看分析结果。",
      }
    }

    return {
      eyebrow: "状态良好",
      headline: "学习渐入佳境，继续保持当前的节奏",
      narrative: "您已积累了一定的学习数据。建议继续按照当前的计划进行练习，并关注正确率和薄弱点的变化。",
      nextStep: "继续完成练习，观察学习效果。",
    }
  }, [accuracyPct, error, loading, progress, stats, weaknessCount, weekly, weeklyMinutes])

  const focusBullets = useMemo(() => {
    const bullets = [
      {
        label: "当前视角",
        value: selectedVersion
          ? selectedVersion.version_name || `学习计划 V${selectedVersion.version}`
          : "全部版本",
        hint: selectedVersionProgress !== null ? `推进 ${selectedVersionProgress}%` : "跨版本汇总观察",
      },
      {
        label: "本周状态",
        value: `${weeklyMinutes} 分钟`,
        hint: weeklyMinutes >= 180 ? "节奏已经连起来了" : "还可以再把连续性续上",
      },
      {
        label: "薄弱点",
        value: `${weaknessCount} 个`,
        hint: weaknessCount <= 1 ? "可以开始拉高难度" : "适合优先做针对回收",
      },
    ]

    return bullets
  }, [selectedVersion, selectedVersionProgress, weaknessCount, weeklyMinutes])

  return (
    <div className="mx-auto flex max-w-[92rem] flex-col gap-10 pb-16">
      <StudioPageHeader
        label="复盘"
        labelLatin="REVIEW"
        title={currentSubject ? `${currentSubject.name} · 学习状态` : "学习状态"}
        subtitle={
          currentSubject
            ? `查看您在过去一段时间内的学习情况、完成度及能力雷达图，为您接下来的学习提供参考。`
            : "请选择一个学科，查看您的学习状态与能力数据。"
        }
        meta={
          currentSubject && versions.length > 0 ? (
            <div className="grid gap-4 rounded-[1.6rem] border border-slate-200/80 bg-white/80 p-4 shadow-[0_8px_28px_rgba(15,23,42,0.04)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50 md:grid-cols-[minmax(0,1fr)_15rem] md:items-end">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  <BookOpen className="h-3 w-3" strokeWidth={1.8} />
                  <span>学习计划视角</span>
                </div>
                <p className="max-w-[42ch] text-[14px] leading-6 text-slate-500 dark:text-slate-400">
                  {selectedVersion
                    ? `当前查看「${selectedVersion.version_name || `学习计划 V${selectedVersion.version}`}」的复盘数据。目标是 ${selectedVersion.goal}，周期 ${selectedVersion.total_days} 天。`
                    : "当前显示所有版本的汇总数据，您可以通过下拉菜单切换查看特定版本的学习情况。"}
                </p>
                {selectedVersion && (
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-slate-500 dark:text-slate-400">
                    <span>每日目标 · {selectedVersion.daily_minutes} 分钟</span>
                    <span>当前推进 · {selectedVersionProgress}%</span>
                  </div>
                )}
              </div>
              <label className="space-y-2">
                <span className="block text-[12px] font-medium tracking-[0.14em] text-slate-400 uppercase dark:text-slate-500">
                  查看版本
                </span>
                <select
                  value={versionSelectValue}
                  onChange={(e) => setSelectedPathId(e.target.value === "__all__" ? null : e.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[14px] text-slate-700 shadow-sm outline-none transition-colors focus:border-[oklch(55%_0.1_165)] focus:ring-2 focus:ring-[oklch(55%_0.1_165)]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option value="__all__">全部版本</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {`V${v.version} · ${v.version_name || "未命名版本"} · ${Math.round(v.progress_percent)}%`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null
        }
      />

      {loading && (
        <div className="flex items-center gap-2 text-[14px] text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-[oklch(50%_0.1_165)]" strokeWidth={1.8} />
          <span>正在整理复盘数据…</span>
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/70 px-5 py-4 text-[14px] leading-6 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.95fr)]">
        <article className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-7 shadow-[0_18px_60px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.78))]">
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[oklch(46%_0.09_165)] dark:text-[oklch(78%_0.07_165)]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[oklch(88%_0.03_165)] bg-white/75 px-3 py-1 shadow-sm dark:border-[oklch(32%_0.03_165)] dark:bg-slate-900/60">
              <Lightbulb className="h-3.5 w-3.5" strokeWidth={1.8} />
              {reviewLead.eyebrow}
            </span>
            {selectedVersion && (
              <span className="font-mono text-[10px] tracking-[0.14em] text-slate-400 dark:text-slate-500">
                {selectedVersion.version_name || `V${selectedVersion.version}`}
              </span>
            )}
          </div>
          <div className="mt-5 space-y-4">
            <h2 className="max-w-[14ch] font-display text-[clamp(1.9rem,3vw,2.8rem)] font-semibold leading-[1.08] tracking-tight text-slate-900 dark:text-slate-50">
              {reviewLead.headline}
            </h2>
            <p className="max-w-[60ch] text-[15px] leading-8 text-slate-600 dark:text-slate-300">
              {reviewLead.narrative}
            </p>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {focusBullets.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/35"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  {item.label}
                </div>
                <div className="mt-2 text-[18px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {item.value}
                </div>
                <p className="mt-2 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
                  {item.hint}
                </p>
              </div>
            ))}
          </div>
        </article>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <article className="rounded-[1.6rem] border border-slate-200/80 bg-white p-5 shadow-[0_10px_32px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900/55">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              <Target className="h-3.5 w-3.5" strokeWidth={1.8} />
              当前建议
            </div>
            <p className="mt-3 text-[15px] leading-7 text-slate-700 dark:text-slate-200">
              {reviewLead.nextStep}
            </p>
          </article>

          <article className="rounded-[1.6rem] border border-slate-200/80 bg-white p-5 shadow-[0_10px_32px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900/55">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              <Trophy className="h-3.5 w-3.5" strokeWidth={1.8} />
              当前掌握感
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="font-display text-[2rem] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                {accuracyPct !== null ? `${accuracyPct}%` : "--"}
              </span>
              <span className="pb-1 text-[13px] text-slate-500 dark:text-slate-400">
                正确率
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
              {accuracyPct !== null && accuracyPct >= 85
                ? "稳定，适合继续拉高难度。"
                : "先把最近反复出错的地方重新压实。"}
            </p>
          </article>

          <article className="rounded-[1.6rem] border border-slate-200/80 bg-white p-5 shadow-[0_10px_32px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900/55">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              复盘视角
            </div>
            <p className="mt-3 text-[15px] leading-7 text-slate-700 dark:text-slate-200">
              {selectedVersion
                ? `现在按「${selectedVersion.version_name || `V${selectedVersion.version}`}」看变化，适合判断这个计划本身是否有效。`
                : "现在按全部版本看整体走势，适合先判断这门学科的长期节奏。"}
            </p>
          </article>
        </div>
      </section>

      {/* ═══ ACT I · 此刻 ═══ */}
      <Act
        index="I"
        label="当前状态"
        caption="近期学习投入、完成情况及进度概览。"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="学习时长"
            value={totalHours}
            unit="h"
            context={stats ? `累计 ${stats.total_study_minutes} 分钟专注` : "暂无专注记录"}
            icon={Clock}
            accent="sage"
            progress={stats ? Math.min(1, stats.total_study_minutes / Math.max(stats.total_study_minutes, 600)) : 0}
          />
          <MetricTile
            label="本周投入"
            value={weeklyMinutes}
            unit="min"
            context={stats ? `连续专注 ${stats.streak_days} 天` : "过去七天的学习分钟数"}
            icon={CalendarRange}
            accent="teal"
            progress={weeklyMinutes > 0 ? Math.min(1, weeklyMinutes / 420) : 0}
          />
          <MetricTile
            label="已掌握概念"
            value={progress?.completed_nodes ?? "--"}
            context={progress ? "本学科已收束的知识节点" : "开始学习后显示"}
            icon={Compass}
            accent="slate"
          />
          <MetricTile
            label="完成练习"
            value={stats?.completed_exercises ?? "--"}
            unit={stats?.total_exercises ? `/ ${stats.total_exercises}` : undefined}
            context={stats?.total_exercises ? "题库完成度" : "当前学科练习记录"}
            icon={Activity}
            accent="slate"
            progress={stats?.total_exercises ? stats.completed_exercises / stats.total_exercises : 0}
          />
        </div>
      </Act>

      {/* ═══ ACT II · 节奏 ═══ */}
      <Act
        index="II"
        label="学习趋势"
        caption="近两周的每日学习动态及能力评估雷达。"
      >
        <div className="grid gap-5 lg:grid-cols-3">
          <Surface
            title="每日学习趋势"
            subtitle={trendData.length > 0 ? `最近 ${trendData.length} 天的练习轨迹` : "最近 14 天的练习轨迹"}
            icon={Activity}
            className="lg:col-span-2"
          >
            {trendData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" debounce={1}>
                  <AreaChart data={trendData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradExercises" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={sageStroke} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={sageStroke} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradCorrect" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={tealStroke} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={tealStroke} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} />
                    <XAxis
                      dataKey="date"
                      stroke={CHART.muted}
                      tick={{ fill: CHART.muted, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: CHART.grid }}
                    />
                    <YAxis
                      stroke={CHART.muted}
                      tick={{ fill: CHART.muted, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ stroke: CHART.grid, strokeWidth: 1 }}
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={{ fontWeight: 600, marginBottom: "4px", color: CHART.ink }}
                    />
                    <Area
                      type="monotone"
                      dataKey="做题数"
                      stroke={sageStroke}
                      strokeWidth={1.75}
                      fill="url(#gradExercises)"
                      dot={false}
                      activeDot={{ r: 4, fill: sageStroke, strokeWidth: 0 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="正确数"
                      stroke={tealStroke}
                      strokeWidth={1.75}
                      fill="url(#gradCorrect)"
                      dot={false}
                      activeDot={{ r: 4, fill: tealStroke, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <QuietEmpty icon={Activity} message="暂无练习轨迹" hint="完成几道题后,这里会显示你的节奏。" />
            )}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: sageStroke }} />
                做题数
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: tealStroke }} />
                正确数
              </span>
            </div>
          </Surface>

          <Surface
            title="能力雷达"
            subtitle={radar?.summary || "各维度的表现形状"}
            icon={Target}
          >
            {radarData.length > 0 ? (
              <>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%" debounce={1}>
                    <RadarChart data={radarData} outerRadius="75%">
                      <PolarGrid stroke={CHART.grid} />
                      <PolarAngleAxis dataKey="category" tick={{ fill: CHART.muted, fontSize: 11 }} />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={{ fill: CHART.muted, fontSize: 10 }}
                        axisLine={false}
                      />
                      <Radar
                        name="能力值"
                        dataKey="score"
                        stroke={sageStroke}
                        fill={sageStroke}
                        fillOpacity={0.18}
                        strokeWidth={1.75}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 divide-x divide-slate-200 border-t border-slate-100 pt-4 text-center dark:divide-slate-800 dark:border-slate-800">
                  <div>
                    <div className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                      {radar?.overall_score ?? 0}
                    </div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-slate-400">综合评分</div>
                  </div>
                  <div>
                    <div className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                      {radar?.level ?? "--"}
                    </div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-slate-400">当前等级</div>
                  </div>
                </div>
              </>
            ) : (
              <QuietEmpty icon={Target} message="暂无能力数据" hint="完成一次测试或练习后,雷达会逐步生成。" />
            )}
          </Surface>
        </div>
      </Act>

      {/* ═══ ACT III · 每周回响 + 准确率 ═══ */}
      <Act
        index="III"
        label="每周回顾"
        caption="最近七天的学习时长分布及答题正确率。"
      >
        <div className="grid gap-5 lg:grid-cols-5">
          <Surface
            title="本周活动"
            subtitle="最近 7 天每日学习时长(分钟)"
            icon={Clock}
            className="lg:col-span-3"
          >
            {weeklyBarData.length > 0 ? (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%" debounce={1}>
                  <BarChart data={weeklyBarData} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} vertical={false} />
                    <XAxis
                      dataKey="day"
                      stroke={CHART.muted}
                      tick={{ fill: CHART.muted, fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: CHART.grid }}
                    />
                    <YAxis
                      stroke={CHART.muted}
                      tick={{ fill: CHART.muted, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(15,23,42,0.04)" }}
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value) => [`${value} 分钟`, "学习时长"]}
                    />
                    <Bar dataKey="学习时长" fill={sageStroke} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <QuietEmpty icon={Clock} message="暂无活动数据" />
            )}
          </Surface>

          <Surface
            title="练习准确率"
            subtitle="整体答题稳定度"
            icon={Trophy}
            className="lg:col-span-2"
          >
            <div className="flex flex-1 flex-col items-center justify-center gap-6 py-2">
              <div className="relative h-36 w-36">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke="rgba(15,23,42,0.06)" strokeWidth="8"
                  />
                  <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke="url(#accRing)" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(stats?.accuracy_rate ?? 0) * 326.73} 326.73`}
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="accRing" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={sageStroke} />
                      <stop offset="100%" stopColor={tealStroke} />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-[2rem] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    {accuracyPct !== null ? `${accuracyPct}%` : "--"}
                  </span>
                  <span className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-slate-400">准确率</span>
                </div>
              </div>
              <div className="grid w-full grid-cols-3 divide-x divide-slate-200 text-center dark:divide-slate-800">
                <div>
                  <div className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    {stats?.completed_exercises ?? 0}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">已作答</div>
                </div>
                <div>
                  <div className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    {stats?.streak_days ?? 0}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">连续天数</div>
                </div>
                <div>
                  <div className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    {stats?.total_exercises ?? 0}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">题库总量</div>
                </div>
              </div>
            </div>
          </Surface>
        </div>
      </Act>

      {/* ═══ ACT IV · 下一步 ═══ */}
      <Act
        index="IV"
        label="后续建议"
        caption="本周学习亮点总结、AI 提供的学习建议及需要回顾的薄弱点。"
      >
        <div className="grid gap-5 lg:grid-cols-5">
          {/* Highlights — quiet studio-navy panel, the single hero moment of the page */}
          <div
            className="relative flex flex-col overflow-hidden rounded-2xl p-8 text-slate-100 shadow-[0_24px_80px_rgba(15,23,42,0.18)] lg:col-span-2"
            style={{
              background: "linear-gradient(135deg, oklch(22% 0.025 215), oklch(28% 0.03 165))",
            }}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(circle_at_10%_90%,rgba(16,185,129,0.14),transparent_60%)]" />
            <div className="relative flex flex-col gap-6">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[oklch(82%_0.08_165)]">
                  <span className="h-px w-6 bg-[oklch(72%_0.1_165)]" />
                  <span>本周亮点</span>
                </div>
                <h3 className="mt-3 font-display text-[1.5rem] font-semibold tracking-tight leading-tight">
                  值得关注的进步
                </h3>
                <p className="mt-2 max-w-[38ch] text-[14px] leading-7 text-slate-300/80">
                  这是过去一周内系统记录到的您的学习进步。
                </p>
              </div>
              <div className="flex flex-1 flex-col gap-3">
                {weekly?.highlights?.length ? (
                  weekly.highlights.map((h, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/5 transition-all hover:bg-white/[0.08]"
                    >
                      <span className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[oklch(82%_0.11_165)]/15 font-mono text-[10px] font-medium text-[oklch(82%_0.11_165)]">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <p className="text-[13.5px] leading-relaxed text-slate-100/90">{h}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl bg-white/[0.04] px-5 py-8 text-center ring-1 ring-white/5">
                    <Lightbulb className="mx-auto h-5 w-5 text-slate-400/60" strokeWidth={1.5} />
                    <p className="mt-3 text-[13px] text-slate-300/80">完成更多练习后,AI 会挑出值得被看见的进步。</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recommendations + Weaknesses */}
          <div className="lg:col-span-3 space-y-5">
            <Surface
              title="AI 学习建议"
              subtitle="下一步学习方向参考"
              icon={Lightbulb}
            >
              <div className="space-y-2.5">
                {weekly?.recommendations?.length ? (
                  weekly.recommendations.map((r, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-4 rounded-xl border border-transparent bg-slate-50/70 px-4 py-3 transition-all hover:border-slate-200 hover:bg-white dark:bg-slate-800/40 dark:hover:border-slate-700 dark:hover:bg-slate-800/70"
                    >
                      <span className="mt-0.5 font-mono text-[11px] font-medium tracking-wider text-slate-400">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <p className="text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-200">{r}</p>
                    </div>
                  ))
                ) : (
                  <QuietEmpty icon={Lightbulb} message="暂无针对性建议" hint="先完成一些练习或测试,AI 会给到方向。" />
                )}
              </div>
            </Surface>

            <Surface
              title="待复习内容"
              subtitle={weaknessCount > 0 ? `本周有 ${weaknessCount} 个薄弱点需要复习` : "暂未发现需要复习的薄弱点"}
              icon={Flame}
            >
              {weekly && Object.keys(weekly.weaknesses ?? {}).length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(weekly.weaknesses).map(([k, v]) => (
                    <article
                      key={k}
                      className="group/w flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-[0_12px_36px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
                    >
                      <div>
                        <h4 className="font-display text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                          {k}
                        </h4>
                        <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                          {v}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate(`/app/question-bank?search=${encodeURIComponent(k)}`)}
                        className="mt-4 inline-flex items-center justify-between gap-2 rounded-lg text-[12.5px] font-medium text-slate-700 transition-colors hover:text-[oklch(32%_0.08_165)] dark:text-slate-200 dark:hover:text-[oklch(82%_0.08_165)]"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5" strokeWidth={1.8} />
                          进入强化复习
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover/w:translate-x-0.5 group-hover/w:-translate-y-0.5" strokeWidth={1.8} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-[oklch(92%_0.04_165)] bg-[oklch(98%_0.02_165)] px-5 py-4 dark:border-[oklch(30%_0.05_165)] dark:bg-[oklch(20%_0.03_165)]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[oklch(45%_0.11_165)] shadow-sm dark:bg-slate-900">
                    <Trophy className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-medium text-slate-800 dark:text-slate-100">
                      当前没有发现明显的薄弱点。
                    </p>
                    <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                      请继续保持当前的练习节奏。
                    </p>
                  </div>
                </div>
              )}
            </Surface>
          </div>
        </div>
      </Act>
    </div>
  )
}
