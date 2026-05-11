import type { LucideIcon } from "lucide-react"
import { ArrowRight, BarChart3 } from "lucide-react"

interface ReviewMetric {
  label: string
  value: string
}

interface ActionItem {
  title: string
  description: string
  icon: LucideIcon
  badge?: string
  onClick: () => void
}

interface LearningActionDockProps {
  reviewTitle: string
  reviewDescription: string
  reviewMetrics: ReviewMetric[]
  actions: ActionItem[]
}

export default function LearningActionDock({
  reviewTitle,
  reviewDescription,
  reviewMetrics,
  actions,
}: LearningActionDockProps) {
  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.3)]">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <BarChart3 className="h-4 w-4 text-emerald-500" />
          学习复盘摘要
        </div>
        <h3 className="mt-3 text-lg font-bold text-slate-900">{reviewTitle}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{reviewDescription}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {reviewMetrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{metric.label}</div>
              <div className="mt-2 text-lg font-bold text-slate-900">{metric.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.3)]">
        <div className="text-sm font-semibold text-slate-900">下一步动作</div>
        <div className="mt-4 space-y-3">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.title}
                type="button"
                onClick={action.onClick}
                className="group w-full rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-left transition-all hover:border-teal-200 hover:bg-white hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{action.title}</span>
                      {action.badge ? (
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700">
                          {action.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{action.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-600" />
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </aside>
  )
}
