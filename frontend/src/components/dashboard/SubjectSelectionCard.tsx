import { useState, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "@/components/ui/Icon"
import { SubjectIcon } from "@/components/ui/SubjectIcon"
import { useSubjectStore, type Subject } from "@/stores/subject"
import { useAuthStore } from "@/stores/auth"
import { SubjectOnboardingWizard } from "@/components/onboarding/SubjectOnboardingWizard"
import { cn } from "@/lib/utils"

/**
 * Dashboard 科目选择卡片组件
 * 展示所有可用科目，支持切换和开始学习
 */

type SubjectCategory = "coding" | "logic" | "memory"

function categorizeSubject(s: Subject): SubjectCategory {
    const name = s.name.toLowerCase()
    
    // 1. Coding / Practical
    if (["编程", "代码", "开发", "前端", "后端", "web", "ai", "机器", "智能", "算法", "数据", "sql", "云", "mindspore", "python", "java", "c++", "框架", "网络", "服务器", "架构", "工程"].some(k => name.includes(k))) return "coding"
    
    // 2. Logic / Thinking
    if (["数学", "math", "物理", "physics", "化学", "chemistry", "逻辑", "logic", "理科", "高数", "线代", "代数", "概率", "统计", "力学", "电磁"].some(k => name.includes(k))) return "logic"
    
    // 3. Humanities / Memory (Fallback or specific)
    return "memory" // 默认退化为文科/记忆类（语言、文学、历史、生物等）
}

const CATEGORY_META = {
    coding: { title: "工程实战", desc: "写代码与工程应用", icon: "solar:code-square-bold-duotone", color: "text-purple-500 text-purple-600 dark:text-purple-400" },
    logic: { title: "数理逻辑", desc: "偏思维的高难度学科", icon: "solar:lightbulb-bolt-bold-duotone", color: "text-blue-500 text-blue-600 dark:text-blue-400" },
    memory: { title: "人文记忆", desc: "注重记忆的文科", icon: "solar:book-bookmark-bold-duotone", color: "text-orange-500 text-orange-600 dark:text-orange-400" }
}

export function SubjectSelectionCard() {
    const navigate = useNavigate()
    const userId = useAuthStore((s) => s.profile?.user_id)

    const subjects = useSubjectStore((s) => s.subjects)
    const currentSubjectId = useSubjectStore((s) => s.currentSubjectId)
    const isLoading = useSubjectStore((s) => s.isLoading)
    const fetchSubjects = useSubjectStore((s) => s.fetchSubjects)
    const switchSubject = useSubjectStore((s) => s.switchSubject)

    const [showOnboarding, setShowOnboarding] = useState(false)
    const [onboardingSubject, setOnboardingSubject] = useState<Subject | null>(null)
    const [switchingId, setSwitchingId] = useState<string | null>(null)

    // 获取科目列表
    useEffect(() => {
        if (userId) {
            fetchSubjects()
        }
    }, [userId, fetchSubjects])

    const handleSubjectClick = useCallback(async (subject: Subject) => {
        if (switchingId) return

        // 如果点击的是当前科目
        if (subject.id === currentSubjectId) {
            // 如果已完成 onboarding，跳转到科目详情页
            if (subject.onboarding_status === "completed") {
                navigate(`/app/subject/${subject.id}`)
            } else {
                // 否则打开 onboarding
                setOnboardingSubject(subject)
                setShowOnboarding(true)
            }
            return
        }

        // 切换到新科目
        setSwitchingId(subject.id)
        const success = await switchSubject(subject.id)
        setSwitchingId(null)

        if (success) {
            // 如果新科目需要 onboarding
            if (subject.onboarding_status !== "completed") {
                setOnboardingSubject(subject)
                setShowOnboarding(true)
            } else {
                // 已完成 onboarding，跳转到科目详情页
                navigate(`/app/subject/${subject.id}`)
            }
        }
    }, [currentSubjectId, switchSubject, navigate, switchingId])

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
    }, [fetchSubjects, navigate, onboardingSubject?.id, currentSubjectId])

    const handleOnboardingCancel = useCallback(() => {
        setShowOnboarding(false)
        setOnboardingSubject(null)
    }, [])

    if (isLoading && subjects.length === 0) {
        return (
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-soft">
                <div className="flex items-center justify-center py-8">
                    <Icon icon="solar:spinner-bold-duotone" className="w-8 h-8 animate-spin text-primary" />
                    <span className="ml-2 text-slate-500 font-medium">加载科目中...</span>
                </div>
            </div>
        )
    }

    if (subjects.length === 0) {
        return null
    }

    const currentSubject = subjects.find(s => s.id === currentSubjectId)
    
    // 排列：已经开始学习的放前面，未开始的放后面
    const sortedSubjects = [...subjects].sort((a, b) => {
        const aStarted = a.onboarding_status === "completed" || a.onboarding_status === "in_progress"
        const bStarted = b.onboarding_status === "completed" || b.onboarding_status === "in_progress"
        if (aStarted && !bStarted) return -1
        if (!aStarted && bStarted) return 1
        return 0
    })

    const groupedSubjects = {
        coding: sortedSubjects.filter(s => categorizeSubject(s) === "coding"),
        logic: sortedSubjects.filter(s => categorizeSubject(s) === "logic"),
        memory: sortedSubjects.filter(s => categorizeSubject(s) === "memory"),
    }

    return (
        <>
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-soft">
                {/* 标题区域 */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
                            <Icon icon="solar:book-bookmark-bold-duotone" className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white">选择学习科目</h3>
                            <p className="text-xs text-slate-500">
                                {currentSubject
                                    ? `当前：${currentSubject.name}`
                                    : "请选择一个科目开始学习"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {(["coding", "logic", "memory"] as const).map(catKey => {
                        const items = groupedSubjects[catKey]
                        if (items.length === 0) return null
                        const meta = CATEGORY_META[catKey]

                        return (
                            <div key={catKey}>
                                <div className="flex items-center gap-2 mb-3 px-1">
                                    <Icon icon={meta.icon} className={cn("w-4 h-4", meta.color)} />
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 font-display">{meta.title}</h4>
                                    <span className="text-xs text-slate-400 font-medium">· {meta.desc}</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {items.map((subject) => {
                                        const isSelected = subject.id === currentSubjectId
                                        const isCompleted = subject.onboarding_status === "completed"
                                        const isSwitching = switchingId === subject.id

                                        return (
                                            <button
                                                key={subject.id}
                                                onClick={() => handleSubjectClick(subject)}
                                                disabled={isSwitching}
                                                className={cn(
                                                    "relative flex flex-col items-center p-4 rounded-2xl transition-all duration-300 group",
                                                    "hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 active:scale-95",
                                                    isSelected
                                                        ? "bg-gradient-to-br from-primary/10 to-transparent shadow-sm ring-1 ring-primary/30"
                                                        : "bg-white/70 backdrop-blur-md dark:bg-slate-800 border border-white dark:border-slate-700/50 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:border-primary/20",
                                                    isSwitching && "opacity-70 pointer-events-none"
                                                )}
                                            >
                                                {/* 选中标记 */}
                                                {isSelected && (
                                                    <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                                                        <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 text-white" />
                                                    </div>
                                                )}

                                                {/* 加载指示器 */}
                                                {isSwitching && (
                                                    <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 rounded-2xl flex items-center justify-center">
                                                        <Icon icon="solar:spinner-bold-duotone" className="w-6 h-6 animate-spin text-primary" />
                                                    </div>
                                                )}

                                                {/* 科目图标 */}
                                                <div className={cn(
                                                    "mb-3 transition-transform group-hover:scale-110",
                                                    isSelected && "animate-pulse-slow"
                                                )}>
                                                    <SubjectIcon subject={subject} className="w-10 h-10" />
                                                </div>

                                                {/* 科目名称 */}
                                                <span className={cn(
                                                    "text-sm font-bold truncate w-full text-center tracking-wide font-display",
                                                    isSelected ? "text-primary" : "text-slate-700 dark:text-slate-300"
                                                )}>
                                                    {subject.name}
                                                </span>

                                                {/* 状态/进度 */}
                                                {isCompleted ? (
                                                    <div className="mt-2 w-full">
                                                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-primary rounded-full transition-all duration-500"
                                                                style={{ width: `${Math.min(subject.progress_percent, 100)}%` }}
                                                            />
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-center gap-1 font-mono">
                                                            <Icon icon="solar:chart-up-bold-duotone" className="w-3.5 h-3.5 text-primary" />
                                                            {subject.progress_percent.toFixed(0)}%
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <span className={cn(
                                                        "mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full",
                                                        subject.onboarding_status === "in_progress"
                                                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                            : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                                                    )}>
                                                        {subject.onboarding_status === "in_progress" ? "学习中" : "未开始"}
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* 提示信息 */}
                {!currentSubject && (
                    <div className="mt-4 p-4 bg-primary/10 rounded-2xl border border-primary/20 flex items-center gap-3">
                        <Icon icon="solar:magic-stick-3-bold-duotone" className="w-6 h-6 text-primary flex-shrink-0" />
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            <span className="font-semibold">提示：</span>
                            选择一个科目并完成入门评估，即可解锁 AI 学习路线和题库练习功能
                        </p>
                    </div>
                )}
            </div>

            {/* Onboarding 向导 */}
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
