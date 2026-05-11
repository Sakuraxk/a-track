import { useId, useState, type PropsWithChildren } from "react"

type MicroStripProps = PropsWithChildren<{
  title: string
  summary: string
  defaultExpanded?: boolean
}>

import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function MicroStrip({
  title,
  summary,
  defaultExpanded = false,
  children,
}: MicroStripProps) {
  const panelId = useId()
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className={cn(
      "overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] backdrop-blur-xl transition-all duration-300",
      expanded ? "pb-6" : "hover:bg-white/90 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]"
    )}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((current) => !current)}
        className="group flex w-full items-center justify-between gap-4 px-6 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        <div className="flex items-center gap-4">
          <ChevronDown className={cn(
            "h-4 w-4 text-slate-400 transition-transform duration-300",
            expanded ? "-rotate-180" : "group-hover:translate-y-0.5"
          )} />
          <span className="text-sm font-bold text-slate-800">{title}</span>
        </div>
        <span className="text-sm font-medium text-slate-500 truncate">{summary}</span>
      </button>
      
      {expanded ? (
        <div
          id={panelId}
          role="region"
          aria-label={title}
          className="px-6 pt-2"
        >
          <div className="mb-6 h-px w-full bg-slate-100" />
          {children}
        </div>
      ) : null}
    </div>
  )
}
