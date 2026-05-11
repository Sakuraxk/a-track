import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

interface StudioPageHeaderProps {
  /** Chinese label — the primary voice */
  label: string
  /** Latin companion — small, after-mark, optional */
  labelLatin?: string
  title: string
  subtitle: string
  meta?: ReactNode
}

/**
 * Learning Studio page header.
 * One eyebrow scale (0.28em) — used across /app/stats, /app/question-bank, and
 * any future sub-page that wants to speak the studio voice.
 */
export function StudioPageHeader({ label, labelLatin, title, subtitle, meta }: StudioPageHeaderProps) {
  const navigate = useNavigate()
  return (
    <header
      className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 gap-y-6 pb-2"
    >
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="group inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 text-slate-500 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:text-slate-100"
        aria-label="返回"
      >
        <ArrowLeft className="h-[18px] w-[18px] transition-transform group-hover:-translate-x-0.5" />
      </button>
      <div className="min-w-0 space-y-3">
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[oklch(52%_0.06_165)] dark:text-[oklch(72%_0.06_165)]">
          <span className="inline-block h-px w-8 bg-[oklch(70%_0.06_165)]" />
          <span>{label}</span>
          {labelLatin && (
            <span className="font-mono text-[10px] font-medium tracking-[0.16em] text-slate-400">
              {labelLatin}
            </span>
          )}
        </div>
        <h1 className="font-display text-[clamp(1.75rem,2.8vw,2.4rem)] font-semibold leading-[1.1] tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        <p className="max-w-[62ch] text-[16px] leading-8 text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      </div>
      {meta && (
        <>
          <div aria-hidden />
          <div className="min-w-0">{meta}</div>
        </>
      )}
    </header>
  )
}
