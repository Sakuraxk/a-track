import { useEffect, useState } from "react"
import { Loader2, Sparkles, Brain, Code, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function GeneratingOverlay({ show }: { show: boolean }) {
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)

  const steps = [
    { icon: Brain, label: "正在分析知识体系范围..." },
    { icon: Code, label: "结合您的偏好排列学习顺序..." },
    { icon: Sparkles, label: "自动匹配高质量学习资源..." },
    { icon: CheckCircle2, label: "组合最终专属学习路径图..." },
  ]

  useEffect(() => {
    if (!show) {
      setProgress(0)
      setCurrentStep(0)
      return
    }

    const startTime = Date.now()
    const targetDuration = 10000 // Fast ramp to 90% in 10s
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.min((elapsed / targetDuration) * 90, 95)
      setProgress(newProgress)

      if (newProgress < 25) setCurrentStep(0)
      else if (newProgress < 50) setCurrentStep(1)
      else if (newProgress < 75) setCurrentStep(2)
      else setCurrentStep(3)
    }, 100)

    return () => clearInterval(interval)
  }, [show])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-500">
      <div className="relative flex w-full max-w-sm flex-col items-center justify-center p-8 bg-white rounded-2xl shadow-2xl border border-slate-100">
        <div className="relative mb-6 flex h-20 w-20 items-center justify-center mt-2">
          <div className="absolute inset-0 animate-ping rounded-full bg-teal-100/60" />
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-teal-100 bg-white shadow-xl shadow-teal-500/30">
            <img src="/logo3_original-Photoroom.png" alt="Generating" className="w-full h-full object-cover animate-pulse" />
          </div>
        </div>

        <h3 className="mb-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-emerald-600">
          AI 正在规划新版本路线
        </h3>
        
        <p className="text-xs text-slate-500 mb-6 font-medium">深度定制可能需要十秒钟，请稍候...</p>

        <div className="mb-6 w-full px-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 mb-2">
            <div 
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }} 
            />
          </div>
          <div className="flex justify-between items-center text-[11px] px-0.5">
             <span className="text-teal-600 font-bold">{Math.round(progress)}%</span>
             <span className="text-slate-400 font-semibold">生成中...</span>
          </div>
        </div>

        <div className="space-y-3 w-full">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = index === currentStep
            const isDone = index < currentStep

            return (
              <div 
                key={index} 
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-300",
                  isActive ? "bg-teal-50/80 shadow-sm border border-teal-100/50" : "border border-transparent",
                  isDone ? "opacity-60" : index > currentStep ? "opacity-40" : ""
                )}
              >
                {isDone ? (
                   <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : isActive ? (
                   <Loader2 className="h-4 w-4 animate-spin text-teal-600 shrink-0" />
                ) : (
                   <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                )}
                <span className={cn(
                  "text-[13px] font-semibold transition-all", 
                  isActive ? "text-teal-800" : "text-slate-600"
                )}>
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
