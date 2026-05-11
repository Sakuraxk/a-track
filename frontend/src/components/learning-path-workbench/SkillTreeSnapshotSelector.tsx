import { useCallback, useState } from "react"
import {
  ChevronDown,
  FolderOpen,
  Plus,
  RotateCcw,
  Copy,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import type { SkillTreeSnapshot } from "@/lib/learningPathWorkbench"

type Props = {
  snapshots: SkillTreeSnapshot[]
  activeSnapshotId: string | null
  activeSnapshotName: string | null
  loading?: boolean
  onActivate: (snapshotId: string) => Promise<void>
  onCreate: (name: string, source: "system" | "current") => Promise<void>
  onRename: (snapshotId: string, name: string) => Promise<void>
  onDelete: (snapshotId: string) => Promise<void>
  onReset: (snapshotId: string) => Promise<void>
}

export function SkillTreeSnapshotSelector({
  snapshots,
  activeSnapshotId,
  activeSnapshotName,
  loading,
  onActivate,
  onCreate,
  onRename,
  onDelete,
  onReset,
}: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [busy, setBusy] = useState(false)

  const wrap = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }, [])

  const handleRenameStart = useCallback((snap: SkillTreeSnapshot, e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    setRenamingId(snap.id)
    setRenameValue(snap.name)
  }, [])

  const handleRenameConfirm = useCallback(async () => {
    if (!renamingId || !renameValue.trim()) return
    await wrap(() => onRename(renamingId, renameValue.trim()))
    setRenamingId(null)
  }, [renamingId, renameValue, onRename, wrap])

  const handleRenameCancel = useCallback(() => {
    setRenamingId(null)
  }, [])

  const isWorking = busy || loading

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-md transition-all hover:bg-slate-50 hover:shadow-md disabled:opacity-50"
          disabled={isWorking}
        >
          <FolderOpen className="h-3.5 w-3.5 text-teal-600" />
          <span className="max-w-[120px] truncate">{activeSnapshotName || "我的探索"}</span>
          {isWorking ? (
            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
          ) : (
            <ChevronDown className="h-3 w-3 text-slate-400" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-64 max-h-80 overflow-y-auto custom-scrollbar bg-white border-slate-200 text-slate-700 p-1.5 shadow-xl rounded-xl"
      >
        {/* Header */}
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          星图方案
        </div>

        {/* Snapshot list */}
        {snapshots.map((snap) => (
          <DropdownMenuItem
            key={snap.id}
            className="group flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 transition-colors cursor-pointer focus:bg-slate-50 focus:text-slate-900"
            onSelect={(e) => {
              if (renamingId || (e.target as HTMLElement).closest("button")) {
                e.preventDefault()
                return
              }
              if (snap.id !== activeSnapshotId) {
                wrap(() => onActivate(snap.id))
              }
            }}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className={`flex h-2 w-2 shrink-0 rounded-full ${
                  snap.id === activeSnapshotId
                    ? "bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.5)]"
                    : "bg-slate-300"
                }`}
              />
              {renamingId === snap.id ? (
                <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameConfirm()
                      if (e.key === "Escape") handleRenameCancel()
                    }}
                    className="flex-1 min-w-0 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-sm outline-none focus:border-teal-400"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRenameConfirm() }}
                    className="rounded p-0.5 text-teal-600 hover:bg-teal-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRenameCancel() }}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-sm font-medium">{snap.name}</span>
                  {snap.expansion_count > 0 && (
                    <span className="text-[11px] text-slate-400">
                      {snap.expansion_count} 个发散节点
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            {renamingId !== snap.id && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  title="重命名"
                  onClick={(e) => { e.stopPropagation(); handleRenameStart(snap, e.nativeEvent) }}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                {snapshots.length > 1 && (
                  <button
                    type="button"
                    title="删除"
                    onClick={(e) => { e.stopPropagation(); wrap(() => onDelete(snap.id)) }}
                    className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    disabled={isWorking}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </DropdownMenuItem>
        ))}

        {/* Divider */}
        <div className="my-1 h-px bg-slate-100" />

        {/* Actions */}
        <DropdownMenuItem
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 cursor-pointer focus:bg-slate-50"
          onSelect={() => {
            const name = `探索方案 ${snapshots.length + 1}`
            wrap(() => onCreate(name, "system"))
          }}
          disabled={isWorking}
        >
          <Plus className="h-3.5 w-3.5 text-teal-500" />
          从默认树新建
        </DropdownMenuItem>

        <DropdownMenuItem
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 cursor-pointer focus:bg-slate-50"
          onSelect={() => {
            const name = `${activeSnapshotName || "方案"} (副本)`
            wrap(() => onCreate(name, "current"))
          }}
          disabled={isWorking}
        >
          <Copy className="h-3.5 w-3.5 text-blue-500" />
          复制当前方案
        </DropdownMenuItem>

        {activeSnapshotId && (
          <DropdownMenuItem
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 cursor-pointer focus:bg-red-50"
            onSelect={() => wrap(() => onReset(activeSnapshotId))}
            disabled={isWorking}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重置为默认树
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
