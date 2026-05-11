import { useMemo, useState, useRef, useEffect } from "react"
import { Map as MapIcon, ChevronDown, CheckCircle2, Target, EyeOff, X } from "lucide-react"

import type { LearningPathMap, SkillTreeNode } from "@/lib/learningPathWorkbench"
import type { PreferenceSnapshotPayload } from "@/lib/learningPathWorkbench"
import { cn } from "@/lib/utils"

type Props = {
  map: LearningPathMap | null
  preferences: PreferenceSnapshotPayload
  onRemovePreference?: (nodeId: string) => void
}

/** Walk the tree and build a Map from node‑id → label */
function buildLabelMap(node: SkillTreeNode, out: Map<string, string> = new Map()) {
  out.set(node.id, node.label)
  for (const child of node.children) {
    buildLabelMap(child, out)
  }
  return out
}

type CategoryConfig = {
  key: "known" | "target" | "avoid"
  label: string
  ids: string[]
  icon: typeof CheckCircle2
  dotClass: string
  badgeClass: string
  tagClass: string
}

export function StarMapPreferencesPopover({ map, preferences, onRemovePreference }: Props) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const labelMap = useMemo(() => {
    if (!map) return new Map<string, string>()
    return buildLabelMap(map.tree)
  }, [map])

  const categories: CategoryConfig[] = useMemo(
    () => [
      {
        key: "known",
        label: "已掌握",
        ids: preferences.known_node_ids,
        icon: CheckCircle2,
        dotClass: "bg-emerald-500",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        tagClass: "bg-emerald-50 text-emerald-700",
      },
      {
        key: "target",
        label: "想学习",
        ids: preferences.target_node_ids,
        icon: Target,
        dotClass: "bg-sky-500",
        badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
        tagClass: "bg-sky-50 text-sky-700",
      },
      {
        key: "avoid",
        label: "暂不学",
        ids: preferences.avoid_node_ids,
        icon: EyeOff,
        dotClass: "bg-amber-500",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
        tagClass: "bg-amber-50 text-amber-700",
      },
    ],
    [preferences],
  )

  const totalMarked =
    preferences.known_node_ids.length +
    preferences.target_node_ids.length +
    preferences.avoid_node_ids.length

  return (
    <div className={cn("relative", open && "z-50")} ref={popoverRef} data-testid="starmap-preferences-popover">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all select-none",
          open
            ? "border-teal-300 bg-teal-50 text-teal-700 shadow-sm"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:shadow-sm",
        )}
        data-testid="starmap-preferences-trigger"
      >
        <MapIcon className="h-3.5 w-3.5" />
        <span>星图偏好</span>
        {totalMarked > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-teal-600 px-1.5 text-[10px] font-bold text-white">
            {totalMarked}
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Popover Panel */}
      {open && (
        <div
          className="absolute left-0 top-full z-[100] mt-2 w-80 origin-top-left animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200"
          data-testid="starmap-preferences-panel"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-black/5">
            <div className="flex items-center gap-2 mb-3">
              <MapIcon className="h-4 w-4 text-teal-600" />
              <span className="text-sm font-semibold text-slate-900">学习星图标记</span>
              <span className="text-[10px] text-slate-400 ml-auto">影响计划生成</span>
            </div>

            {totalMarked === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                <p className="text-xs text-slate-400 font-medium">
                  尚未在星图中标记任何节点
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  切换到「学习星图」视图标记节点偏好
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {categories.map((cat) => {
                  if (cat.ids.length === 0) return null
                  const Icon = cat.icon
                  return (
                    <div key={cat.key} data-testid={`starmap-category-${cat.key}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={cn("h-2 w-2 rounded-full", cat.dotClass)} />
                        <span className="text-xs font-semibold text-slate-700">
                          {cat.label}
                        </span>
                        <span className={cn(
                          "ml-auto rounded-full border px-2 py-0.5 text-[10px] font-bold",
                          cat.badgeClass,
                        )}>
                          {cat.ids.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-4">
                        {cat.ids.map((id) => (
                          <span
                            key={id}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full pl-2.5 pr-1.5 py-1 text-[11px] font-medium group/tag",
                              cat.tagClass,
                            )}
                          >
                            <Icon className="h-3 w-3 opacity-60" />
                            {labelMap.get(id) || id}
                            {onRemovePreference && (
                              <button
                                type="button"
                                onClick={() => onRemovePreference(id)}
                                className="ml-0.5 rounded-full p-0.5 opacity-40 hover:opacity-100 hover:bg-black/5 transition-all"
                                title="移除偏好"
                                data-testid={`remove-preference-${id}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
