import { FocusBreather } from "@/features/studio/components/workstation/FocusBreather"

type PracticeHeroProps = {
  title: string
  progressLabel: string
  onPrimary: () => void
}

import { ArrowRight, Crosshair } from "lucide-react"

export function PracticeHero({
  title,
  progressLabel,
  onPrimary,
}: PracticeHeroProps) {
  return (
    <section
      data-testid="practice-hero"
      className="group relative flex min-h-[50vh] flex-col items-center justify-center overflow-hidden rounded-2xl bg-[#0A0F1A] px-10 py-20 text-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] ring-1 ring-white/5 transition-[transform,opacity,box-shadow] duration-700 ease-out motion-reduce:transition-none"
    >
      {/* 深层微米级底纹 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.02)_0%,transparent_100%)]" />
      <FocusBreather />
      
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
        {/* 雷达标尺风格顶部标签 */}
        <div className="mb-8 flex items-center justify-center space-x-3 text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400/70">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-emerald-400/30" />
          <span className="flex items-center gap-2">
            <Crosshair className="h-3.5 w-3.5" />
            Unified Focus Stage
          </span>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-emerald-400/30" />
        </div>
        
        <h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl text-balance">
          {title}
        </h1>
        
        <div className="mt-6 max-w-xl text-base text-slate-400/80 sm:text-lg text-balance">
          {progressLabel}
        </div>
        
        <div className="mt-12 flex justify-center">
          <button
            type="button"
            onClick={onPrimary}
            className="group/btn relative flex items-center justify-center gap-3 overflow-hidden rounded-full bg-emerald-500 px-10 py-4 text-sm font-bold text-emerald-950 shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] transition-all hover:scale-105 hover:bg-emerald-400 hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F1A] active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
          >
            <span className="relative z-10">开始练习</span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
          </button>
        </div>
      </div>
    </section>
  )
}
