type ReviewHeroProps = {
  summaryTitle: string
  resultLabel: string
  onPrimary: () => void
  onNext?: () => void
  nextLabel?: string
}

import { ArrowRight, Sparkles, BarChart3 } from "lucide-react"

export function ReviewHero({
  summaryTitle,
  resultLabel,
  onPrimary,
  onNext,
  nextLabel = "继续下一步",
}: ReviewHeroProps) {
  return (
    <section
      data-testid="review-hero"
      className="group relative flex min-h-[45vh] flex-col justify-center overflow-hidden rounded-2xl bg-slate-900 p-10 sm:p-16 text-white transition-[transform,opacity,box-shadow] duration-700 ease-out motion-reduce:transition-none"
    >
      {/* 极光/深海氛围背景 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_0%,rgba(30,58,138,0.25),transparent_100%)]" />
      <div className="absolute -left-[20%] top-[10%] h-[80%] w-[60%] rounded-full bg-indigo-500/20 blur-[100px]" />
      <div className="absolute -bottom-[20%] right-[0%] h-[60%] w-[50%] rounded-full bg-sky-400/15 blur-[80px]" />
      
      {/* 成就粒子纹理 */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA1KSIvPjwvc3ZnPg==')] [mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)]" />

      <div className="relative z-10 flex max-w-4xl flex-col items-start gap-6">
        <div className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 shadow-[0_0_15px_rgba(99,102,241,0.2)] backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
          <span className="ml-2 text-xs font-bold tracking-[0.25em] text-indigo-200">
            收束摘要
          </span>
        </div>
        
        <h1 className="text-4xl font-black leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-6xl text-balance">
          {summaryTitle}
        </h1>
        
        <div className="mt-2 max-w-2xl border-l-2 border-indigo-500/30 pl-5">
          <p className="text-base leading-relaxed text-slate-300 sm:text-lg">
            {resultLabel}
          </p>
        </div>
        
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onPrimary}
            className="group/btn relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-indigo-500 px-8 py-3.5 text-sm font-bold text-white shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)] transition-all hover:bg-indigo-400 hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <BarChart3 className="relative z-10 h-4 w-4" />
            <span className="relative z-10">查看复盘详情</span>
          </button>
          {onNext ? (
            <button
              type="button"
              onClick={onNext}
              className="group/next relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full border border-white/15 bg-white/10 px-8 py-3.5 text-sm font-bold text-white shadow-[0_0_24px_-12px_rgba(255,255,255,0.45)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
            >
              <span className="relative z-10">{nextLabel}</span>
              <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover/next:translate-x-1" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
