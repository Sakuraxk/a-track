import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { SubjectOnboardingWizard } from "@/components/onboarding/SubjectOnboardingWizard"
import { Icon } from "@/components/ui/Icon"
import { SubjectIcon } from "@/components/ui/SubjectIcon"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth"
import { useSubjectStore, type Subject } from "@/stores/subject"

type SubjectCategory = "coding" | "logic" | "memory"

function categorizeSubject(subject: Subject): SubjectCategory {
  const name = subject.name.toLowerCase()

  // AI通识与AI素养 is a general-education course, not engineering
  if (subject.key === "ai_literacy" || name.includes("通识") || name.includes("素养")) {
    return "memory"
  }

  if (["编程", "代码", "开发", "前端", "后端", "web", "ai", "机器", "智能", "算法", "数据", "sql", "云", "python", "java", "c++", "框架", "网络", "服务器", "架构", "工程"].some((keyword) => name.includes(keyword))) {
    return "coding"
  }

  if (["数学", "math", "物理", "physics", "化学", "chemistry", "逻辑", "logic", "理科", "高数", "线代", "代数", "概率", "统计", "力学", "电磁"].some((keyword) => name.includes(keyword))) {
    return "logic"
  }

  return "memory"
}

const CATEGORY_META = {
  coding: {
    title: "工程实战",
    description: "适合需要代码、模型和工程实践的学科",
    icon: "solar:code-square-bold-duotone",
    tint: "text-[oklch(45%_0.09_220)]",
    surface: "border-[oklch(89%_0.018_220)] bg-[linear-gradient(135deg,oklch(98%_0.01_220),oklch(99%_0.006_220))]",
  },
  logic: {
    title: "数理逻辑",
    description: "适合结构化推导与抽象思维更强的学科",
    icon: "solar:lightbulb-bolt-bold-duotone",
    tint: "text-[oklch(53%_0.11_80)]",
    surface: "border-[oklch(89%_0.02_80)] bg-[linear-gradient(135deg,oklch(98.8%_0.008_80),oklch(99%_0.006_80))]",
  },
  memory: {
    title: "人文记忆",
    description: "适合语言、文学与记忆型知识结构的学科",
    icon: "solar:book-bookmark-bold-duotone",
    tint: "text-[oklch(47%_0.09_165)]",
    surface: "border-[oklch(90%_0.02_165)] bg-[linear-gradient(135deg,oklch(98%_0.012_165),oklch(99%_0.008_165))]",
  },
} satisfies Record<SubjectCategory, {
  title: string
  description: string
  icon: string
  tint: string
  surface: string
}>

