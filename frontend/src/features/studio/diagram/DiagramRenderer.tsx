import type { DiagramSpec } from "@/features/studio/diagram/types"
import { ArrowRight, Circle, Dot, Zap } from "lucide-react"

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback
  const normalized = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
  return normalized.length > 0 ? normalized : fallback
}

function asComparePairs(payload: Record<string, unknown>) {
  const left = asStringArray(payload.left_items, [])
  const right = asStringArray(payload.right_items, [])
  const maxLength = Math.max(left.length, right.length)
  if (maxLength === 0) return [{ left: "（知识点待补充）", right: "（知识点待补充）" }]
  return Array.from({ length: maxLength }, (_, idx) => ({
    left: left[idx] ?? "—",
    right: right[idx] ?? "—",
  }))
}

function renderFlow(spec: DiagramSpec) {
  const nodes = asStringArray(spec.payload.nodes, ["输入", "处理", "输出"])
  return (
    <div className="flex flex-wrap items-center gap-3">
      {nodes.map((node, idx) => (
        <div key={`${spec.title}-flow-${idx}`} className="flex items-center gap-3">
          <div className="relative overflow-hidden rounded-2xl border border-teal-100/50 bg-gradient-to-br from-white to-teal-50/30 px-5 py-2.5 text-sm font-medium text-slate-700 shadow-[0_2px_10px_-4px_rgba(20,184,166,0.2)] backdrop-blur-sm dark:border-teal-900/50 dark:from-slate-900 dark:to-teal-950/20 dark:text-slate-200">
            <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/40" />
            <span className="relative">{node}</span>
          </div>
          {idx < nodes.length - 1 ? (
            <ArrowRight className="h-4 w-4 animate-pulse text-teal-400 dark:text-teal-600" />
          ) : null}
        </div>
      ))}
    </div>
  )
}

function renderCompare(spec: DiagramSpec) {
  const leftTitle = typeof spec.payload.left_title === "string" ? spec.payload.left_title : "方案 A"
  const rightTitle = typeof spec.payload.right_title === "string" ? spec.payload.right_title : "方案 B"
  const rows = asComparePairs(spec.payload)
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/50 shadow-sm backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/50">
      <div className="grid grid-cols-2 bg-gradient-to-r from-slate-100/50 to-teal-50/50 text-sm font-semibold text-slate-800 dark:from-slate-800/50 dark:to-teal-900/30 dark:text-slate-100">
        <div className="border-r border-slate-200/60 px-5 py-3 dark:border-slate-700/60 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/80">{leftTitle}</div>
        <div className="px-5 py-3 transition-colors hover:bg-teal-50/80 dark:hover:bg-teal-900/40">{rightTitle}</div>
      </div>
      {rows.map((row, idx) => (
        <div key={`${spec.title}-compare-${idx}`} className="grid grid-cols-2 border-t border-slate-200/60 text-sm text-slate-600 dark:border-slate-800/60 dark:text-slate-300">
          <div className="border-r border-slate-200/60 px-5 py-3 dark:border-slate-700/60 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50">{row.left}</div>
          <div className="px-5 py-3 transition-colors hover:bg-teal-50/30 dark:hover:bg-teal-900/20">{row.right}</div>
        </div>
      ))}
    </div>
  )
}

function renderTimeline(spec: DiagramSpec) {
  const events = asStringArray(spec.payload.events, ["阶段一", "阶段二", "阶段三"])
  return (
    <div className="relative space-y-4 pl-4 before:absolute before:inset-y-0 before:left-2 before:w-[2px] before:bg-gradient-to-b before:from-teal-300 before:via-teal-200 before:to-transparent dark:before:from-teal-700 dark:before:via-teal-800">
      {events.map((event, idx) => (
        <div key={`${spec.title}-timeline-${idx}`} className="relative flex items-center gap-4">
          <div className="absolute -left-3.5 mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.5)] dark:border-slate-900 dark:bg-teal-500" />
          <div className="rounded-xl border border-slate-100 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200 transition-transform hover:-translate-y-0.5 hover:shadow-md">
            {event}
          </div>
        </div>
      ))}
    </div>
  )
}

function renderStructure(spec: DiagramSpec) {
  const root = typeof spec.payload.root === "string" ? spec.payload.root : spec.title
  const children = asStringArray(spec.payload.children, ["子节点 A", "子节点 B", "子节点 C"])
  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md">
        <Zap className="h-4 w-4 fill-white flex-shrink-0" />
        {root}
      </div>
      <div className="grid gap-3 pl-2 sm:grid-cols-2 lg:grid-cols-3">
        {children.map((child, idx) => (
          <div
            key={`${spec.title}-structure-${idx}`}
            className="group relative flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/60 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-md transition-all hover:-translate-y-1 hover:border-teal-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-teal-700"
          >
            <div className="absolute -left-[11px] top-1/2 h-[2px] w-[10px] -translate-y-1/2 bg-slate-200 dark:bg-slate-700" />
            <div className="absolute -left-[14px] top-1/2 h-full w-[2px] -translate-y-full bg-slate-200 dark:bg-slate-700" />
            <Circle className="h-2 w-2 fill-teal-400 text-teal-400 transition-transform group-hover:scale-125" />
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DiagramRenderer({ spec }: { spec: DiagramSpec }) {
  return (
    <section
      data-testid={`diagram-card-${spec.diagram_type}`}
      className="my-6 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50/80 to-slate-100/50 p-6 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:from-slate-900/60 dark:to-slate-800/40"
    >
      <div className="mb-5 flex items-center gap-2 border-b border-slate-200/60 pb-3 dark:border-slate-700/60">
        <Dot className="-ml-2 h-6 w-6 text-teal-500" />
        <h4 className="text-base font-bold tracking-tight text-slate-800 dark:text-slate-100">{spec.title}</h4>
      </div>
      {spec.diagram_type === "flow" ? renderFlow(spec) : null}
      {spec.diagram_type === "compare" ? renderCompare(spec) : null}
      {spec.diagram_type === "timeline" ? renderTimeline(spec) : null}
      {spec.diagram_type === "structure" ? renderStructure(spec) : null}
    </section>
  )
}
