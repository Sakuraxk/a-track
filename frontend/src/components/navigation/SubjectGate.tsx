import { useNavigate } from "react-router-dom"
import { BookOpen, ArrowRight, Sparkles, AlertCircle, SkipForward, Loader2 } from "lucide-react"
import { useSubjectStore, type Subject } from "@/stores/subject"
import { useAuthStore } from "@/stores/auth"
import { Button } from "@/components/ui/button"
import { SubjectOnboardingWizard } from "@/components/onboarding/SubjectOnboardingWizard"
import { useState } from "react"
import { api } from "@/lib/api"

interface SubjectGateProps {
    children: React.ReactNode
    featureName?: string // e.g. "AI 学习路线", "题库练习"
}

/**
 * 科目门控组件
 * 用于包裹需要选择科目才能访问的页面
 * 未选择科目或未完成 onboarding 时显示提示
 */
export function SubjectGate({ children, featureName = "此功能" }: SubjectGateProps) {
    const navigate = useNavigate()
    const currentSubjectId = useSubjectStore((s) => s.currentSubjectId)
    const subjects = useSubjectStore((s) => s.subjects)
    const isLoading = useSubjectStore((s) => s.isLoading)
    const getCurrentSubject = useSubjectStore((s) => s.getCurrentSubject)
    const completedSubjectIds = useSubjectStore((s) => s.completedSubjectIds)
    const markOnboardingComplete = useSubjectStore((s) => s.markOnboardingComplete)

    const [showOnboarding, setShowOnboarding] = useState(false)

    const currentSubject = getCurrentSubject()

    // Check if this subject was just completed/skipped in this session (global state)
    const justCompleted = currentSubject ? completedSubjectIds.has(currentSubject.id) : false

    // 加载中
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    // 没有科目数据
    if (subjects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
                <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                    暂无可用科目
                </h2>
                <p className="text-slate-500 text-center max-w-md">
                    当前没有可用的学习科目，请联系管理员或稍后再试。
                </p>
            </div>
        )
    }

    // 未选择科目
    if (!currentSubjectId || !currentSubject) {
        return (
            <SelectSubjectPrompt
                featureName={featureName}
                onNavigate={() => navigate("/app/dashboard")}
            />
        )
    }

    // 科目未完成 onboarding（但如果刚刚完成/跳过了，直接放行）
    if (currentSubject.onboarding_status !== "completed" && !justCompleted) {
        return (
            <>
                <CompleteOnboardingPrompt
                    subject={currentSubject}
                    featureName={featureName}
                    onStartOnboarding={() => setShowOnboarding(true)}
                    onNavigate={() => navigate("/app/dashboard")}
                    onSkip={async () => {
                        try {
                            const userId = useAuthStore.getState().profile?.user_id
                            if (userId) {
                                await api.post("/api/assessment/skip", {
                                    subject_id: currentSubject.id,
                                    user_id: userId,
                                    self_reported_level: "beginner",
                                })
                            }
                        } catch { /* skip API failure is non-blocking */ }
                        markOnboardingComplete(currentSubject.id)
                        useSubjectStore.getState().fetchSubjects()
                    }}
                />
                {showOnboarding && (
                    <SubjectOnboardingWizard
                        subjectId={currentSubject.id}
                        subjectName={currentSubject.name}
                        subjectIcon={currentSubject.icon}
                        subjectKey={currentSubject.key}
                        onComplete={() => {
                            setShowOnboarding(false)
                            markOnboardingComplete(currentSubject.id)
                            // 刷新科目列表
                            useSubjectStore.getState().fetchSubjects()
                        }}
                        onCancel={() => setShowOnboarding(false)}
                    />
                )}
            </>
        )
    }

    // 科目已选择且完成 onboarding，显示子内容
    return <>{children}</>
}

interface SelectSubjectPromptProps {
    featureName: string
    onNavigate: () => void
}

function SelectSubjectPrompt({ featureName, onNavigate }: SelectSubjectPromptProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[500px] p-8">
            <div className="max-w-md text-center">
                {/* 图标 */}
                <div className="relative mb-6">
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-teal-500/20 flex items-center justify-center">
                        <BookOpen className="w-10 h-10 text-primary" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center animate-pulse">
                        <Sparkles className="w-4 h-4 text-yellow-500" />
                    </div>
                </div>

                {/* 标题 */}
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">
                    请先选择学习科目
                </h2>

                {/* 描述 */}
                <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                    使用 <span className="font-semibold text-primary">{featureName}</span> 前，
                    请先在学习主页选择您要学习的科目。
                </p>

                {/* 操作按钮 */}
                <Button
                    onClick={onNavigate}
                    className="px-8 py-3 bg-primary hover:bg-primaryHover text-white font-bold rounded-xl shadow-lg shadow-primary/30 transition-all transform hover:-translate-y-1 active:scale-95"
                >
                    前往选择科目
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>

                {/* 提示 */}
                <p className="mt-6 text-xs text-slate-400">
                    选择科目后，即可开始个性化学习之旅
                </p>
            </div>
        </div>
    )
}

interface CompleteOnboardingPromptProps {
    subject: Subject
    featureName: string
    onStartOnboarding: () => void
    onNavigate: () => void
    onSkip?: () => Promise<void>
}

function CompleteOnboardingPrompt({
    subject,
    featureName,
    onStartOnboarding,
    onNavigate,
    onSkip
}: CompleteOnboardingPromptProps) {
    const [isSkipping, setIsSkipping] = useState(false)

    const handleSkip = async () => {
        if (!onSkip || isSkipping) return
        setIsSkipping(true)
        try {
            await onSkip()
        } finally {
            setIsSkipping(false)
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[500px] p-8">
            <div className="max-w-md text-center">
                {/* 科目图标 */}
                <div className="relative mb-6">
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-yellow-100 to-orange-100 flex items-center justify-center text-4xl">
                        {subject.icon}
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                </div>

                {/* 标题 */}
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">
                    完成 {subject.name} 入门评估
                </h2>

                {/* 描述 */}
                <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                    使用 <span className="font-semibold text-primary">{featureName}</span> 前，
                    请先完成 <span className="font-semibold">{subject.name}</span> 的入门评估，
                    我们将为您定制专属学习路径。
                </p>

                {/* 操作按钮 */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                        onClick={onStartOnboarding}
                        className="px-8 py-3 bg-primary hover:bg-primaryHover text-white font-bold rounded-xl shadow-lg shadow-primary/30 transition-all transform hover:-translate-y-1 active:scale-95"
                    >
                        开始入门评估
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button
                        variant="outline"
                        onClick={onNavigate}
                        className="px-6 py-3 rounded-xl"
                    >
                        返回学习主页
                    </Button>
                </div>

                {/* 跳过评估按钮 */}
                {onSkip && (
                    <button
                        onClick={handleSkip}
                        disabled={isSkipping}
                        className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors disabled:opacity-50"
                    >
                        {isSkipping ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <SkipForward className="w-3.5 h-3.5" />
                        )}
                        {isSkipping ? "正在跳过..." : "跳过评估，直接开始学习"}
                    </button>
                )}

                {/* 状态提示 */}
                <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-full text-sm">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                    {subject.onboarding_status === "in_progress" ? "评估进行中" : "尚未开始评估"}
                </div>
            </div>
        </div>
    )
}
