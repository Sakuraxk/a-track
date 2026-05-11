import { BookMarked, Clock3, GitBranch, Orbit, Trash2, ChevronDown } from "lucide-react"
import type { ReactNode } from "react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

import type { ReadyCheck } from "@/lib/learningPathWorkbench"
import type { LearningPath, VersionSummary } from "@/stores/learning-path"

type Props = {
  subjectName: string
  mapVersion: number | null
  sessionStatus: string
  readyCheck: ReadyCheck | null
  path: LearningPath | null
  versions: VersionSummary[]
  onSwitchVersion: (version: number) => Promise<void> | void
  onDeleteVersion?: (version: number) => void
  isDeleting?: boolean
  actions?: ReactNode
}

export function LearningPathVersionHeader({
  subjectName,
  // mapVersion unused
  sessionStatus,
  readyCheck,
  path,
  versions,
  onSwitchVersion,
  onDeleteVersion,
  isDeleting,
  actions,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#111827_50%,#0f766e_140%)] p-6 text-white shadow-[0_24px_80px_-48px_rgba(15,23,42,0.7)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-cyan-200">
            <Orbit className="h-3.5 w-3.5" />
            Learning Path Workbench
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{subjectName} 学习路线工作台</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              左侧用技术树标定起点与目标，右侧和 AI 一起补齐学习约束。每次生成都会创建一个全新的学习路线版本。
            </p>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-1 md:grid-cols-3 shrink-0">
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 min-w-0">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-300 whitespace-nowrap">会话状态</div>
            <div className="mt-2 text-lg font-semibold whitespace-nowrap">{sessionStatus || "--"}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 min-w-0">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-300 whitespace-nowrap">当前版本</div>
            <div className="mt-2 text-lg font-semibold whitespace-nowrap">{path?.version_name || "尚未生成"}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 min-w-0">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-300 whitespace-nowrap">生成状态</div>
            <div className="mt-2 text-lg font-semibold whitespace-nowrap">{readyCheck?.ready ? "可生成" : "澄清中"}</div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
            <BookMarked className="h-4 w-4 text-cyan-300" />
            版本数：{versions.length || 0}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
            <Clock3 className="h-4 w-4 text-cyan-300" />
            当前节奏：{path?.daily_minutes ? `${path.daily_minutes} 分钟/天` : "等待生成"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {actions}
          {versions.length > 0 && (
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 pl-4 py-1.5 pr-1.5 text-sm text-slate-100">
              <GitBranch className="h-4 w-4 text-cyan-300" />
              <span className="mr-1">切换版本</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-sm text-white outline-none hover:bg-slate-800 transition-colors">
                    {path?.version_name || (path ? `学习计划 v${path.version}` : versions[0]?.version_name || `学习计划 v${versions[0]?.version}`)}
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom" className="w-52 max-h-72 overflow-y-auto custom-scrollbar bg-slate-900 border-slate-700 text-slate-100 p-1.5 shadow-xl">
                  {versions.map((version) => (
                    <DropdownMenuItem
                      key={version.version}
                      className="flex items-center justify-between focus:bg-slate-800 focus:text-white cursor-pointer px-3 py-2.5 rounded-md transition-colors group"
                      onSelect={(e) => {
                        // Prevent closing if we clicked the delete button
                        if ((e.target as HTMLElement).closest('button')) {
                          e.preventDefault()
                          return
                        }
                        if (version.version !== path?.version) {
                          onSwitchVersion(version.version)
                        }
                      }}
                    >
                      <span className="truncate pr-2 font-medium">
                        {version.version_name || `学习计划 v${version.version}`}
                      </span>
                      {onDeleteVersion && (
                        <button
                          type="button"
                          title="删除此版本"
                          className="invisible group-hover:visible rounded-full p-1.5 bg-slate-800/80 text-slate-400 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteVersion(version.version)
                          }}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
