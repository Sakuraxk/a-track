import { ArrowRight, Compass, Gauge, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SubjectIcon } from "@/components/ui/SubjectIcon"
import type { Subject } from "@/stores/subject"

interface StudioMissionHeaderProps {
  subject: Subject | null
  routeLabel: string
  missionTitle: string
  missionDescription: string
  progressPercent: number
  currentDay: number | null
  totalDays: number | null
  dailyMinutes: number | null
  hasPath: boolean
  onContinue: () => void
  onAdjustStrategy: () => void
}

export default function StudioMissionHeader({
  subject,
  routeLabel,
  missionTitle,
  missionDescription,
  progressPercent,
  currentDay,
  totalDays,
  dailyMinutes,
  hasPath,
  onContinue,
  onAdjustStrategy,
}: StudioMissionHeaderProps) {
  const progressText = hasPath && currentDay && totalDays ? `第 ${currentDay} / ${totalDays} 天` : "等待路线生成"
  const durationText = dailyMinutes ? `${dailyMinutes} 分钟/天` : "将根据你的状态动态安排"

  return (
    <section className="relative overflow-hidden rounded-2xl border border-teal-200/60 bg-[radial-gradient(circle_at_top_left,_rgba(15,159,132,0.2),_transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(239,250,247,0.92))] px-6 py-6 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] lg:px-8">
      <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-amber-200/30 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-teal-200/30 blur-3xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-white/80 bg-white/90 p-2 shadow-sm">
              {subject ? (
                <SubjectIcon subject={subject} className="h-16 w-16 rounded-2xl" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                  <Sparkles className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/85 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-teal-700 uppercase">
                <Compass className="h-3.5 w-3.5" />
                {routeLabel}
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 lg:text-[2.5rem]">
                  {missionTitle}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 lg:text-base">
                  {missionDescription}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">学习节奏</div>
              <div className="mt-2 text-lg font-bold text-slate-900">{progressText}</div>
              <div className="mt-1 text-xs text-slate-500">路线会围绕今天的主任务继续推进</div>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">当前进度</div>
              <div className="mt-2 text-lg font-bold text-slate-900">{progressPercent}%</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all"
                  style={{ width: `${Math.max(0, Math.min(progressPercent, 100))}%` }}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">推荐投入</div>
              <div className="mt-2 flex items-center gap-2 text-lg font-bold text-slate-900">
                <Gauge className="h-4 w-4 text-amber-500" />
                {durationText}
              </div>
              <div className="mt-1 text-xs text-slate-500">先完成主任务，再进入练习与复盘</div>
            </div>
          </div>
        </div>

        <div className="flex min-w-[240px] flex-col gap-3 rounded-2xl border border-white/80 bg-white/82 p-4 shadow-sm backdrop-blur lg:max-w-[280px]">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">今天的行动</div>
          <div className="text-sm leading-6 text-slate-600">
            {hasPath
              ? "先完成今天的主线任务，再用练习与工具把理解转成结果。"
              : "先确认你的学习路线，系统才会自动编排今天的主线任务。"}
          </div>
          <Button
            onClick={onContinue}
            className="h-12 rounded-2xl bg-teal-600 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-500"
          >
            {hasPath ? "继续今日学习" : "生成学习路线"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={onAdjustStrategy}
            className="h-11 rounded-2xl border-slate-200 bg-white/80 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            调整学习路线
          </Button>
        </div>
      </div>
    </section>
  )
}
