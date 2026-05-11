type ProgressHeroProps = {
  title: string
  reason: string
  primaryLabel: string
  onPrimary: () => void
  primaryDisabled?: boolean
}

import { ArrowRight } from "lucide-react"

export function ProgressHero({
  title,
  reason,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
}: ProgressHeroProps) {
  return (
    <section
      data-testid="progress-hero"
      className="group relative flex min-h-[40vh] flex-col justify-center overflow-hidden rounded-2xl bg-slate-50 p-10 sm:p-16 transition-[transform,opacity,box-shadow] duration-700 ease-out motion-reduce:transition-none"
    >
      {/* 沉浸式晨光背景纹理 */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-transparent to-slate-100/50" />
      <div className="absolute -left-[10%] -top-[20%] h-[60%] w-[50%] rounded-full bg-emerald-100/40 blur-[80px]" />
      <div className="absolute -bottom-[20%] -right-[10%] h-[60%] w-[50%] rounded-full bg-blue-100/30 blur-[80px]" />
      
      {/* 网格纹理增加物理感 */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.02)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)]" />

      <div className="relative z-10 flex max-w-4xl flex-col items-start gap-6">
        <div className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-50/50 px-3 py-1 shadow-sm backdrop-blur-sm">
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="ml-2 text-xs font-bold tracking-[0.28em] text-emerald-700">
            推进剧本
          </span>
        </div>
        
        <h1 className="text-4xl font-black leading-[1.15] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        
        <div className="mt-2 max-w-2xl border-l-2 border-slate-200 pl-5">
          <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
            {reason}
          </p>
        </div>
        
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled}
            className="group/btn relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-slate-900 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none disabled:hover:bg-slate-400 disabled:hover:shadow-none disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <span className="relative z-10">{primaryLabel}</span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
          </button>
        </div>
      </div>
    </section>
  )
}
