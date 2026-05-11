import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, BookOpen, CheckCircle2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export interface QuestionGroupProgress {
  attempts_count: number
  correct_count: number
  wrong_count: number
  accuracy_rate: number
  completed_count: number
  total_count: number
  last_practiced_at?: string | null
}

export interface QuestionGroup {
  id: string
  subject_id?: string | null
  source_type: string
  source_task_id: string
  source_annotation?: string | null
  learning_path_id?: string | null
  learning_path_version?: number | null
  learning_path_version_name?: string | null
  source_day?: number | null
  source_chapter_id?: string | null
  source_chapter_title?: string | null
  source_task_title?: string | null
  source_scope_key?: string | null
  title?: string | null
  description?: string | null
  item_count: number
  progress: QuestionGroupProgress
}

interface QuestionGroupCardProps {
  group: QuestionGroup
  onStart: (group: QuestionGroup) => void
  onDelete?: (group: QuestionGroup) => void
  loading?: boolean
}

export function QuestionGroupCard({ group, onStart, onDelete, loading }: QuestionGroupCardProps) {
  const total = group.item_count || 1
  const attempted = group.progress.completed_count
  const correct = group.progress.correct_count
  const wrong = group.progress.wrong_count

  // Round cumulatively so rounding drift never overflows 100%.
  const correctPct = Math.round((correct / total) * 100)
  const correctPlusWrongPct = Math.min(100, Math.round(((correct + wrong) / total) * 100))
  const wrongPct = Math.max(0, correctPlusWrongPct - correctPct)
  const attemptedPct = Math.min(100, Math.round((attempted / total) * 100))
  const pendingPct = Math.max(0, attemptedPct - correctPlusWrongPct)
  const isAllDone = attempted >= total

  const sourceLabel = group.source_type === "concept_learning"
    ? "概念学习"
    : group.source_type === "ai_generated"
      ? "AI 生成"
      : "手动创建"

  const accuracyLabel = group.progress.accuracy_rate > 0
    ? `${group.progress.accuracy_rate}%`
    : null

  const groupName = group.title || "这组练习"

  return (
    <Card
      className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
    >
      {onDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="移出这组练习"
              onClick={(e) => e.stopPropagation()}
              className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full text-slate-400 opacity-100 transition-opacity hover:text-slate-700 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 dark:hover:text-slate-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>移出「{groupName}」?</AlertDialogTitle>
              <AlertDialogDescription>
                这组练习会从题库视图里消失。已经完成的答题记录会保留在学习路径的复盘里,不会影响你已掌握的进度。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>再想想</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(group)}
                className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                移出题库
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <CardContent className="flex flex-col gap-5 p-6">
        <header className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[oklch(55%_0.05_165)] dark:text-[oklch(72%_0.06_165)]">
            <BookOpen className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.8} />
            <span className="truncate">{sourceLabel}</span>
            {accuracyLabel && (
              <span className="ml-auto font-mono text-[12px] tracking-normal text-slate-500 dark:text-slate-400">
                {accuracyLabel}
              </span>
            )}
          </div>
          <h3 className="font-display text-[1.2rem] font-semibold leading-snug tracking-tight text-slate-900 transition-colors group-hover:text-[oklch(32%_0.08_165)] line-clamp-2 dark:text-slate-100 dark:group-hover:text-[oklch(82%_0.08_165)]">
            {group.title || "未命名题组"}
          </h3>
          {group.source_annotation?.trim() && (
            <p className="line-clamp-2 text-[14px] leading-6 text-slate-500 dark:text-slate-400">
              {group.source_annotation}
            </p>
          )}
        </header>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-[13px] text-slate-500 dark:text-slate-400">
            <span className="tracking-wide">练习进度</span>
            <span className="font-mono text-[12px] text-slate-600 dark:text-slate-300">
              {attempted}<span className="text-slate-400 dark:text-slate-500">/{group.item_count}</span>
            </span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            {correctPct > 0 && (
              <div
                className="h-full bg-[oklch(55%_0.11_165)] transition-all duration-700"
                style={{ width: `${correctPct}%` }}
              />
            )}
            {wrongPct > 0 && (
              <div
                className="h-full bg-[oklch(63%_0.14_25)] transition-all duration-700"
                style={{ width: `${wrongPct}%` }}
              />
            )}
            {pendingPct > 0 && (
              <div
                className="h-full bg-[oklch(72%_0.11_75)] transition-all duration-700"
                style={{ width: `${pendingPct}%` }}
              />
            )}
          </div>
        </div>

        <Button
          className={cn(
            "mt-1 h-11 w-full gap-2 rounded-xl text-[15px] font-medium transition-all",
            isAllDone
              ? "bg-[oklch(97%_0.025_165)] text-[oklch(32%_0.09_165)] shadow-none hover:bg-[oklch(94%_0.035_165)] dark:bg-[oklch(28%_0.04_165)] dark:text-[oklch(88%_0.07_165)] dark:hover:bg-[oklch(32%_0.05_165)]"
              : "bg-slate-900 text-white ring-1 ring-slate-900/5 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:ring-slate-100/10 dark:hover:bg-white"
          )}
          onClick={() => onStart(group)}
          disabled={loading || group.item_count === 0}
        >
          {isAllDone ? (
            <>
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
              再次练习
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              开始练习
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
