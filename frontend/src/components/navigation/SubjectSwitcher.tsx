import { useEffect, useState, useCallback } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useSubjectStore, type Subject, type OnboardingStatus } from "@/stores/subject"
import { useAuthStore } from "@/stores/auth"
import { SubjectIcon } from "@/components/ui/SubjectIcon"
import { Icon } from "@/components/ui/Icon"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { SubjectOnboardingWizard } from "@/components/onboarding/SubjectOnboardingWizard"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<OnboardingStatus, string> = {
  not_started: "未开始",
  in_progress: "学习中",
  completed: "已完成",
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function SubjectSwitcher() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentSubjectId = useSubjectStore((s) => s.currentSubjectId)
  const subjects = useSubjectStore((s) => s.subjects)
  const isLoading = useSubjectStore((s) => s.isLoading)
  const needsOnboarding = useSubjectStore((s) => s.needsOnboarding)
  const fetchSubjects = useSubjectStore((s) => s.fetchSubjects)
  const switchSubject = useSubjectStore((s) => s.switchSubject)

  const userId = useAuthStore((s) => s.profile?.user_id)
  const [isOpen, setIsOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingSubject, setOnboardingSubject] = useState<Subject | null>(null)

  useEffect(() => {
    if (userId) {
      fetchSubjects()
    }
  }, [userId, fetchSubjects])

  // Show onboarding when needsOnboarding flag is set after switch
  useEffect(() => {
    if (needsOnboarding && currentSubjectId) {
      const subject = subjects.find((s) => s.id === currentSubjectId)
      if (subject && subject.onboarding_status !== "completed") {
        setOnboardingSubject(subject)
        setShowOnboarding(true)
      }
    }
  }, [needsOnboarding, currentSubjectId, subjects])

  const currentSubject = subjects.find((s) => s.id === currentSubjectId)
  const displaySubject = currentSubject || subjects[0]

  const handleSwitch = useCallback(
    async (subject: Subject) => {
      if (subject.id === currentSubjectId) {
        setIsOpen(false)
        return
      }
      const success = await switchSubject(subject.id)
      if (success) {
        setIsOpen(false)
        // Check if this subject needs onboarding
        if (subject.onboarding_status !== "completed") {
          setOnboardingSubject(subject)
          setShowOnboarding(true)
        } else {
          // If already completed onboarding, handle navigation
          // If we are on a subject-specific page, redirect to the new subject's page
          if (location.pathname.startsWith('/app/subject/')) {
            navigate(`/app/subject/${subject.id}`)
          }
        }
      }
    },
    [currentSubjectId, switchSubject, location.pathname, navigate]
  )

  const handleOnboardingComplete = async () => {
    const targetSubjectId = onboardingSubject?.id || currentSubjectId
    setShowOnboarding(false)
    setOnboardingSubject(null)
    // Mark as completed in global store so SubjectGate won't re-gate
    if (targetSubjectId) {
      useSubjectStore.getState().markOnboardingComplete(targetSubjectId)
    }
    // Wait for fresh data before navigating
    await fetchSubjects()

    // After onboarding, navigate to the subject detail page
    if (targetSubjectId) {
      navigate(`/app/subject/${targetSubjectId}`)
    }
  }

  const handleOnboardingCancel = () => {
    setShowOnboarding(false)
    setOnboardingSubject(null)
  }

  if (!displaySubject && !isLoading) {
    return null
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-12 gap-2 rounded-xl border-2 border-transparent hover:bg-slate-100 hover:border-slate-200 data-[state=open]:bg-slate-100 px-3 transition-all"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : (
            <>
              <SubjectIcon 
                subject={displaySubject} 
                className="h-7 w-7 transition-transform group-hover:scale-110"
                showBackground={false}
              />
              <span className="font-bold text-slate-700 hidden md:inline-block max-w-[360px] truncate ml-1 font-display tracking-wide">
                {displaySubject?.name || "选择学科"}
              </span>
              <Icon icon="solar:alt-arrow-down-bold-duotone"
                className={cn(
                  "h-4 w-4 text-slate-400 transition-transform duration-300 ml-1",
                  isOpen && "rotate-180"
                )}
              />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-80 p-2 shadow-xl border-slate-100 mt-2 rounded-2xl">
        <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          我的课程
        </div>

        {/* Scrollable subject list */}
        <div
          className="max-h-[360px] overflow-y-auto pr-1"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(148,163,184,0.3) transparent',
          }}
        >
          {subjects.map((subject) => {
            const progressPercent = clamp(subject.progress_percent ?? 0, 0, 100)
            return (
              <DropdownMenuItem
                key={subject.id}
                onSelect={(e) => {
                  e.preventDefault()
                  handleSwitch(subject)
                }}
                className={cn(
                  "group flex items-center gap-4 rounded-xl p-3 cursor-pointer mb-1",
                  currentSubjectId === subject.id
                    ? "bg-primary/5 hover:bg-primary/10 border border-primary/20"
                    : "hover:bg-slate-50 border border-transparent"
                )}
              >
                {/* Icon Box */}
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl shadow-sm border transition-all duration-300 group-hover:scale-105 flex-shrink-0 group-hover:shadow",
                    currentSubjectId === subject.id
                      ? "bg-primary/10 border-primary/20"
                      : "bg-white border-transparent"
                  )}
                >
                  <SubjectIcon subject={subject} className="w-7 h-7" showBackground={false} />
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col gap-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "font-bold text-sm truncate font-display",
                        currentSubjectId === subject.id ? "text-primary" : "text-slate-700 group-hover:text-primary transition-colors"
                      )}
                    >
                      {subject.name}
                    </span>
                    {currentSubjectId === subject.id && <Icon icon="solar:check-circle-bold-duotone" className="h-5 w-5 text-primary flex-shrink-0" />}
                  </div>

                  {/* Progress or Badge */}
                  {subject.onboarding_status === "completed" ? (
                    <div className="space-y-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <p className="text-[10px] font-bold text-slate-400">
                        已掌握 {subject.mastered_nodes} / {subject.total_nodes} 个知识点
                      </p>
                    </div>
                  ) : (
                    <span
                      className={cn(
                        "inline-flex w-fit items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                        subject.onboarding_status === "in_progress"
                          ? "bg-yellow-50 text-yellow-700 ring-yellow-600/20"
                          : "bg-slate-50 text-slate-600 ring-slate-500/10"
                      )}
                    >
                      {STATUS_LABELS[subject.onboarding_status]}
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
            )
          })}
        </div>

        <DropdownMenuSeparator className="my-2" />

        <div className="px-3 py-2 text-xs text-slate-400 text-center">
          更多学科即将上线
        </div>
      </DropdownMenuContent>

      {showOnboarding && onboardingSubject && (
        <SubjectOnboardingWizard
          subjectId={onboardingSubject.id}
          subjectName={onboardingSubject.name}
          subjectIcon={onboardingSubject.icon}
          subjectKey={onboardingSubject.key}
          onComplete={handleOnboardingComplete}
          onCancel={handleOnboardingCancel}
        />
      )}
    </DropdownMenu>
  )
}