export default function SubjectSwitch() {
  const navigate = useNavigate()
  const userId = useAuthStore((state) => state.profile?.user_id)

  const subjects = useSubjectStore((state) => state.subjects)
  const currentSubjectId = useSubjectStore((state) => state.currentSubjectId)
  const isLoading = useSubjectStore((state) => state.isLoading)
  const fetchSubjects = useSubjectStore((state) => state.fetchSubjects)
  const switchSubject = useSubjectStore((state) => state.switchSubject)

  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingSubject, setOnboardingSubject] = useState<Subject | null>(null)
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  useEffect(() => {
    if (userId) {
      void fetchSubjects()
    }
  }, [fetchSubjects, userId])

  const currentSubject = useMemo(
    () => subjects.find((subject) => subject.id === currentSubjectId) || null,
    [currentSubjectId, subjects]
  )

  const sortedSubjects = useMemo(() => {
    return [...subjects].sort((a, b) => {
      const aStarted = a.onboarding_status === "completed" || a.onboarding_status === "in_progress"
      const bStarted = b.onboarding_status === "completed" || b.onboarding_status === "in_progress"
      if (aStarted && !bStarted) return -1
      if (!aStarted && bStarted) return 1
      return 0
    })
  }, [subjects])

  const groupedSubjects = useMemo(
    () => ({
      coding: sortedSubjects.filter((subject) => categorizeSubject(subject) === "coding"),
      logic: sortedSubjects.filter((subject) => categorizeSubject(subject) === "logic"),
      memory: sortedSubjects.filter((subject) => categorizeSubject(subject) === "memory"),
    }),
    [sortedSubjects]
  )

  const handleSubjectClick = useCallback(async (subject: Subject) => {
    if (switchingId) return

    if (subject.id === currentSubjectId) {
      if (subject.onboarding_status === "completed") {
        navigate(`/app/subject/${subject.id}`)
      } else {
        setOnboardingSubject(subject)
        setShowOnboarding(true)
      }
      return
    }

    setSwitchingId(subject.id)
    const success = await switchSubject(subject.id)
    setSwitchingId(null)

    if (!success) return

    if (subject.onboarding_status !== "completed") {
      setOnboardingSubject(subject)
      setShowOnboarding(true)
      return
    }

    navigate(`/app/subject/${subject.id}`)
  }, [currentSubjectId, navigate, switchSubject, switchingId])

  const handleOnboardingComplete = useCallback(async () => {
    setShowOnboarding(false)
    const targetSubjectId = onboardingSubject?.id || currentSubjectId
    setOnboardingSubject(null)
    // Mark as completed in global store so SubjectGate won't re-gate
    if (targetSubjectId) {
      useSubjectStore.getState().markOnboardingComplete(targetSubjectId)
    }
    // Wait for fresh data before navigating
    await fetchSubjects()
    if (targetSubjectId) {
      navigate(`/app/subject/${targetSubjectId}`)
    }
  }, [currentSubjectId, fetchSubjects, navigate, onboardingSubject?.id])

  const handleOnboardingCancel = useCallback(() => {
    setShowOnboarding(false)
    setOnboardingSubject(null)
  }, [])

  return (
    <>
      <div className="space-y-8 p-6 pb-20 lg:p-10">
        <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(91%_0.05_165_/_0.18),transparent_30%),radial-gradient(circle_at_top_right,oklch(92%_0.04_220_/_0.14),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.98))]" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[oklch(89%_0.018_220)] bg-[linear-gradient(135deg,oklch(98%_0.01_220),oklch(99%_0.006_220))] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.26em] text-[oklch(45%_0.09_220)]">
                <Icon icon="solar:book-bookmark-bold-duotone" className="h-4 w-4" />
                学科切换
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-5xl">
                  欢迎来到学科切换页，
                  <br />
                  今天想学习哪门科目呢？
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                  这里是完整的学科切换页。详细选择、切换与继续进入学科详情都在这里完成。
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,white,oklch(99%_0.004_210))] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">当前学科</p>
              {currentSubject ? (
                <div className="mt-4 flex items-center gap-4 rounded-2xl border border-[oklch(90%_0.02_165)] bg-[linear-gradient(135deg,oklch(98%_0.012_165),oklch(99%_0.008_165))] p-4">
                  <SubjectIcon subject={currentSubject} className="h-14 w-14" />
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-slate-900">{currentSubject.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {currentSubject.onboarding_status === "completed"
                        ? `已完成入门评估 · 进度 ${currentSubject.progress_percent.toFixed(0)}%`
                        : currentSubject.onboarding_status === "in_progress"
                          ? "已开始学习，尚未完成入门评估"
                          : "尚未开始学习"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500">
                  当前还没有激活学科，请从下方选择一个学科开始。
                </div>
              )}
            </div>
          </div>
        </section>

        {isLoading && subjects.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
            <Icon icon="solar:spinner-bold-duotone" className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm font-medium text-slate-500">加载学科中...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {(["coding", "logic", "memory"] as const).map((categoryKey) => {
              const items = groupedSubjects[categoryKey]
              if (items.length === 0) return null

              const meta = CATEGORY_META[categoryKey]

              return (
                <section
                  key={categoryKey}
                  className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]"
                >
                  <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", meta.surface)}>
                        <Icon icon={meta.icon} className={cn("h-5 w-5", meta.tint)} />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{meta.title}</h2>
                        <p className="text-sm text-slate-500">{meta.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((subject) => {
                      const isCurrent = subject.id === currentSubjectId
                      const isSwitching = switchingId === subject.id

                      return (
                        <button
                          key={subject.id}
                          type="button"
                          disabled={isSwitching}
                          onClick={() => handleSubjectClick(subject)}
                          className={cn(
                            "relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300",
                            "hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]",
                            isCurrent
                              ? "border-primary/30 bg-[linear-gradient(135deg,oklch(98%_0.012_165),oklch(99%_0.008_220))]"
                              : "border-slate-200/80 bg-slate-50/75 hover:border-slate-300"
                          )}
                        >
                          {isSwitching && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
                              <Icon icon="solar:spinner-bold-duotone" className="h-6 w-6 animate-spin text-primary" />
                            </div>
                          )}

                            <div className="flex items-start gap-4">
                              <SubjectIcon subject={subject} className="h-14 w-14 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className={cn("line-clamp-2 text-base font-semibold", isCurrent ? "text-primary" : "text-slate-900")}>
                                      {subject.name}
                                    </p>
                                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{subject.description}</p>
                                  </div>
                                  {isCurrent && (
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-md">
                                      <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4" />
                                    </div>
                                  )}
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-[11px] font-medium",
                                    subject.onboarding_status === "completed"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : subject.onboarding_status === "in_progress"
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-slate-100 text-slate-500"
                                  )}
                                >
                                  {subject.onboarding_status === "completed"
                                    ? (subject.progress_percent >= 100 ? "已完成" : "学习中")
                                    : subject.onboarding_status === "in_progress"
                                      ? "评估中"
                                      : "未开始"}
                                </span>
                                {subject.onboarding_status === "completed" && (
                                  <span className="rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                                    进度 {subject.progress_percent.toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

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
    </>
  )
}
