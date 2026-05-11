import { useEffect, useState, lazy, Suspense, useMemo } from "react"
import { createPortal } from "react-dom"
import { useParams, useNavigate } from "react-router-dom"
import {
    ArrowLeft,
    Brain,
    ChevronRight,
    Sparkles,
    Target,
    BookOpen,
    Trophy,
    Check,
    X,
    Loader2,
    TrendingUp,
    Lightbulb,
    Zap,
    Settings,
    BarChart3,
    Maximize2,
    Minimize2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/Icon"
import { SubjectIcon } from "@/components/ui/SubjectIcon"
import { useSubjectStore, type Subject } from "@/stores/subject"
import type { LearningPath } from "@/stores/learning-path"
import { useAuthStore } from "@/stores/auth"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { getSubjectCategory, getCategoryTheme, type SubjectCategory } from "@/lib/subjectCategory"

// Lazy load subject tools
const CodeSandbox = lazy(() => import("@/components/subject-tools/CodeSandbox"))
const MathLab = lazy(() => import("@/components/subject-tools/MathLab"))
const FlashcardLab = lazy(() => import("@/components/subject-tools/FlashcardLab"))

// 学习目标配置
const GOALS = [
    { id: "basics", label: "掌握基础知识", icon: BookOpen },
    { id: "career", label: "提升职业技能", icon: Trophy },
    { id: "exam", label: "备考认证考试", icon: Target },
    { id: "fun", label: "兴趣爱好学习", icon: Sparkles },
]

// 学习水平配置
const LEVELS = [
    { id: "beginner", label: "零基础 / 萌新", icon: Lightbulb, description: "刚开始接触，需要从头学起" },
    { id: "intermediate", label: "有一定基础", icon: BookOpen, description: "掌握基本语法，能写简单的程序" },
    { id: "advanced", label: "进阶 / 精通", icon: Zap, description: "熟练应用，追求深度和高级特性" },
]

interface GoalData {
    learning_goals: string[]
}

/** 学科特色功能区块 — 根据学科类型展示差异化工具 */
function SubjectFeatureSection({ subjectKey }: { subjectKey: string; subjectId: string }) {
    const [isOpen, setIsOpen] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const category = useMemo(() => getSubjectCategory(subjectKey), [subjectKey])
    const theme = useMemo(() => getCategoryTheme(category), [category])

    const featureConfig: Record<SubjectCategory, { title: string; desc: string; icon: string; preview: string }> = {
        engineering: {
            title: '代码沙箱',
            desc: '直接在页面写代码、运行、看结果。支持 Python。',
            icon: 'ph:code-bold',
            preview: '🔧 学工程，就要能写能跑',
        },
        'math-logic': {
            title: '数学实验室',
            desc: '输入公式自动推导步骤，函数一键生成 2D/3D 图像。',
            icon: 'tabler:math-integral-x',
            preview: '📐 学数理，就要看得见、推得动',
        },
        humanities: {
            title: '记忆闪卡',
            desc: '知识点正反面卡片，按遗忘曲线智能提醒复习。',
            icon: 'ph:cards-three-bold',
            preview: '📚 学人文，就要记得牢、忘得慢',
        },
    }

    const config = featureConfig[category]


    return (
        <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Icon icon={theme.icon} className={`w-5 h-5 ${theme.text}`} />
                学科特色工具
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${theme.bg} ${theme.text}`}>
                    {config.preview}
                </span>
            </h2>

            {!isOpen ? (
                /* 入口卡片 */
                <button
                    onClick={() => setIsOpen(true)}
                    className={`subject-tool-entry group relative overflow-hidden rounded-2xl p-6 bg-surface-light dark:bg-surface-dark shadow-soft text-left border ${theme.border} w-full`}
                >
                    <div className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity bg-gradient-to-br ${theme.gradient}`} />
                    <div className="flex items-center gap-5">
                        <div className={`w-14 h-14 rounded-2xl ${theme.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                            <Icon icon={config.icon} className={`w-7 h-7 ${theme.text}`} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-1 group-hover:text-primary transition-colors">
                                {config.title}
                            </h3>
                            <p className="text-sm text-slate-500">{config.desc}</p>
                        </div>
                        <div className={`w-10 h-10 rounded-xl ${theme.bg} flex items-center justify-center`}>
                            <Icon icon="ph:arrow-right-bold" className={`w-5 h-5 ${theme.text} group-hover:translate-x-0.5 transition-transform`} />
                        </div>
                    </div>
                </button>
            ) : (
                /* 展开后的完整工具 */
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Icon icon={config.icon} className={`w-5 h-5 ${theme.text}`} />
                            <span className="font-bold text-slate-800 dark:text-white">{config.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsFullscreen(true)}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5"
                                title="全屏"
                            >
                                <Maximize2 className="w-3.5 h-3.5" />
                                全屏
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                收起
                            </button>
                        </div>
                    </div>

                    <Suspense
                        fallback={
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        }
                    >
                        {category === 'engineering' && <CodeSandbox subjectKey={subjectKey} />}
                        {category === 'math-logic' && <MathLab subjectKey={subjectKey} />}
                        {category === 'humanities' && <FlashcardLab subjectKey={subjectKey} />}
                    </Suspense>
                </div>
            )}

            {/* Fullscreen overlay */}
            {isFullscreen && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center" onClick={() => setIsFullscreen(false)}>
                    <div
                        className="w-full h-full bg-white dark:bg-slate-900 shadow-2xl overflow-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Fullscreen header */}
                        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
                            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Icon icon={config.icon} className={`w-5 h-5 ${theme.text}`} />
                                {config.title}
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${theme.bg} ${theme.text}`}>
                                    全屏模式
                                </span>
                            </h2>
                            <button
                                onClick={() => setIsFullscreen(false)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                <Minimize2 className="w-3.5 h-3.5" />
                                退出全屏
                            </button>
                        </div>
                        {/* Fullscreen body */}
                        <div className="p-4 h-[calc(100vh-57px)]">
                            <Suspense
                                fallback={
                                    <div className="flex items-center justify-center py-20">
                                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                    </div>
                                }
                            >
                                {category === 'engineering' && <CodeSandbox subjectKey={subjectKey} isFullscreen />}
                                {category === 'math-logic' && <MathLab subjectKey={subjectKey} />}
                                {category === 'humanities' && <FlashcardLab subjectKey={subjectKey} />}
                            </Suspense>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}

export default function SubjectDetail() {
    const { subjectId } = useParams<{ subjectId: string }>()
    const navigate = useNavigate()
    const userId = useAuthStore((s) => s.profile?.user_id)

    const subjects = useSubjectStore((s) => s.subjects)
    const fetchSubjects = useSubjectStore((s) => s.fetchSubjects)

    const [subject, setSubject] = useState<Subject | null>(null)
    const [learningGoals, setLearningGoals] = useState<string[]>([])
    const [level, setLevel] = useState<string>("beginner")
    const [activePath, setActivePath] = useState<LearningPath | null>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [editingGoals, setEditingGoals] = useState<string[]>([])
    const [editingLevel, setEditingLevel] = useState<string>("beginner")
    const [isSaving, setIsSaving] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    // 加载科目数据
    useEffect(() => {
        if (subjects.length === 0 && userId) {
            fetchSubjects()
        }
    }, [subjects.length, userId, fetchSubjects])

    // 设置当前科目
    useEffect(() => {
        if (subjectId && subjects.length > 0) {
            const found = subjects.find((s) => s.id === subjectId)
            setSubject(found || null)
        }
    }, [subjectId, subjects])

    // 获取学习目标
    useEffect(() => {
        if (!subjectId || !userId) return

        const fetchGoals = async () => {
            setIsLoading(true)
            try {
                const response = await api.get<GoalData>(`/api/subjects/${subjectId}/profile`, {
                    params: { user_id: userId },
                })
                // 解析目标字符串
                const profileData = response.data as unknown as { goal?: string; level?: string }
                const goalStr = profileData?.goal || ""
                const goals = goalStr ? goalStr.split(",").filter(Boolean) : []
                setLearningGoals(goals)
                setLevel(profileData?.level || "beginner")
            } catch (error) {
                console.error("Failed to fetch learning goals:", error)
                setLearningGoals([])
                setLevel("beginner")
            } finally {
                setIsLoading(false)
            }
        }

        fetchGoals()
    }, [subjectId, userId])

    useEffect(() => {
        if (!userId || !subject?.key) return

        const fetchActivePath = async () => {
            try {
                const response = await api.get<LearningPath>(`/api/ai-learning-path/user/${userId}/active`, {
                    params: { subject_key: subject.key },
                })
                setActivePath(response.data)
            } catch (error) {
                if ((error as { response?: { status?: number } }).response?.status === 404) {
                    setActivePath(null)
                    return
                }
                console.error("Failed to fetch active learning path:", error)
                setActivePath(null)
            }
        }

        fetchActivePath()
    }, [subject?.key, userId])

    const handleStartEdit = () => {
        navigate("/app/ai-learning-path")
    }

    const handleCancelEdit = () => {
        setIsEditing(false)
        setEditingGoals([])
        setEditingLevel(level)
    }

    const toggleEditGoal = (goalId: string) => {
        setEditingGoals((prev) =>
            prev.includes(goalId) ? prev.filter((g) => g !== goalId) : [...prev, goalId]
        )
    }

    const handleSaveGoals = async () => {
        if (!subjectId || !userId) return

        setIsSaving(true)
        try {
            await api.put(`/api/subjects/${subjectId}/profile`, {
                goal: editingGoals.join(","),
                level: editingLevel,
            }, {
                params: { user_id: userId },
            })
            setLearningGoals(editingGoals)
            setLevel(editingLevel)
            setIsEditing(false)
        } catch (error) {
            console.error("Failed to save learning goals:", error)
        } finally {
            setIsSaving(false)
        }
    }

    if (!subject) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-slate-500">加载中...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 pb-16 relative">
            {/* 顶栏背景装饰 */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-gradient-to-b from-primary/5 to-transparent -z-10 rounded-full blur-3xl" />

            {/* 返回按钮 - 绝对定位 */}
            <div className="absolute top-0 left-0">
                <button
                    onClick={() => navigate("/app/dashboard")}
                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-primary/50 transition-all"
                    title="返回主页"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </button>
            </div>

            {/* 居中标题区域 */}
            <div className="flex flex-col items-center text-center pt-4 pb-2">
                <div className="relative mb-6 group">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-all duration-500" />
                    <SubjectIcon subject={subject} className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl transform transition-transform duration-500 group-hover:scale-110" />
                </div>

                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 dark:text-white mb-3 tracking-tight">
                    {subject.name}
                </h1>
                <div className="max-w-xl">
                    <p className="text-base md:text-lg text-slate-500 leading-relaxed">
                        {subject.description}
                    </p>
                </div>
            </div>

            <div className="rounded-2xl border border-teal-200/70 bg-[linear-gradient(135deg,rgba(240,253,250,0.95),rgba(255,255,255,0.98))] p-5 shadow-soft">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                            <Sparkles className="h-3.5 w-3.5" />
                            推荐主入口
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">从学习工作台继续今天的主线任务</h2>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                                这里保留学科概览，但路线、任务、练习和复盘已经开始收口到统一工作台。
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => navigate(`/app/studio/${subjectId}`)}
                        className="h-12 rounded-2xl bg-teal-600 px-5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 hover:bg-teal-500"
                    >
                        进入学习工作台
                    </Button>
                </div>
            </div>

            {/* 学习进度卡片 */}
            <div className="bg-gradient-to-br from-primary/10 to-teal-500/10 rounded-2xl p-6 border border-primary/20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        <span className="font-bold text-slate-800 dark:text-white">学习进度</span>
                    </div>
                    <span className="text-2xl font-bold text-primary">
                        {subject.progress_percent.toFixed(0)}%
                    </span>
                </div>
                <div className="h-3 bg-white/50 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-primary to-teal-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(subject.progress_percent, 100)}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                    <span>已掌握 {subject.mastered_nodes} 个知识点</span>
                    <span>共 {subject.total_nodes} 个知识点</span>
                </div>
            </div>

            {/* 学习偏好设置区域 */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Settings className="w-6 h-6 text-primary" />
                        学习策略控制台
                    </h2>
                    {!isEditing ? (
                        <Button
                            onClick={handleStartEdit}
                            className="bg-primary hover:bg-primaryHover text-white rounded-xl px-6 shadow-md hover:shadow-lg transition-all"
                        >
                        <ChevronRight className="w-4 h-4 mr-2" />
                        调整学习路线
                        </Button>
                    ) : (
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                                className="rounded-xl border-slate-200 dark:border-slate-700"
                            >
                                <X className="w-4 h-4 mr-2" />
                                取消
                            </Button>
                            <Button
                                onClick={handleSaveGoals}
                                disabled={isSaving}
                                className="bg-primary hover:bg-primaryHover text-white rounded-xl px-6 shadow-md hover:shadow-lg transition-all"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Check className="w-4 h-4 mr-2" />
                                )}
                                保存设置
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-6">
                    {/* 学习目标卡片 */}
                    <div className={cn(
                        "bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-soft flex flex-col border-2 transition-all",
                        isEditing ? "border-primary/20 bg-primary/5" : "border-transparent"
                    )}>
                        <div className="flex items-center gap-2 mb-4">
                            <Target className="w-5 h-5 text-primary" />
                            <span className="font-bold text-slate-800 dark:text-white">学习目标</span>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            </div>
                        ) : isEditing ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 overflow-y-auto max-h-[250px] pr-1">
                                {GOALS.map((goal) => {
                                    const isSelected = editingGoals.includes(goal.id)
                                    return (
                                        <button
                                            key={goal.id}
                                            onClick={() => toggleEditGoal(goal.id)}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
                                                isSelected
                                                    ? "border-primary bg-primary/10"
                                                    : "border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 hover:border-primary/50"
                                            )}
                                        >
                                            <goal.icon
                                                className={cn(
                                                    "w-5 h-5",
                                                    isSelected ? "text-primary" : "text-slate-400"
                                                )}
                                            />
                                            <span
                                                className={cn(
                                                    "text-sm font-medium",
                                                    isSelected ? "text-primary" : "text-slate-600 dark:text-slate-300"
                                                )}
                                            >
                                                {goal.label}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        ) : learningGoals.length > 0 ? (
                            <div className="flex flex-wrap gap-2 items-start">
                                {learningGoals.map((goalId) => {
                                    const goal = GOALS.find((g) => g.id === goalId)
                                    if (!goal) return null
                                    return (
                                        <div
                                            key={goalId}
                                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
                                        >
                                            <goal.icon className="w-4 h-4" />
                                            {goal.label}
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-slate-400">
                                <p className="text-sm">尚未设置学习目标</p>
                            </div>
                        )}
                    </div>

                    {/* 现有基础卡片 */}
                    <div className={cn(
                        "bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-soft flex flex-col border-2 transition-all",
                        isEditing ? "border-primary/20 bg-primary/5" : "border-transparent"
                    )}>
                        <div className="flex items-center gap-2 mb-4">
                            <Brain className="w-5 h-5 text-primary" />
                            <span className="font-bold text-slate-800 dark:text-white">现有基础</span>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            </div>
                        ) : isEditing ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 overflow-y-auto max-h-[250px] pr-1">
                                {LEVELS.map((l) => {
                                    const isSelected = editingLevel === l.id
                                    return (
                                        <button
                                            key={l.id}
                                            onClick={() => setEditingLevel(l.id)}
                                            className={cn(
                                                "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                                                isSelected
                                                    ? "border-primary bg-primary/10"
                                                    : "border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 hover:border-primary/50"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                                isSelected ? "bg-primary/20" : "bg-slate-100 dark:bg-slate-800"
                                            )}>
                                                <l.icon className={cn("w-5 h-5", isSelected ? "text-primary" : "text-slate-400")} />
                                            </div>
                                            <div>
                                                <div className={cn("text-sm font-bold", isSelected ? "text-primary" : "text-slate-700 dark:text-white")}>{l.label}</div>
                                                <div className="text-xs text-slate-500 line-clamp-1">{l.description}</div>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col justify-center">
                                {LEVELS.find(l => l.id === level) ? (
                                    <div className="bg-white/50 dark:bg-slate-800/50 border border-primary/10 rounded-2xl p-4 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                                            {(() => {
                                                const Icon = LEVELS.find(l => l.id === level)?.icon || Lightbulb
                                                return <Icon className="w-6 h-6 text-primary" />
                                            })()}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800 dark:text-white">
                                                {LEVELS.find(l => l.id === level)?.label}
                                            </div>
                                            <div className="text-sm text-slate-500">
                                                {LEVELS.find(l => l.id === level)?.description}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-slate-400">
                                        <p className="text-sm">尚未设置基础水平</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(15,118,110,0.08),rgba(255,255,255,0.96))] p-6 shadow-soft">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold tracking-wide text-teal-700 shadow-sm">
                            <Settings className="h-3.5 w-3.5" />
                            当前学习策略
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">让路线、执行和复盘围绕同一个目标转动</h3>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                这里不再只是保存偏好，而是把你的当前目标、基础判断和激活学习路线汇总成执行入口。
                            </p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
                        <div className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">激活学习路线</div>
                        {activePath ? (
                            <div className="mt-2 space-y-1">
                                <div className="text-base font-bold text-slate-900">{activePath.goal}</div>
                                <div className="text-sm text-slate-500">第 {activePath.current_day} / {activePath.total_days} 天</div>
                            </div>
                        ) : (
                            <div className="mt-2 text-sm text-slate-500">还没有激活路线，去 AI 学习路线完成澄清后即可生成。</div>
                        )}
                    </div>
                </div>

                {activePath && (
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
                            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">今日推进</div>
                            <div className="mt-2 text-2xl font-bold text-slate-900">第 {activePath.current_day} / {activePath.total_days} 天</div>
                            <p className="mt-1 text-sm text-slate-500">继续沿当前节奏推进，不在详情页里断掉上下文。</p>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
                            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">每日投入</div>
                            <div className="mt-2 text-2xl font-bold text-slate-900">{activePath.daily_minutes} 分钟</div>
                            <p className="mt-1 text-sm text-slate-500">工作台、练习和复盘都会沿用这个节奏。</p>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
                            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">路线进度</div>
                            <div className="mt-2 text-2xl font-bold text-slate-900">{Math.round(activePath.progress_percent)}%</div>
                            <p className="mt-1 text-sm text-slate-500">完成任务后再去复盘，策略才会持续收敛。</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ 学科特色功能区 ═══ */}
            <SubjectFeatureSection subjectKey={subject.key} subjectId={subjectId!} />

            {/* 功能入口 */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    执行与练习
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                    <button
                        onClick={() => navigate(`/app/studio/${subjectId}`)}
                        className="group relative overflow-hidden rounded-2xl p-6 bg-surface-light dark:bg-surface-dark shadow-soft hover:shadow-lg transition-all duration-300 text-left border border-primary/20 hover:border-primary/40 w-full"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity bg-gradient-to-br from-primary to-teal-500" />
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Sparkles className="w-8 h-8 text-primary" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-1 group-hover:text-primary transition-colors">
                                    继续今日学习
                                </h3>
                                <p className="text-sm text-slate-500">
                                    沿着当前路线继续推进今日任务，在统一工作台里完成概念学习与互动练习。
                                </p>
                            </div>
                            <ChevronRight className="w-6 h-6 text-primary/40 group-hover:text-primary transform group-hover:translate-x-1 transition-all" />
                        </div>
                    </button>
                    
                    <button
                        onClick={() => navigate("/app/question-bank")}
                        className="group relative overflow-hidden rounded-2xl p-6 bg-surface-light dark:bg-surface-dark shadow-soft hover:shadow-lg transition-all duration-300 text-left border border-amber-500/20 hover:border-amber-500/40 w-full"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity bg-gradient-to-br from-amber-400 to-orange-500" />
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                                <Target className="w-8 h-8 text-amber-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-1 group-hover:text-amber-600 transition-colors">
                                    题库练习
                                </h3>
                                <p className="text-sm text-slate-500">
                                    进入动态题库做针对性训练，把当前目标和薄弱点转成可验证的练习结果。
                                </p>
                            </div>
                            <ChevronRight className="w-6 h-6 text-amber-300 group-hover:text-amber-600 transform group-hover:translate-x-1 transition-all" />
                        </div>
                    </button>
                </div>
            </div>

            {/* 数据分析区块 */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    学习复盘
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                    <button
                        onClick={() => navigate("/app/stats")}
                        className="group relative overflow-hidden rounded-2xl p-6 bg-surface-light dark:bg-surface-dark shadow-soft hover:shadow-lg transition-all duration-300 text-left border border-emerald-500/20 hover:border-emerald-500/40 w-full"
                    >
                        {/* 背景装饰 */}
                        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity bg-gradient-to-br from-emerald-500 to-teal-600" />

                        <div className="flex items-center gap-6 relative z-10">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                                <BarChart3 className="w-8 h-8 text-emerald-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-xl text-slate-800 dark:text-white mb-1 group-hover:text-emerald-600 transition-colors">
                                    查看学习复盘
                                </h3>
                                <p className="text-sm text-slate-500">
                                    回到统计页查看时长、正确率和能力分布，再决定是否需要调整路线。
                                </p>
                            </div>
                            <ChevronRight className="w-6 h-6 text-emerald-300 group-hover:text-emerald-600 transform group-hover:translate-x-1 transition-all" />
                        </div>
                    </button>
                </div>
            </div>
        </div>
    )
}
