import { cn } from "@/lib/utils"

export function WorkstationSkeleton() {
  return (
    <div className="relative overflow-hidden pb-16 animate-in fade-in duration-500">
      {/* 这里的背景必须和 LearningWorkstation 的 ambientClassName 完全一致 */}
      <div 
        aria-hidden="true" 
        className={cn(
          "pointer-events-none absolute inset-x-6 top-2 z-0 h-[30rem] rounded-[52px] opacity-40 blur-2xl saturate-50 transition-opacity duration-1000",
          "bg-[radial-gradient(circle_at_25%_20%,rgba(16,185,129,0.18),transparent_40%),radial-gradient(circle_at_75%_10%,rgba(59,130,246,0.16),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0))]"
        )} 
      />
      
      <div className="mx-auto max-w-7xl space-y-6 pt-6 relative z-10">
        <div className="flex justify-center">
          {/* 模拟顶部的 DynamicContextIsland */}
          <div className="h-12 w-64 rounded-full bg-white/80 border border-slate-100 shadow-sm animate-pulse" />
        </div>

        {/* 模拟 Hero 区域 */}
        <div className="relative overflow-hidden rounded-[36px] bg-slate-50/50 border border-white p-10 sm:p-16 h-[40vh] flex flex-col justify-center gap-6">
          <div className="h-6 w-24 rounded-full bg-slate-200 animate-pulse" />
          <div className="h-12 w-3/4 rounded-2xl bg-slate-200 animate-pulse" />
          <div className="space-y-2 mt-2">
            <div className="h-4 w-1/2 rounded-lg bg-slate-100 animate-pulse" />
            <div className="h-4 w-1/3 rounded-lg bg-slate-100 animate-pulse" />
          </div>
          <div className="mt-4 h-12 w-40 rounded-full bg-slate-900/10 animate-pulse" />
        </div>

        {/* 模拟 Acts 区域 */}
        <div className="space-y-4">
          <div className="h-48 w-full rounded-[24px] bg-white border border-slate-100 shadow-sm animate-pulse" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
             {[1, 2, 3, 4].map(i => (
               <div key={i} className="h-32 rounded-[24px] bg-white border border-slate-50 shadow-sm animate-pulse" />
             ))}
          </div>
        </div>
      </div>
    </div>
  )
}
