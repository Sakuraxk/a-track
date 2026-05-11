import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import { Lock, CheckCircle2, BookOpen, Star } from "lucide-react"
import { cn } from "@/lib/utils"

export interface TreeNodeData {
  id: string
  code: string
  title: string
  difficulty: number
  prerequisites: string[]
  chapter_code: string | null
  status: "locked" | "unlocked" | "learning" | "mastered"
  mastery: number
  onExpand?: (nodeId: string) => void
  isExpanding?: boolean
  isExpanded?: boolean
}

export default memo(AchievementNode)

function AchievementNode({ data }: NodeProps<TreeNodeData>) {
  const isLocked = data.status === "locked"
  const isMastered = data.status === "mastered"
  const isLearning = data.status === "learning"
  const isUnlocked = data.status === "unlocked"
  const clampedMastery = Math.max(0, Math.min(100, data.mastery))
  const statusLabel = isLocked ? "未解锁" : isMastered ? "已掌握" : isLearning ? "学习中" : "已解锁"

  const showExpand = !!data.onExpand

  return (
    <div
      className={cn(
        "group relative min-w-[200px] overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-300",
        // Base styles
        "backdrop-blur-md",
        // Hover effects
        "hover:-translate-y-1 hover:shadow-xl hover:ring-2 ring-blue-400/20",
        // Status specific styles
        isLocked && "border-slate-200/50 bg-slate-50/80 text-slate-400 grayscale hover:grayscale-0 hover:border-slate-300",
        isUnlocked && "border-blue-200/50 bg-gradient-to-br from-white/90 to-blue-50/80 text-slate-700 hover:border-blue-300 hover:shadow-blue-500/20",
        isLearning && "border-amber-300 bg-gradient-to-br from-white/95 to-amber-50/90 ring-4 ring-amber-500/20 shadow-[0_0_25px_rgba(245,158,11,0.25)] hover:shadow-[0_0_35px_rgba(245,158,11,0.4)] hover:border-amber-400",
        isMastered && "border-emerald-300 bg-gradient-to-br from-white/95 to-emerald-50/90 shadow-[0_0_25px_rgba(16,185,129,0.2)] hover:shadow-[0_0_35px_rgba(16,185,129,0.35)] hover:border-emerald-400 hover:ring-2 hover:ring-emerald-500/20"
      )}
      title={`${data.title} · ${statusLabel} · 掌握度 ${clampedMastery}%`}
    >
      {/* Decorative background glow for mastered/learning */}
      {(isLearning || isMastered) && (
        <div className={cn(
          "absolute -right-4 -top-4 h-16 w-16 rounded-full blur-2xl opacity-40 transition-opacity",
          isLearning && "bg-amber-400",
          isMastered && "bg-emerald-400"
        )} />
      )}

      <Handle
        type="target"
        position={Position.Left}
        className={cn(
          "!h-3 !w-3 !border-2 transition-colors duration-300",
          isLocked ? "!bg-slate-200 !border-slate-300" :
            isMastered ? "!bg-emerald-500 !border-white" :
              isLearning ? "!bg-amber-400 !border-white" :
                "!bg-blue-400 !border-white"
        )}
      />

      <div className="relative flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-all duration-300 group-hover:scale-110",
            isLocked && "bg-slate-100 border-slate-200",
            isUnlocked && "bg-blue-50 border-blue-100 text-blue-500",
            isLearning && "bg-gradient-to-br from-amber-100 to-amber-200 border-amber-200 text-amber-600 shadow-amber-200",
            isMastered && "bg-gradient-to-br from-emerald-100 to-emerald-200 border-emerald-200 text-emerald-600 shadow-emerald-200"
          )}
        >
          {isLocked && <Lock className="h-4 w-4" />}
          {isUnlocked && <BookOpen className="h-4 w-4" />}
          {isLearning && <Star className="h-4 w-4 fill-current animate-pulse" />}
          {isMastered && <CheckCircle2 className="h-4 w-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-wider",
              isLocked ? "text-slate-400" :
                isMastered ? "text-emerald-600/70" :
                  isLearning ? "text-amber-600/70" : "text-blue-500/70"
            )}>
              Lv.{data.difficulty}
            </span>
            {isMastered && <span className="text-[10px] font-bold text-emerald-600">DONE</span>}
          </div>

          <div className={cn(
            "font-bold text-sm leading-tight truncate transition-colors",
            isLocked ? "text-slate-400" : "text-slate-700 group-hover:text-slate-900"
          )}>
            {data.title}
          </div>

          {!isLocked && (
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100/80 ring-1 ring-slate-200/50">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out relative",
                  isMastered ? "bg-gradient-to-r from-emerald-400 to-emerald-500" :
                    isLearning ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-blue-400"
                )}
                style={{ width: `${clampedMastery}%` }}
              >
                {/* Shimmer effect for learning progress */}
                {isLearning && (
                  <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite_-1s] w-full transform -skew-x-12 translate-x-[-100%]" />
                )}
              </div>
            </div>
          )}
        </div>

        {showExpand && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              data.onExpand?.(data.id)
            }}
            disabled={data.isExpanding}
            className={cn(
              "absolute -bottom-2 -right-2 h-6 px-2 rounded-full text-[10px] font-bold shadow-md opacity-0 group-hover:opacity-100 transition-all z-10 flex items-center gap-1",
              data.isExpanding ? "bg-slate-100 text-slate-400 cursor-not-allowed" :
                data.isExpanded ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" :
                  "bg-white text-slate-600 hover:text-primary hover:bg-slate-50 border border-slate-200"
            )}
            title={data.isExpanded ? "收起发散节点" : "向下发散概念"}
          >
            {data.isExpanding ? (
              <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
            ) : data.isExpanded ? (
              "-"
            ) : (
              "+"
            )}
            {data.isExpanded ? "收起" : "发散"}
          </button>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          "!h-3 !w-3 !border-2 transition-colors duration-300",
          isLocked ? "!bg-slate-200 !border-slate-300" :
            isMastered ? "!bg-emerald-500 !border-white" :
              isLearning ? "!bg-amber-400 !border-white" :
                "!bg-blue-400 !border-white"
        )}
      />
    </div>
  )
}
