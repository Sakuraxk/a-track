import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Circle } from "lucide-react"

interface OnboardingStepIndicatorProps {
  currentStep: number
  totalSteps: number
}

export function OnboardingStepIndicator({ currentStep, totalSteps }: OnboardingStepIndicatorProps) {
  const progressPercentage = (currentStep / totalSteps) * 100

  return (
    <div className="w-full max-w-md mx-auto mb-8 space-y-2">
      <div className="flex justify-between items-center text-sm font-medium text-slate-500 mb-2">
        <span>设置进度</span>
        <span>
          第 {currentStep} 步，共 {totalSteps} 步
        </span>
      </div>
      <Progress value={progressPercentage} className="h-2 transition-all duration-500 ease-in-out" />

      <div className="flex justify-between px-1 pt-2">
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const stepNum = idx + 1
          const isCompleted = stepNum < currentStep
          const isCurrent = stepNum === currentStep

          return (
            <div key={idx} className="flex flex-col items-center gap-1">
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4 text-primary transition-all duration-300" />
              ) : isCurrent ? (
                <div className="h-4 w-4 rounded-full border-2 border-primary bg-background transition-all duration-300" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
