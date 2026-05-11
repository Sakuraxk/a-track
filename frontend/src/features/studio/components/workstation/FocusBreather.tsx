import { cn } from "@/lib/utils"

type FocusBreatherProps = {
  className?: string
}

export function FocusBreather({ className }: FocusBreatherProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-2xl mix-blend-screen",
        className,
      )}
    >
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[80%] w-[80%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08)_0%,transparent_70%)] animate-pulse [animation-duration:4s] motion-reduce:animate-none" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[60%] w-[60%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.1)_0%,transparent_60%)] blur-[40px] animate-pulse [animation-duration:6s] [animation-delay:2s] motion-reduce:animate-none" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[40%] w-[40%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.15)_0%,transparent_50%)] blur-[20px] animate-pulse [animation-duration:3s] [animation-delay:1s] motion-reduce:animate-none" />
    </div>
  )
}
