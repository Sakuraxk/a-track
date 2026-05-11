import { useEffect, useState } from "react"
import { Clock3 } from "lucide-react"
import { cn } from "@/lib/utils"

type QuestionType = "mcq" | "coding" | "fill_blank" | "short_answer" | "essay"

const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: "选择题",
  coding: "编程题",
  fill_blank: "填空题",
  short_answer: "简答题",
  essay: "论述题",
}

interface PracticeHeaderProps {
  currentIndex: number
  totalCount: number
  questionType?: QuestionType | string
  streak?: number
  className?: string
}

export function PracticeHeader({
  currentIndex,
  totalCount,
  questionType,
  streak = 0,
  className,
}: PracticeHeaderProps) {
  // Completed = number of questions left behind, not the one you're currently on.
  const completed = currentIndex
  const total = Math.max(1, totalCount)
  const progress = Math.round((completed / total) * 100)

  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    setElapsed(0)
    const timer = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(timer)
  }, [currentIndex])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0")
  const ss = String(elapsed % 60).padStart(2, "0")

  return (
    <header
      className={cn(
        "h-14 px-5 border-b border-slate-200 dark:border-slate-800",
        "bg-white/85 dark:bg-slate-900/80 backdrop-blur-md",
        "flex items-center gap-5 flex-shrink-0 z-30",
        className,
      )}
    >
      {/* Left: question type + index */}
      <div className="flex items-center gap-3 min-w-0">
        {questionType && (
          <span className="inline-flex items-center rounded-full border border-[oklch(90%_0.03_165)] bg-[oklch(97%_0.018_165)] px-2.5 py-0.5 text-[11px] font-medium tracking-[0.02em] text-[oklch(36%_0.08_165)] dark:border-[oklch(30%_0.05_165)] dark:bg-[oklch(22%_0.035_165)] dark:text-[oklch(82%_0.08_165)]">
            {QUESTION_TYPE_LABELS[questionType] || questionType}
          </span>
        )}
        <span className="font-mono text-[12px] tracking-[0.08em] text-slate-600 dark:text-slate-300">
          <span className="text-slate-900 dark:text-slate-100 font-semibold">第 {currentIndex + 1} 题</span>
          <span className="ml-1.5 text-slate-400">· {currentIndex + 1}/{totalCount}</span>
        </span>
      </div>

      {/* Center/Right: timer + progress + streak */}
      <div className="flex flex-1 items-center justify-end gap-5">
        {streak > 1 && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-[oklch(42%_0.1_165)] dark:text-[oklch(78%_0.09_165)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[oklch(55%_0.11_165)]" />
            连对 <span className="font-mono tracking-wider">{streak}</span>
          </span>
        )}

        <div className="hidden md:flex items-center gap-2.5">
          <div className="w-28 h-[3px] bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[oklch(55%_0.11_165)] transition-all duration-700 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-[10px] tracking-wider text-slate-400">
            {progress}%
          </span>
        </div>

        <div className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <Clock3 size={13} strokeWidth={1.8} />
          <span className="font-mono text-[11px] tracking-wider text-slate-600 dark:text-slate-300">
            {mm}:{ss}
          </span>
        </div>
      </div>
    </header>
  )
}
