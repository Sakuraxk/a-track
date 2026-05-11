import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { SubjectIcon } from "@/components/ui/SubjectIcon"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { OnboardingStepIndicator } from "./OnboardingStepIndicator"
import {
  ArrowRight,
  BookOpen,
  Brain,
  ChevronLeft,
  Lightbulb,
  Loader2,
  Sparkles,
  Target,
  Trophy,
  SkipForward,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import { useSubjectStore } from "@/stores/subject"

type WizardStep = 1 | 2 | 3 | 4
type ProficiencyLevel = "beginner" | "intermediate" | "advanced"

interface DiagnosticQuestion {
  id: string
  question: string
  options: string[]
  difficulty: number
}

interface StartAssessmentResponse {
  session_id: string
  subject_name: string
  questions: DiagnosticQuestion[]
}

interface CompleteAssessmentResponse {
  success: boolean
  assessed_level: string
  learning_path_summary: {
    title: string
    level: string
    estimated_weeks: number
    total_nodes: number
    first_chapter: string
    goals: string[]
  }
}

const GOALS = [
  { id: "basics", label: "掌握基础知识", icon: BookOpen },
  { id: "career", label: "提升职业技能", icon: Trophy },
  { id: "exam", label: "备考认证考试", icon: Target },
  { id: "fun", label: "兴趣爱好学习", icon: Sparkles },
]

interface SubjectOnboardingWizardProps {
  subjectId: string
  subjectName: string
  subjectIcon: string
  /** Optional subject key for rendering the proper SubjectIcon */
  subjectKey?: string
  onComplete: () => void
  onCancel: () => void
}

export function SubjectOnboardingWizard({
  subjectId,
  subjectName,
  subjectIcon,
  subjectKey,
  onComplete,
  onCancel,
}: SubjectOnboardingWizardProps) {
  const userId = useAuthStore((s) => s.profile?.user_id)
  const fetchSubjects = useSubjectStore((s) => s.fetchSubjects)
  const markOnboardingComplete = useSubjectStore((s) => s.markOnboardingComplete)

  const [step, setStep] = useState<WizardStep>(1)
  const [level, setLevel] = useState<ProficiencyLevel>("beginner")
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])

  // Assessment state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([])
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [, setIsGenerating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSkipping, setIsSkipping] = useState(false)

  // Lock body scroll when modal is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  const handleNext = async () => {
    if (step === 1) {
      // Start assessment when moving from step 1 to step 2
      setStep(2)
      return
    }

    if (step === 2) {
      // Start diagnostic test
      if (!userId) return
      setErrorMessage(null)
      try {
        const { data } = await api.post<StartAssessmentResponse>("/api/assessment/start", {
          subject_id: subjectId,
          user_id: userId,
          self_reported_level: level,
        })
        setSessionId(data.session_id)
        setQuestions(data.questions)
        setCurrentQuestionIdx(0)
        setStep(3)
      } catch (error) {
        console.error("Failed to start assessment:", error)
        setErrorMessage("启动测试失败，请重试")
      }
      return
    }

    if (step === 3) {
      // Handle diagnostic question answer - auto-advance handled in handleAnswerSelect
      return
    }
  }

  const handleAnswerSelect = async (answerIndex: number) => {
    if (!sessionId) return
    const question = questions[currentQuestionIdx]
    if (!question) return
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await api.post("/api/assessment/answer", {
        session_id: sessionId,
        question_id: question.id,
        answer: String(answerIndex),
      })

      if (currentQuestionIdx < questions.length - 1) {
        setCurrentQuestionIdx((prev) => prev + 1)
      } else {
        setStep(4)
      }
    } catch (error) {
      console.error("Failed to submit answer:", error)
      setErrorMessage("提交答案失败，请重试")
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const handleBack = () => {
    // Allow going back during diagnostic, it just returns to step 2
    if (step > 1) {
      setStep((prev) => Math.max(prev - 1, 1) as WizardStep)
    }
  }

  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    )
  }

  const handleSkip = async () => {
    if (!userId || isSkipping) return
    setIsSkipping(true)
    setErrorMessage(null)
    try {
      await api.post("/api/assessment/skip", {
        subject_id: subjectId,
        user_id: userId,
        self_reported_level: level,
      })
      await fetchSubjects()
      markOnboardingComplete(subjectId)
      onComplete()
    } catch (error) {
      console.error("Failed to skip assessment:", error)
      setErrorMessage("跳过失败，请重试")
    } finally {
      setIsSkipping(false)
    }
  }

  // Complete assessment when entering step 4
  useEffect(() => {
    if (step === 4 && sessionId && userId) {
      setIsGenerating(true)
      setErrorMessage(null)
      const completeAssessment = async () => {
        try {
          await api.post<CompleteAssessmentResponse>("/api/assessment/complete", {
            session_id: sessionId,
            user_id: userId,
            learning_goals: selectedGoals,
          })
          // Refresh subjects to get updated onboarding status
          await fetchSubjects()
          // Mark as completed in global store
          markOnboardingComplete(subjectId)
          // Directly complete — no need for a summary step
          onComplete()
        } catch (error) {
          console.error("Failed to complete assessment:", error)
          setErrorMessage("生成学习路径失败，请重试")
          // Stay on step 4 but show error
        } finally {
          setIsGenerating(false)
        }
      }

      // Add a small delay for UX
      const timer = setTimeout(completeAssessment, 1500)
      return () => clearTimeout(timer)
    }
  }, [step, sessionId, userId, selectedGoals, fetchSubjects, onComplete])

  const renderStep1_SelfAssessment = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="text-center space-y-2">
        <div className="mb-4">
          <SubjectIcon
            subject={{ id: subjectId, key: subjectKey || '', name: subjectName, icon: subjectIcon, description: '', onboarding_status: 'not_started', progress_percent: 0, mastered_nodes: 0, total_nodes: 0 }}
            className="w-16 h-16 mx-auto"
          />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">你对 {subjectName} 了解多少？</h2>
        <p className="text-slate-500">我们会根据你的水平调整学习内容</p>
      </div>

      <RadioGroup
        value={level}
        onValueChange={(v) => setLevel(v as ProficiencyLevel)}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {[
          { value: "beginner", title: "初学者", desc: "我是新手", icon: BookOpen },
          { value: "intermediate", title: "中级", desc: "我了解基础", icon: Lightbulb },
          { value: "advanced", title: "高级", desc: "我已经很熟练", icon: Brain },
        ].map((option) => (
          <div key={option.value} onClick={() => setLevel(option.value as ProficiencyLevel)}>
            <RadioGroupItem value={option.value} id={`onboarding-level-${option.value}`} className="peer sr-only" />
            <Label
              htmlFor={`onboarding-level-${option.value}`}
              className={cn(
                "flex flex-col items-center justify-between rounded-xl border-2 border-slate-200 bg-white p-4 hover:bg-slate-50 cursor-pointer transition-all h-full",
                level === option.value && "border-primary bg-primary/5 ring-2 ring-primary/20"
              )}
            >
              <option.icon className="mb-3 h-8 w-8 text-primary" />
              <div className="text-center space-y-1">
                <div className="font-bold">{option.title}</div>
                <div className="text-xs text-slate-500">{option.desc}</div>
              </div>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  )

  const renderStep2_Goals = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">你的学习目标是什么？</h2>
        <p className="text-slate-500">可以选择多个目标</p>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {GOALS.map((goal) => (
          <div
            key={goal.id}
            className={cn(
              "flex items-center space-x-4 rounded-xl border p-4 transition-all cursor-pointer hover:bg-slate-50",
              selectedGoals.includes(goal.id) ? "border-primary bg-primary/5" : "border-slate-200"
            )}
            onClick={() => toggleGoal(goal.id)}
          >
            <Checkbox
              checked={selectedGoals.includes(goal.id)}
              onCheckedChange={() => { }}
              onClick={(e) => e.stopPropagation()}
              className="h-5 w-5 pointer-events-none"
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <goal.icon className="h-4 w-4 text-primary" />
                {goal.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderStep3_Diagnostic = () => {
    const question = questions[currentQuestionIdx]
    if (!question) return null

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">快速测试</h2>
          <p className="text-slate-500">
            第 {currentQuestionIdx + 1} 题，共 {questions.length} 题
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-lg">{question.question}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {question.options.map((opt, idx) => (
              <Button
                key={idx}
                variant="outline"
                disabled={isSubmitting}
                className="w-full justify-start text-left h-auto py-3 px-4 hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:pointer-events-none"
                onClick={() => handleAnswerSelect(idx)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                    {String.fromCharCode(65 + idx)}
                  </div>
                  {opt}
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderStep4_Loading = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-8 animate-in fade-in zoom-in duration-700">
      {errorMessage ? (
        <>
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <span className="text-2xl">⚠️</span>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold text-red-600">{errorMessage}</h3>
            <p className="text-slate-500 max-w-xs mx-auto">
              请检查网络连接后重试，或跳过评估直接开始学习
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setStep(3)} variant="outline">
              返回重试
            </Button>
            <Button onClick={handleSkip} disabled={isSkipping}>
              {isSkipping ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <SkipForward className="h-4 w-4 mr-2" />
              )}
              跳过评估，开始学习
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            <div className="relative rounded-full bg-primary/10 p-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold">正在生成学习路径...</h3>
            <p className="text-slate-500 max-w-xs mx-auto">
              AI 正在根据你的目标和水平，为你定制专属学习计划
            </p>
          </div>
        </>
      )}
    </div>
  )



  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-xl min-h-[400px] max-h-[90vh] flex flex-col shadow-xl border-t-4 border-t-primary bg-background">
        <CardHeader className="pb-2 shrink-0">
          <OnboardingStepIndicator currentStep={step} totalSteps={4} />
        </CardHeader>

        <CardContent className="flex-1 py-6 overflow-y-auto">
          {step === 1 && renderStep1_SelfAssessment()}
          {step === 2 && renderStep2_Goals()}
          {step === 3 && renderStep3_Diagnostic()}
          {step === 4 && renderStep4_Loading()}
        </CardContent>

        {step < 4 && (
          <CardFooter className="flex justify-between border-t p-6 bg-slate-50/50">
            <Button
              variant="ghost"
              onClick={step === 1 ? onCancel : handleBack}
              className="gap-2"
              disabled={isSubmitting || isSkipping}
            >
              <ChevronLeft className="h-4 w-4" /> {step === 1 ? "取消" : "返回"}
            </Button>

            <div className="flex gap-2">
              {/* 跳过按钮 - 在第1步和第2步显示 */}
              {(step === 1 || step === 2) && (
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  className="gap-2"
                  disabled={isSkipping}
                >
                  {isSkipping ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SkipForward className="h-4 w-4" />
                  )}
                  跳过评估
                </Button>
              )}

              {step !== 3 && (
                <Button
                  onClick={handleNext}
                  className="gap-2 min-w-[120px]"
                  disabled={(step === 2 && selectedGoals.length === 0) || isSkipping}
                >
                  {step === 2 ? "开始测试" : "继续"} <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardFooter>
        )}
      </Card>
    </div>,
    document.body
  )
}
