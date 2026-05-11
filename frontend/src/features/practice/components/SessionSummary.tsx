import React, { useEffect, useState } from 'react'
import {
  XCircle,
  Award,
  Trophy,
  ArrowRight,
  RotateCcw,
  Star,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface SessionSummaryProps {
  results: {
    totalQuestions: number
    correctCount: number
    wrongCount: number
    answers: { questionId: string; isCorrect: boolean | null }[]
  }
  xpGained: number
  leveledUp: boolean
  newBadges: Array<{ badge_id: string; name: string; icon?: string }>
  submitFailCount?: number
  backLabel?: string
  onReviewWrong: () => void
  onBackToDashboard: () => void
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({
  results,
  xpGained,
  leveledUp,
  newBadges,
  submitFailCount = 0,
  backLabel = "返回题库",
  onReviewWrong,
  onBackToDashboard,
}) => {
  const [showContent, setShowContent] = useState(false)
  const gradedCount = results.answers.filter((a) => a.isCorrect !== null).length
  const pendingCount = results.answers.filter((a) => a.isCorrect === null).length
  const accuracy = gradedCount > 0
    ? Math.round((results.correctCount / gradedCount) * 100)
    : 0
  const isHighPerformance = accuracy >= 80

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="mx-auto w-full max-w-4xl p-4 md:p-10">
      <div className="space-y-10">
        {/* Opening — reflective, not triumphant */}
        <div className="space-y-5 text-center">
          <div className={cn(
            "inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)] transition-all duration-700",
            "dark:border-slate-800 dark:bg-slate-900/60",
            showContent ? "scale-100 opacity-100" : "scale-90 opacity-0"
          )}>
            {isHighPerformance ? (
              <Trophy className="h-8 w-8 text-[oklch(45%_0.11_165)] dark:text-[oklch(80%_0.11_165)]" strokeWidth={1.6} />
            ) : (
              <Target className="h-8 w-8 text-slate-500 dark:text-slate-400" strokeWidth={1.6} />
            )}
          </div>

          <div className="flex items-center justify-center gap-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[oklch(52%_0.06_165)] dark:text-[oklch(72%_0.06_165)]">
            <span className="inline-block h-px w-8 bg-[oklch(70%_0.06_165)]" />
            <span>本轮复盘</span>
            <span className="font-mono text-[9px] tracking-[0.18em] text-slate-400">SUMMARY</span>
          </div>

          <h1 className="font-display text-[clamp(1.75rem,2.6vw,2.25rem)] font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
            {isHighPerformance ? "这一轮你走得很稳" : "练习完成"}
          </h1>
          <p className="mx-auto max-w-[50ch] text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
            {isHighPerformance
              ? "继续保持这个节奏——记得之后把正确的路径写进下一次复盘里。"
              : submitFailCount > 0
                ? `已完成 ${results.totalQuestions} 道题目。有 ${submitFailCount} 道没能成功保存,待会儿可以重试一次。`
                : `已完成 ${results.totalQuestions} 道题目,答题记录已沉淀到复盘里。`}
          </p>
        </div>

        {/* Stats grid — calm, typographic, no side-stripes */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryTile
            delay={100}
            label="已完成"
            value={results.totalQuestions}
            unit="题"
            context={submitFailCount > 0 ? `${submitFailCount} 道保存失败` : "答题记录已保存"}
            showContent={showContent}
          />
          <SummaryTile
            delay={180}
            label="正确率"
            value={`${accuracy}%`}
            context={
              <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-[oklch(55%_0.11_165)] transition-all duration-1000 ease-out"
                  style={{ width: `${accuracy}%` }}
                />
              </div>
            }
            showContent={showContent}
          />
          <SummaryTile
            delay={260}
            label="获得经验"
            value={`+${xpGained}`}
            unit="XP"
            context={leveledUp ? (
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[oklch(97%_0.022_165)] px-2.5 py-0.5 text-[11px] font-medium text-[oklch(38%_0.1_165)] dark:bg-[oklch(26%_0.03_165)] dark:text-[oklch(82%_0.08_165)]">
                <Star className="h-3 w-3" strokeWidth={1.8} />
                升级了
              </span>
            ) : "继续累积"}
            showContent={showContent}
          />
          <SummaryTile
            delay={340}
            label="答题详情"
            value={`${results.correctCount}`}
            unit={`/ ${results.totalQuestions}`}
            context={(
              <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-slate-500 dark:text-slate-400">
                <XCircle className="h-3 w-3 text-[oklch(63%_0.14_25)]" strokeWidth={1.8} />
                {results.wrongCount} 道错
                {pendingCount > 0 && (
                  <span className="ml-2 text-slate-400">· {pendingCount} 待批改</span>
                )}
              </span>
            )}
            showContent={showContent}
          />
        </div>

        {/* Badges — quieter, sage accent */}
        {newBadges.length > 0 && (
          <div className={cn(
            "transition-opacity duration-500 delay-[450ms]",
            showContent ? "opacity-100" : "opacity-0"
          )}>
            <div className="mb-4 flex items-center gap-2">
              <Award className="h-4 w-4 text-[oklch(45%_0.11_165)] dark:text-[oklch(80%_0.11_165)]" strokeWidth={1.8} />
              <h3 className="font-display text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                新徽章
              </h3>
              <span className="font-mono text-[11px] text-slate-400">{newBadges.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {newBadges.map((badge, index) => (
                <div
                  key={badge.badge_id}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-5 text-center shadow-[0_8px_28px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/60"
                  style={{
                    animation: `summaryFadeIn 0.5s ease-out ${index * 0.08}s both`,
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[oklch(97%_0.022_165)] text-[oklch(45%_0.11_165)] dark:bg-[oklch(26%_0.03_165)] dark:text-[oklch(80%_0.11_165)]">
                    {badge.icon ? (
                      <img src={badge.icon} alt={badge.name} className="h-6 w-6" />
                    ) : (
                      <Award className="h-5 w-5" strokeWidth={1.8} />
                    )}
                  </div>
                  <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
                    {badge.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Question review */}
        <div className={cn(
          "rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_8px_28px_rgba(15,23,42,0.04)] transition-all duration-500 delay-[500ms] dark:border-slate-800 dark:bg-slate-900/60",
          showContent ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        )}>
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              答题概览
            </h3>
            <span className="font-mono text-[11px] text-slate-400">
              {results.correctCount}/{results.totalQuestions} 正确
            </span>
          </div>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            点击任意一题的格子可以快速定位这道题的答题状态。
          </p>
          <div className="mt-5 grid grid-cols-8 gap-2 md:grid-cols-10">
            {results.answers.map((answer, index) => {
              const status =
                answer.isCorrect === true
                  ? "correct"
                  : answer.isCorrect === false
                    ? "wrong"
                    : "pending"
              const statusLabel =
                status === "correct" ? "正确" : status === "wrong" ? "错误" : "待批改"
              return (
                <div
                  key={index}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-lg border text-[12px] font-mono font-medium transition-colors",
                    status === "correct"
                      ? "border-[oklch(90%_0.04_165)] bg-[oklch(97%_0.022_165)] text-[oklch(38%_0.1_165)] dark:border-[oklch(30%_0.05_165)] dark:bg-[oklch(26%_0.03_165)] dark:text-[oklch(80%_0.09_165)]"
                      : status === "wrong"
                        ? "border-[oklch(88%_0.05_25)] bg-[oklch(97%_0.022_25)] text-[oklch(42%_0.13_25)] dark:border-[oklch(32%_0.06_25)] dark:bg-[oklch(24%_0.04_25)] dark:text-[oklch(78%_0.11_25)]"
                        : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400"
                  )}
                  title={`第 ${index + 1} 题 · ${statusLabel}`}
                >
                  {index + 1}
                </div>
              )
            })}
          </div>

          <div className="mt-6 flex flex-col gap-2.5 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row">
            <Button
              variant="outline"
              className="h-11 flex-1 rounded-xl border-slate-200 text-[13px] dark:border-slate-700"
              onClick={onBackToDashboard}
            >
              <ArrowRight className="mr-1.5 h-4 w-4" strokeWidth={1.8} />
              {backLabel}
            </Button>
            {results.wrongCount > 0 && (
              <Button
                className="h-11 flex-1 rounded-xl bg-slate-900 text-[13px] text-white ring-1 ring-slate-900/5 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:ring-slate-100/10 dark:hover:bg-white"
                onClick={onReviewWrong}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" strokeWidth={1.8} />
                复习错题
              </Button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes summaryFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

interface SummaryTileProps {
  label: string
  value: React.ReactNode
  unit?: string
  context?: React.ReactNode
  delay: number
  showContent: boolean
}

function SummaryTile({ label, value, unit, context, delay, showContent }: SummaryTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)] transition-all duration-500 dark:border-slate-800 dark:bg-slate-900/60",
        showContent ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-[2rem] font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100">
          {value}
        </span>
        {unit && (
          <span className="text-[13px] font-medium text-slate-400 dark:text-slate-500">
            {unit}
          </span>
        )}
      </div>
      {typeof context === "string" ? (
        <p className="text-[12px] text-slate-500 dark:text-slate-400">{context}</p>
      ) : (
        context
      )}
    </div>
  )
}
