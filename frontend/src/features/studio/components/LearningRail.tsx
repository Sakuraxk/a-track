import { useEffect, useState } from "react"
import { BookMarked, Compass, Gauge, RefreshCcw, Route, Sparkles } from "lucide-react"

import { LearningPathTreePanel } from "@/components/learning-path-workbench/LearningPathTreePanel"
import { Button } from "@/components/ui/button"
import type { LearningPathMap } from "@/lib/learningPathWorkbench"
import type { NodePreference } from "@/stores/learning-path-workbench"

interface LearningGoalChip {
  id: string
  label: string
}

interface LearningRailProps {
  subjectName: string
  learningGoals: LearningGoalChip[]
  levelLabel: string
  levelDescription: string
  progressPercent: number
  currentDay: number | null
  totalDays: number | null
  dailyMinutes: number | null
  dayTheme: string | null
  strategySummary: string
  signalSummary: string
  treeMap: LearningPathMap | null
  focusedNodeId: string | null
  treePreferences: {
    known_node_ids: string[]
    target_node_ids: string[]
    avoid_node_ids: string[]
    free_text_notes?: string | null
  }
  onOpenLearningPath: () => void
  onAdjustStrategy: () => void
  onReassess: () => void
}

export default function LearningRail({
  subjectName,
  learningGoals,
  levelLabel,
  levelDescription,
  progressPercent,
  currentDay,
  totalDays,
  dailyMinutes,
  dayTheme,
  strategySummary,
  signalSummary,
  treeMap,
  focusedNodeId,
  treePreferences,
  onOpenLearningPath,
  onAdjustStrategy,
  onReassess,
}: LearningRailProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(focusedNodeId)

  useEffect(() => {
    setSelectedNodeId(focusedNodeId)
  }, [focusedNodeId])

  const handleSetPreference = (_nodeId: string, _preference: NodePreference) => {
    return
  }

  return (
    <aside className="space-y-4 lg:sticky lg:top-4">
      <section className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.3)]">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Compass className="h-4 w-4 text-teal-600" />
          当前学习策略
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">当前学科</div>
          <div className="mt-2 text-lg font-bold text-slate-900">{subjectName}</div>
          <div className="mt-1 text-xs text-slate-500">
            {currentDay && totalDays ? `当前在第 ${currentDay} / ${totalDays} 天` : "路线还未生成，先完成澄清与规划"}
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">学习目标</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {learningGoals.length > 0 ? (
                learningGoals.map((goal) => (
                  <span
                    key={goal.id}
                    className="inline-flex items-center rounded-full border border-teal-200/80 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700"
                  >
                    {goal.label}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">先完成路线澄清，明确当前目标</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
              <BookMarked className="h-3.5 w-3.5" />
              当前基础
            </div>
            <div className="mt-2 text-base font-bold text-slate-900">{levelLabel}</div>
            <p className="mt-1 text-sm leading-6 text-slate-500">{levelDescription}</p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">路线依据</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{strategySummary}</p>
            <div className="mt-3 rounded-2xl bg-slate-50/80 p-3 text-xs leading-5 text-slate-500">
              {signalSummary}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-teal-600" />
              策略树
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              用轻量树视图看清三件事：已经学了什么、当前正在学什么、接下来要衔接什么。
            </p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/80">
              <div className="h-[260px] w-full">
                {treeMap ? (
                  <LearningPathTreePanel
                    map={treeMap}
                    selectedNodeId={selectedNodeId}
                    searchTerm={searchTerm}
                    preferences={treePreferences}
                    readOnly
                    onSearchChange={setSearchTerm}
                    onSelectNode={setSelectedNodeId}
                    onSetPreference={handleSetPreference}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm leading-6 text-slate-500">
                    当前还没有可用的策略树数据。先完成路线生成，系统会自动把今天的主线放到树上。
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">路线进度</div>
              <div className="mt-2 text-lg font-bold text-slate-900">{progressPercent}%</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all"
                  style={{ width: `${Math.max(0, Math.min(progressPercent, 100))}%` }}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">今日主题</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{dayTheme || "等待今天的主任务生成"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
                <Gauge className="h-3.5 w-3.5" />
                节奏建议
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {dailyMinutes ? `${dailyMinutes} 分钟/天` : "等待系统安排"}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <Button
            onClick={onOpenLearningPath}
            className="h-11 w-full rounded-2xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Route className="mr-2 h-4 w-4" />
            打开学习路线
          </Button>
          <Button
            variant="outline"
            onClick={onAdjustStrategy}
            className="h-11 w-full rounded-2xl border-slate-200 bg-white/90 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            调整学习路线
          </Button>
          <Button
            variant="outline"
            onClick={onReassess}
            className="h-11 w-full rounded-2xl border-slate-200 bg-white/90 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            重新评估基础
          </Button>
        </div>
      </section>
    </aside>
  )
}
