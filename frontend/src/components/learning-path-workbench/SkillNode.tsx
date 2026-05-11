import { memo } from "react"
import { Handle, Position, NodeProps } from "reactflow"
import { CheckCircle2, Circle, MinusCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export type SkillNodeData = {
  label: string
  description?: string
  preference?: "known" | "target" | "avoid" | null
  selected?: boolean
  isUserGenerated?: boolean
  readOnly?: boolean
  level?: number
  stageIndex?: number
}

const SkillNode = ({ data, selected }: NodeProps<SkillNodeData>) => {
  const { label, preference } = data

  const getPreferenceIcon = () => {
    switch (preference) {
      case "known":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case "target":
        return <Circle className="h-4 w-4 text-sky-500 fill-sky-500/20" />
      case "avoid":
        return <MinusCircle className="h-4 w-4 text-amber-500" />
      default:
        return <Circle className="h-4 w-4 text-slate-300" />
    }
  }

  const getPreferenceBorder = () => {
    let style = ""
    switch (preference) {
      case "known":
        style = "border-emerald-200 bg-emerald-50/30"
        break
      case "target":
        style = "border-sky-300 bg-sky-50/50 shadow-[0_0_15px_rgba(14,165,233,0.1)]"
        break
      case "avoid":
        style = "border-amber-200 bg-amber-50/30"
        break
      default:
        style = "border-slate-200 bg-white"
        break
    }
    
    return style
  }

  return (
    <div
      className={cn(
        "group relative flex min-w-[160px] max-w-[220px] items-center gap-2 rounded-full border px-4 py-2 transition-all duration-300",
        getPreferenceBorder(),
        selected ? "border-teal-500 ring-2 ring-teal-500/10 scale-105 z-10" : "hover:border-slate-400"
      )}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-slate-300 !bg-white" />
      
      <div className="flex shrink-0 items-center justify-center">
        {getPreferenceIcon()}
      </div>
      
      <div className="flex-1 overflow-hidden flex items-center gap-1.5">
        <div className="truncate text-sm font-semibold text-slate-900" title={label}>{label}</div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-slate-300 !bg-white" />
    </div>
  )
}

export default memo(SkillNode)
