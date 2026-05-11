import { useId, type PropsWithChildren } from "react"

import type { ActVisibility } from "@/features/studio/components/workstation/workstationTypes"

type ActSectionProps = PropsWithChildren<{
  title: string
  eyebrow?: string
  visibility?: ActVisibility
}>

export function ActSection({
  title,
  eyebrow,
  visibility = "expanded",
  children,
}: ActSectionProps) {
  const titleId = useId()

  if (visibility === "hidden") return null

  return (
    <section
      aria-labelledby={titleId}
      className="relative rounded-2xl border border-slate-200/50 bg-white/90 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl sm:p-10"
    >
      {/* 极简分割与装饰点 */}
      <div className="absolute left-10 top-10 flex h-2 w-2 items-center justify-center rounded-full bg-slate-200/80">
        <div className="h-1 w-1 rounded-full bg-slate-400" />
      </div>
      
      <div className="ml-6 space-y-1">
        {eyebrow ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
            {eyebrow}
          </p>
        ) : null}
        <h2
          id={titleId}
          className="text-sm font-bold uppercase tracking-[0.2em] text-slate-700"
        >
          {title}
        </h2>
      </div>
      
      {/* 精致的分割线 */}
      <div className="ml-6 mt-4 h-px w-full max-w-sm bg-gradient-to-r from-slate-200 to-transparent" />
      
      <div className={visibility === "compressed" ? "mt-6" : "mt-8"}>
        {children}
      </div>
    </section>
  )
}
