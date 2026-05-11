import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react"
import { createPortal } from "react-dom"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import {
    ArrowLeft,
    Github,
    Menu,
    Home,
    BookOpen,
    ChevronRight,
    ChevronDown,
    Lightbulb,
    ArrowRight,
    Sparkles,
    List,
    Loader2,
    X,
    MessageSquare,
    Code,
    Maximize2,
    Minimize2,
    ArrowUpToLine,
    ArrowDownToLine,
} from "lucide-react"

import { XMarkdown, useStreaming } from "@ant-design/x-markdown"
import Latex from "@ant-design/x-markdown/plugins/Latex"
import type { ComponentProps as XMdComponentProps } from "@ant-design/x-markdown"
import "@ant-design/x-markdown/es/XMarkdown/index.css"
import "@/styles/x-markdown-overrides.css"

import { useAuthStore } from "@/stores/auth"
import { useChatStore } from "@/stores/chat"
import { useLearningPathStore } from "@/stores/learning-path"
import { useNotificationStore } from "@/stores/notification"
import { api } from "@/lib/api"
import {
    deleteConceptContent,
    generateConceptExercises,
    getCachedContent,
    streamConceptContent,
    type ConceptMap,
} from "@/lib/streamConceptContent"
import {
    studioHeaderShellClass,
    studioMutedTextClass,
    studioPageShellClass,
    studioPanelSurfaceClass,
    studioSidebarShellClass,
} from "@/features/studio/ui/studioClassNames"
import ContextQuickAsk, {
    CONTEXT_QUICK_ASK_EVENT,
    type ContextQuickAskPayload
} from "@/features/studio/components/ContextQuickAsk"
import ConceptMarkmap from "@/components/concept/ConceptMarkmap"
import ConceptPythonPlayground from "@/components/concept/ConceptPythonPlayground"
import EngineeringCodeBlock, { CODE_TO_SANDBOX_EVENT, type CodeToSandboxPayload } from "@/components/concept/EngineeringCodeBlock"
import { CodeBlock } from "@/components/ui/CodeBlock"
import Mermaid from "@/components/ui/Mermaid"
import InlineLatex from "@/components/ui/InlineLatex"
import { getSubjectCategory } from "@/lib/subjectCategory"

// Lazy load code sandbox
const CodeSandbox = lazy(() => import("@/components/subject-tools/CodeSandbox"))


type QuickAskState = ContextQuickAskPayload & {
    x: number
    y: number
}

const CONCEPT_AI_ENTRY_HINT_KEY = "concept-learning-ai-entry-hint-seen"
const CONCEPT_AI_SIDEBAR_EXPANDED_KEY = "concept-learning-ai-sidebar-expanded"

const normalizeHeadingKey = (value: string) =>
    value
        .replace(/^#+\s*/, "")
        .trim()
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
        .replace(/^-+|-+$/g, "")



function buildFallbackMarkmapMarkdown(
    taskTitle: string,
    toc: Array<{ text: string; level: number }>
) {
    const lines = [`# ${taskTitle}`]
    for (const item of toc.filter((entry) => entry.level >= 2 && entry.level <= 3)) {
        const prefix = item.level === 2 ? "##" : "###"
        lines.push(`${prefix} ${item.text}`)
    }
    return lines.join("\n")
}



// 思维过程组件
function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
    const [isExpanded, setIsExpanded] = useState(false)

    if (!content) return null

    return (
        <div className="mb-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-teal-500" />
                    <span className="font-medium">AI 思考过程</span>
                    {isStreaming && (
                        <span className="flex h-1.5 w-1.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-500"></span>
                        </span>
                    )}
                </div>
                <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                />
            </button>
            {isExpanded && (
                <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono whitespace-pre-wrap bg-slate-50/50 dark:bg-slate-900/30">
                    {content}
                    {isStreaming && (
                        <span className="inline-block w-1.5 h-4 bg-teal-500 animate-pulse ml-0.5 align-middle" />
                    )}
                </div>
            )}
        </div>
    )
}

// 生成标题 ID（用于 TOC 锚点导航）
const headingId = (children: React.ReactNode) => {
    const text = React.Children.toArray(children)
        .map((child) => (typeof child === "string" || typeof child === "number" ? child : ""))
        .join("")
    return normalizeHeadingKey(text || String(children))
}

const getFocusableElements = (container: HTMLElement | null) => {
    if (!container) return []
    return Array.from(
        container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
    ).filter((element) => !element.hasAttribute("aria-hidden"))
}

const trapFocusWithin = (event: KeyboardEvent, container: HTMLElement | null) => {
    if (event.key !== "Tab" || !container) return

    const focusableElements = getFocusableElements(container)
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    const activeElement = document.activeElement as HTMLElement | null

    if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
        return
    }

    if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
    }
}




// XMarkdown 自定义组件映射 — 基础部分（不含 code，code 需要根据学科类型动态切换）
const baseMarkdownComponents: Record<string, React.ComponentType<XMdComponentProps>> = {
    h1: ({ domNode: _, streamStatus: _s, children, ...props }: XMdComponentProps) => {
        const id = headingId(children)
        // Markdown 生成的 h1 与页面的 taskTitle 重复，所以将其隐藏，仅保留 id 锚点
        return <span id={id} className="hidden" />
    },

    h2: ({ class: _class, className, domNode: _d, streamStatus: _s, children, ...props }: any) => {
        const id = headingId(children)
        return (
            <h2
                id={id}
                className={`scroll-mt-24 mt-12 mb-5 border-b-2 border-slate-300 pb-3 text-[1.75rem] font-extrabold tracking-tight text-slate-950 dark:border-slate-700 dark:text-white [counter-increment:h2-counter] before:content-[counter(h2-counter)_'.'] before:mr-2.5 ${className || _class || ''}`.trim()}
                {...props}
            >
                {children}
            </h2>
        )
    },
    h3: ({ class: _class, className, domNode: _d, streamStatus: _s, children, ...props }: any) => {
        const id = headingId(children)
        return (
            <h3
                id={id}
                className={`scroll-mt-24 mt-9 mb-4 text-[1.4rem] font-bold tracking-tight text-slate-900 dark:text-slate-100 ${className || _class || ''}`.trim()}
                {...props}
            >
                {children}
            </h3>
        )
    },
    h4: ({ class: _class, className, domNode: _, streamStatus: _s, children, ...props }: any) => (
        <h4 className={`mt-6 mb-2 text-[1.1rem] font-semibold text-slate-800 dark:text-slate-200 ${className || _class || ''}`.trim()} {...props}>{children}</h4>
    ),
    p: ({ class: _class, className, domNode: _, streamStatus: _s, ...props }: any) => (
        <p className={`text-slate-600 dark:text-slate-300 leading-relaxed mb-4 ${className || _class || ''}`.trim()} {...props} />
    ),
    ul: ({ class: _class, className, domNode: _, streamStatus: _s, ...props }: any) => (
        <ul className={`list-disc list-inside space-y-2 mb-4 text-slate-600 dark:text-slate-300 ${className || _class || ''}`.trim()} {...props} />
    ),
    ol: ({ class: _class, className, domNode: _, streamStatus: _s, ...props }: any) => (
        <ol className={`list-decimal list-inside space-y-2 mb-4 text-slate-600 dark:text-slate-300 ${className || _class || ''}`.trim()} {...props} />
    ),
    li: ({ class: _class, className, domNode: _, streamStatus: _s, ...props }: any) => (
        <li className={`leading-relaxed ${className || _class || ''}`.trim()} {...props} />
    ),
    strong: ({ class: _class, className, domNode: _, streamStatus: _s, ...props }: any) => (
        <strong className={`font-semibold text-slate-900 dark:text-white ${className || _class || ''}`.trim()} {...props} />
    ),
    a: ({ class: _class, className, domNode: _, streamStatus: _s, ...props }: any) => (
        <a className={`text-teal-600 dark:text-teal-400 hover:underline ${className || _class || ''}`.trim()} {...props} />
    ),
    pre: ({ children }: any) => {
        return <div className="not-prose">{children}</div>
    },
    blockquote: ({ children }: any) => (
        <div className="my-6 p-4 rounded-xl border border-teal-200/50 bg-teal-50/50 dark:bg-teal-500/10 dark:border-teal-500/20 flex gap-4 not-italic">
            <Lightbulb className="h-6 w-6 text-teal-500 flex-shrink-0 mt-0.5" />
            <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                {children}
            </div>
        </div>
    ),
    table: ({ domNode: _, streamStatus: _s, ...props }: XMdComponentProps) => (
        <div className="overflow-x-auto my-4">
            <table className="min-w-full border-collapse border border-slate-200 dark:border-slate-700" {...props} />
        </div>
    ),
    th: ({ domNode: _, streamStatus: _s, ...props }: XMdComponentProps) => (
        <th className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-left font-semibold text-slate-900 dark:text-white" {...props} />
    ),
    td: ({ domNode: _, streamStatus: _s, ...props }: XMdComponentProps) => (
        <td className="border border-slate-200 dark:border-slate-700 px-4 py-2 text-slate-600 dark:text-slate-300" {...props} />
    ),
}

/**
 * 创建 code 组件 — 根据是否为工程类学科区分渲染方式
 * - 工程类 (Python/ML): 浅色代码块 + 仅复制 + 复制到沙箱
 * - 非工程类: Python 在页执行 (ConceptPythonPlayground) 或通用 CodeBlock
 */
function makeCodeComponent(isEngineering: boolean, sandboxEnabled: boolean) {
    return function CodeComponent({ lang, block, class: _class, className, children, domNode: _, streamStatus: _s, ...props }: any) {
        const finalClass = className || _class || ""
        const language = lang || (finalClass.startsWith('language-') ? finalClass.replace('language-', '') : '')

        if (block) {
            if (language === 'mermaid') {
                return <Mermaid chart={String(children)} />
            }

            // 工程类学科：所有代码块都用浅色展示 + 复制按钮，不在页面内运行
            if (isEngineering) {
                return <EngineeringCodeBlock code={String(children)} language={language} sandboxEnabled={sandboxEnabled} />
            }

            // 非工程类学科：Python 代码保留 Pyodide 在页执行
            if (language === "python" || language === "py") {
                return <ConceptPythonPlayground initialCode={String(children)} />
            }
            return <CodeBlock language={language} value={String(children)} />
        }

        return (
            <code className={`${finalClass} bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono text-teal-600 dark:text-teal-400`.trim()} {...props}>
                {children}
            </code>
        )
    }
}

type ExercisePreviewItem = {
    index: number
    stem: string
    prompt?: string
    options: string[]
}

type ExercisePreviewGroup = {
    id: string
    count: number
    target: string
    items: ExercisePreviewItem[]
}

type LearningPathTask = {
    id: string
    title: string
    description: string
    type: "concept" | "exercise" | "project" | "review"
    duration_minutes: number
    resources: string[]
}

type LearningPathDay = {
    day: number
    theme: string
    tasks: LearningPathTask[]
}

type LearningPathResponse = {
    id: string
    version?: number
    version_name?: string | null
    days: LearningPathDay[]
}

type QuestionGroupSummary = {
    id: string
    source_type?: string | null
    source_task_id?: string | null
    source_task_title?: string | null
    learning_path_id?: string | null
    learning_path_version?: number | null
    source_day?: number | null
    source_chapter_id?: string | null
    source_chapter_title?: string | null
    item_count?: number | null
}

type QuestionGroupListResponse = {
    success: boolean
    groups: QuestionGroupSummary[]
}

type QuestionGroupItem = {
    id: string
    stem?: string
    title?: string
    description?: string
    prompt?: string
    options?: unknown[] | null
}

type QuestionGroupItemsResponse = {
    success: boolean
    items: QuestionGroupItem[]
}

type ChapterNavigationItem = {
    key: string
    day: number
    taskId: string
    label: string
    target: string
}

function buildQuestionBankTarget(scope: {
    taskTitle: string
    taskDescription: string
    day: number
    taskId: string
    pathId?: string | null
    version?: number | null
    versionName?: string | null
    chapterId?: string | null
    chapterTitle?: string | null
    subjectKey: string
    groupId?: string | null
    entrySource?: string | null
    returnTo?: string | null
}): string {
    const params = new URLSearchParams({
        from: "learning-path",
        taskTitle: scope.taskTitle,
        taskDescription: scope.taskDescription,
        day: String(scope.day),
        taskId: scope.taskId,
        pathId: scope.pathId || "",
        version: scope.version != null ? String(scope.version) : "",
        versionName: scope.versionName || "",
        chapterId: scope.chapterId || "",
        chapterTitle: scope.chapterTitle || "",
        subjectKey: scope.subjectKey,
    })
    if (scope.entrySource) {
        params.set("entrySource", scope.entrySource)
    }
    if (scope.returnTo) {
        params.set("returnTo", scope.returnTo)
    }
    if (scope.groupId) {
        params.set("groupId", scope.groupId)
    }
    return `/app/question-bank?${params.toString()}`
}

function buildConceptLearningTarget(scope: {
    task: LearningPathTask
    subject: string
    subjectKey: string
    pathId?: string | null
    version?: number | null
    versionName?: string | null
    day: number
    chapterId: string
    chapterTitle: string
}): string {
    const params = new URLSearchParams({
        title: scope.task.title,
        description: scope.task.description || "",
        subject: scope.subject,
        duration: String(scope.task.duration_minutes || 20),
        resources: Array.isArray(scope.task.resources) ? scope.task.resources.join(",") : "",
        pathId: scope.pathId || "",
        version: scope.version != null ? String(scope.version) : "",
        versionName: scope.versionName || "",
        chapterId: scope.chapterId,
        chapterTitle: scope.chapterTitle,
        day: String(scope.day),
        subjectKey: scope.subjectKey,
    })
    return `/app/concept-learning/${scope.task.id}?${params.toString()}`
}

function buildExercisePreviewStorageKey(scope: {
    taskId?: string
    pathId?: string | null
    version?: number | null
    chapterId?: string | null
    day?: number | null
}): string | null {
    if (!scope.taskId) return null

    return [
        "concept-learning-exercise-preview",
        scope.taskId,
        scope.pathId || "standalone",
        scope.version != null ? `v${scope.version}` : "v-none",
        scope.chapterId || (scope.day != null ? `day-${scope.day}` : "chapter-none"),
    ].join(":")
}

function parseExercisePreview(rawContent: string): ExercisePreviewItem[] {
    const normalized = rawContent.replace(/\r\n/g, "\n").trim()
    if (!normalized) return []

    const extractJsonPayload = (input: string): string => {
        const trimmed = input.trim()
        const withoutFence = trimmed
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim()

        if (withoutFence.startsWith("{") || withoutFence.startsWith("[")) {
            return withoutFence
        }

        const firstBrace = withoutFence.indexOf("{")
        const firstBracket = withoutFence.indexOf("[")
        const start = [firstBrace, firstBracket].filter((value) => value >= 0).sort((a, b) => a - b)[0]
        const lastBrace = withoutFence.lastIndexOf("}")
        const lastBracket = withoutFence.lastIndexOf("]")
        const end = Math.max(lastBrace, lastBracket)

        if (start != null && end > start) {
            return withoutFence.slice(start, end + 1)
        }

        return withoutFence
    }

    const normalizePreviewOption = (option: unknown, index: number): string | null => {
        const fallbackLabel = String.fromCharCode(65 + index)

        if (typeof option === "string") {
            const text = option.trim()
            if (!text) return null
            return /^[A-H][\.\u3001)]\s*/i.test(text) ? text : `${fallbackLabel}. ${text}`
        }

        if (option && typeof option === "object") {
            const record = option as Record<string, unknown>
            const label = typeof record.label === "string" && record.label.trim() ? record.label.trim() : fallbackLabel
            const textCandidate = [record.text, record.content, record.value, record.description]
                .find((value) => typeof value === "string" && value.trim())
            if (typeof textCandidate === "string") {
                return `${label}. ${textCandidate.trim()}`
            }
        }

        return null
    }

    const jsonPayload = extractJsonPayload(normalized)

    try {
        const parsed = JSON.parse(jsonPayload) as unknown
        const exercises = Array.isArray(parsed)
            ? parsed
            : parsed && typeof parsed === "object" && Array.isArray((parsed as { exercises?: unknown }).exercises)
                ? (parsed as { exercises: unknown[] }).exercises
                : null

        if (exercises) {
            const items = exercises.reduce<ExercisePreviewItem[]>((acc, item, index) => {
                if (!item || typeof item !== "object") return acc

                const record = item as Record<string, unknown>
                const title = typeof record.title === "string" && record.title.trim()
                    ? record.title.trim()
                    : typeof record.question === "string" && record.question.trim()
                        ? record.question.trim()
                        : typeof record.stem === "string" && record.stem.trim()
                            ? record.stem.trim()
                            : `第 ${index + 1} 题`
                const prompt = typeof record.description === "string" && record.description.trim()
                    ? record.description.trim()
                    : typeof record.prompt === "string" && record.prompt.trim()
                        ? record.prompt.trim()
                        : undefined
                const options = Array.isArray(record.options)
                    ? record.options.reduce<string[]>((optionAcc, option, optionIndex) => {
                        const normalizedOption = normalizePreviewOption(option, optionIndex)
                        if (normalizedOption) optionAcc.push(normalizedOption)
                        return optionAcc
                    }, [])
                    : []

                acc.push({
                    index: index + 1,
                    stem: title,
                    prompt,
                    options,
                })
                return acc
            }, []).slice(0, 8)

            if (items.length > 0) {
                return items
            }
        }
    } catch {
        // Fall back to plain-text parsing when the payload is not valid JSON.
    }

    const lines = normalized
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)

    const items: ExercisePreviewItem[] = []
    let current: ExercisePreviewItem | null = null

    const pushCurrent = () => {
        if (!current || !current.stem.trim()) return
        items.push({
            ...current,
            stem: current.stem.trim(),
            prompt: current.prompt?.trim() || undefined,
            options: current.options.map((option) => option.trim()).filter(Boolean),
        })
        current = null
    }

    for (const line of lines) {
        const questionMatch = line.match(/^(?:第\s*)?(\d+)[\.、)]\s*(.+)$/)
        if (questionMatch) {
            pushCurrent()
            current = {
                index: Number(questionMatch[1]),
                stem: questionMatch[2].trim(),
                prompt: undefined,
                options: [],
            }
            continue
        }

        const optionMatch = line.match(/^([A-H])[\.、)]\s*(.+)$/i)
        if (optionMatch && current) {
            current.options.push(`${optionMatch[1].toUpperCase()}. ${optionMatch[2].trim()}`)
            continue
        }

        if (!current) continue

        if (current.options.length > 0) {
            current.options[current.options.length - 1] = `${current.options[current.options.length - 1]} ${line}`.trim()
            continue
        }

        current.prompt = `${current.prompt || ""} ${line}`.trim()
    }

    pushCurrent()

    if (items.length === 0) {
        return normalized
            ? [
                {
                    index: 1,
                    stem: normalized.split("\n").slice(0, 3).join(" ").trim(),
                    prompt: undefined,
                    options: [],
                },
            ]
            : []
    }

    return items.slice(0, 8)
}

function parseExercisePreviewFromCanonicalExercises(
    exercises: Array<{
        title?: string
        description?: string
        prompt?: string
        question?: string
        stem?: string
        options?: unknown[] | null
    }>
): ExercisePreviewItem[] {
    return exercises.reduce<ExercisePreviewItem[]>((acc, item, index) => {
        const title = [item.title, item.question, item.stem]
            .find((value): value is string => typeof value === "string" && value.trim().length > 0)
        if (!title) return acc

        const prompt = [item.description, item.prompt]
            .find((value): value is string => typeof value === "string" && value.trim().length > 0)

        const options = Array.isArray(item.options)
            ? item.options.reduce<string[]>((optionAcc, option, optionIndex) => {
                const fallbackLabel = String.fromCharCode(65 + optionIndex)
                if (typeof option === "string" && option.trim()) {
                    optionAcc.push(/^[A-H][\.\u3001)]\s*/i.test(option) ? option.trim() : `${fallbackLabel}. ${option.trim()}`)
                    return optionAcc
                }
                if (option && typeof option === "object") {
                    const record = option as Record<string, unknown>
                    const label = typeof record.label === "string" && record.label.trim() ? record.label.trim() : fallbackLabel
                    const text = [record.text, record.content, record.value, record.description]
                        .find((value): value is string => typeof value === "string" && value.trim().length > 0)
                    if (text) optionAcc.push(`${label}. ${text.trim()}`)
                }
                return optionAcc
            }, [])
            : []

        acc.push({
            index: index + 1,
            stem: title.trim(),
            prompt: prompt?.trim(),
            options,
        })
        return acc
    }, []).slice(0, 8)
}

export default function ConceptLearning() {
    const { taskId } = useParams()
    const mainRef = React.useRef<HTMLElement>(null)
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const profile = useAuthStore((s) => s.profile)
    const isChatPanelCollapsed = useChatStore((s) => s.panelCollapsed)
    const setChatOpen = useChatStore((s) => s.setOpen)
    const setPanelCollapsed = useChatStore((s) => s.setPanelCollapsed)
    const setPanelDock = useChatStore((s) => s.setPanelDock)
    const setLearningContext = useChatStore((s) => s.setLearningContext)

    const updateTaskCompletion = useLearningPathStore((s) => s.updateTaskCompletion)

    // 任务信息
    const taskTitle = searchParams.get("title") || "概念学习"
    const subject = searchParams.get("subject") || "Python"
    const rawDurationMinutes = searchParams.get("duration")
        || searchParams.get("durationMinutes")
        || searchParams.get("minutes")
        || ""
    const requestedDurationMinutes = (() => {
        const parsed = parseInt(rawDurationMinutes, 10)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 20
    })()

    // 学习路线关联参数
    const pathId = searchParams.get("pathId")
    const versionParam = parseInt(searchParams.get("version") || "", 10)
    const version = Number.isFinite(versionParam) ? versionParam : undefined
    const versionName = searchParams.get("versionName") || undefined
    const dayParam = parseInt(searchParams.get("day") || "1", 10)
    const day = dayParam > 0 ? dayParam : 1
    const chapterId = searchParams.get("chapterId") || undefined
    const chapterTitle = searchParams.get("chapterTitle") || undefined
    const subjectKey = searchParams.get("subjectKey") || "python"

    // 状态管理
    const [content, setContent] = useState("")
    const [reasoning, setReasoning] = useState("")
    const [conceptMap, setConceptMap] = useState<ConceptMap | null>(null)
    const [markmapMarkdown, setMarkmapMarkdown] = useState("")
    const [loading, setLoading] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [quickAsk, setQuickAsk] = useState<QuickAskState | null>(null)
    const [showAiEntryHint, setShowAiEntryHint] = useState(false)
    const [isGeneratingExercises, setIsGeneratingExercises] = useState(false)
    const [exerciseGenerationFeedback, setExerciseGenerationFeedback] = useState<string | null>(null)
    const [exerciseProgress, setExerciseProgress] = useState(0)
    const [exerciseTipIndex, setExerciseTipIndex] = useState(0)
    const [exerciseTipCharCount, setExerciseTipCharCount] = useState(0)
    const [generationPhase, setGenerationPhase] = useState<"map" | "article" | null>(null)
    const [isMarkmapFullscreen, setIsMarkmapFullscreen] = useState(false)
    /** Tracks the typewriter-animated markmap markdown during generation */
    const [markmapStreamingText, setMarkmapStreamingText] = useState("")
    const [isMarkmapRevealed, setIsMarkmapRevealed] = useState(false)
    const markmapStreamTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const codeSandboxDialogRef = React.useRef<HTMLDivElement | null>(null)
    const mobileMenuDialogRef = React.useRef<HTMLElement | null>(null)
    /** AbortController for the current SSE stream — aborted when switching chapters */
    const streamAbortRef = React.useRef<AbortController | null>(null)
    /** Placeholder typewriter timer — runs until real LLM content arrives */
    const placeholderTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
    /** Flag: has real LLM map content started arriving? */
    const realMapContentStarted = React.useRef(false)
    const [exerciseReadyPrompt, setExerciseReadyPrompt] = useState<{
        count: number
        target: string
    } | null>(null)
    const [exercisePreviewGroups, setExercisePreviewGroups] = useState<ExercisePreviewGroup[]>([])
    const [chapterNavigationItems, setChapterNavigationItems] = useState<ChapterNavigationItem[]>([])
    const [hasRestoredExercisePreview, setHasRestoredExercisePreview] = useState(false)
    const [restoredExercisePreviewKey, setRestoredExercisePreviewKey] = useState<string | null>(null)
    const [toc, setToc] = useState<{ id: string, text: string, level: number }[]>([])
    const [showCodeSandbox, setShowCodeSandbox] = useState(false)

    // 判断是否为工程类科目
    const subjectCategory = useMemo(() => getSubjectCategory(subjectKey), [subjectKey])
    const isEngineeringSubject = subjectCategory === 'engineering'

    // 动态 markdownComponents：根据学科类型切换代码块渲染方式
    const markdownComponents = useMemo(() => ({
        ...baseMarkdownComponents,
        code: makeCodeComponent(isEngineeringSubject, isEngineeringSubject),
    }), [isEngineeringSubject])

    // 代码沙箱初始代码（通过事件从 EngineeringCodeBlock "复制到沙箱" 注入）
    const sandboxInitialCodeRef = React.useRef<{ code: string; language: string } | null>(null)
    const sandboxInitialCellsRef = React.useRef<{ code: string; language: string }[] | undefined>(undefined)

    // 监听 CODE_TO_SANDBOX_EVENT：自动打开沙箱并注入代码
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<CodeToSandboxPayload>).detail
            if (detail?.code) {
                sandboxInitialCodeRef.current = { code: detail.code, language: detail.language }
                // 如果有完整的代码块列表，使用多 Cell 模式（解决代码片段缺少 import 的问题）
                sandboxInitialCellsRef.current = detail.allCodeBlocks
                setShowCodeSandbox(true)
            }
        }
        window.addEventListener(CODE_TO_SANDBOX_EVENT, handler)
        return () => window.removeEventListener(CODE_TO_SANDBOX_EVENT, handler)
    }, [])

    const isGeneratingRef = React.useRef(false)
    const headerAnchorRef = React.useRef<HTMLElement | null>(null)

    const durationMinutes = useMemo(() => {
        const parsed = parseInt(rawDurationMinutes, 10)
        if (Number.isFinite(parsed) && parsed > 0) return parsed

        const chapterCount = conceptMap?.chapter_order?.length || toc.filter((item) => item.level === 2).length || 1
        return Math.max(10, chapterCount * 8)
    }, [conceptMap?.chapter_order?.length, rawDurationMinutes, toc])

    // 流式内容处理：useStreaming 处理不完整的 markdown token，避免渲染闪烁
    const processedContent = useStreaming(content, {
        streaming: {
            hasNextChunk: loading,
            enableAnimation: true,
            animationConfig: { fadeDuration: 150, easing: 'ease-out' }
        }
    })


    const conceptSourceScope = useMemo(
        () => ({
            learning_path_id: pathId || undefined,
            learning_path_version: version,
            learning_path_version_name: versionName,
            source_day: day,
            source_chapter_id: chapterId,
            source_chapter_title: chapterTitle,
            source_task_title: taskTitle,
        }),
        [chapterId, chapterTitle, day, pathId, taskTitle, version, versionName]
    )
    const exercisePreviewStorageKey = useMemo(
        () =>
            buildExercisePreviewStorageKey({
                taskId,
                pathId,
                version,
                chapterId,
                day,
            }),
        [chapterId, day, pathId, taskId, version]
    )
    const learningPlanTarget = useMemo(
        () => (pathId ? `/app/ai-learning-path/plan/${pathId}?day=${day}` : `/app/ai-learning-path`),
        [day, pathId]
    )
    const currentConceptTarget = useMemo(
        () =>
            taskId
                ? buildConceptLearningTarget({
                    task: {
                        id: taskId,
                        title: taskTitle,
                        description: searchParams.get("description") || "",
                        type: "concept",
                        duration_minutes: requestedDurationMinutes,
                        resources: searchParams.get("resources")?.split(",").filter(Boolean) || [],
                    },
                    subject,
                    subjectKey,
                    pathId,
                    version,
                    versionName,
                    day,
                    chapterId: chapterId || `day-${day}`,
                    chapterTitle: chapterTitle || taskTitle,
                })
                : "",
        [
            chapterId,
            chapterTitle,
            day,
            pathId,
            requestedDurationMinutes,
            searchParams,
            subject,
            subjectKey,
            taskId,
            taskTitle,
            version,
            versionName,
        ]
    )
    const fallbackChapterNavigationItems = useMemo<ChapterNavigationItem[]>(
        () =>
            taskId
                ? [
                    {
                        key: `${taskId}:${chapterId || day}`,
                        day,
                        taskId,
                        label: `第${day}天 ${chapterTitle || taskTitle}`,
                        target: buildConceptLearningTarget({
                            task: {
                                id: taskId,
                                title: taskTitle,
                                description: searchParams.get("description") || "",
                                type: "concept",
                                duration_minutes: requestedDurationMinutes,
                                resources: searchParams.get("resources")?.split(",").filter(Boolean) || [],
                            },
                            subject,
                            subjectKey,
                            pathId,
                            version,
                            versionName,
                            day,
                            chapterId: chapterId || `day-${day}`,
                            chapterTitle: chapterTitle || taskTitle,
                        }),
                    },
                ]
                : [],
        [
            chapterId,
            chapterTitle,
            day,
            pathId,
            requestedDurationMinutes,
            searchParams,
            subject,
            subjectKey,
            taskId,
            taskTitle,
            version,
            versionName,
        ]
    )

    useEffect(() => {
        if (!exercisePreviewStorageKey || typeof window === "undefined") {
            setExercisePreviewGroups([])
            setHasRestoredExercisePreview(true)
            setRestoredExercisePreviewKey(exercisePreviewStorageKey)
            return
        }

        try {
            const raw = window.localStorage.getItem(exercisePreviewStorageKey)
            if (!raw) {
                setExercisePreviewGroups([])
                return
            }

            const parsed = JSON.parse(raw) as { groups?: ExercisePreviewGroup[] } | null
            const groups = Array.isArray(parsed?.groups)
                ? parsed.groups.filter(
                    (group): group is ExercisePreviewGroup =>
                        Boolean(group)
                        && typeof group.id === "string"
                        && typeof group.count === "number"
                        && typeof group.target === "string"
                        && Array.isArray(group.items)
                )
                : []
            setExercisePreviewGroups(groups)
        } catch {
            setExercisePreviewGroups([])
        } finally {
            setHasRestoredExercisePreview(true)
            setRestoredExercisePreviewKey(exercisePreviewStorageKey)
        }
    }, [exercisePreviewStorageKey])

    useEffect(() => {
        if (
            !hasRestoredExercisePreview
            || !exercisePreviewStorageKey
            || restoredExercisePreviewKey !== exercisePreviewStorageKey
            || typeof window === "undefined"
        ) return

        if (exercisePreviewGroups.length === 0) {
            window.localStorage.removeItem(exercisePreviewStorageKey)
            return
        }

        window.localStorage.setItem(
            exercisePreviewStorageKey,
            JSON.stringify({ groups: exercisePreviewGroups })
        )
    }, [exercisePreviewGroups, exercisePreviewStorageKey, hasRestoredExercisePreview, restoredExercisePreviewKey])

    useEffect(() => {
        if (typeof window === "undefined") return
        setChatOpen(true)
        setPanelDock("right")
        setPanelCollapsed(window.localStorage.getItem(CONCEPT_AI_SIDEBAR_EXPANDED_KEY) !== "1")
    }, [setChatOpen, setPanelCollapsed, setPanelDock])

    useEffect(() => {
        if (typeof window === "undefined") return
        window.localStorage.setItem(CONCEPT_AI_SIDEBAR_EXPANDED_KEY, isChatPanelCollapsed ? "0" : "1")
    }, [isChatPanelCollapsed])

    useEffect(() => {
        const updatePanelOffset = () => {
            const bottom = headerAnchorRef.current?.getBoundingClientRect().bottom ?? 0
            const nextOffset = Math.max(16, Math.ceil(bottom) + 8)
            document.documentElement.style.setProperty("--ai-panel-top-offset", `${nextOffset}px`)
            window.dispatchEvent(new Event("ai-panel-offset-change"))
        }

        updatePanelOffset()
        const observer = typeof ResizeObserver !== "undefined" && headerAnchorRef.current
            ? new ResizeObserver(() => updatePanelOffset())
            : null
        if (headerAnchorRef.current) {
            observer?.observe(headerAnchorRef.current)
        }
        window.addEventListener("resize", updatePanelOffset)

        return () => {
            observer?.disconnect()
            window.removeEventListener("resize", updatePanelOffset)
            document.documentElement.style.removeProperty("--ai-panel-top-offset")
            window.dispatchEvent(new Event("ai-panel-offset-change"))
        }
    }, [])

    useEffect(() => {
        let cancelled = false

        if (!pathId) {
            setChapterNavigationItems(fallbackChapterNavigationItems)
            return () => {
                cancelled = true
            }
        }

        const loadChapterNavigation = async () => {
            try {
                const response = await api.get<LearningPathResponse>(`/api/ai-learning-path/${pathId}`)
                const days = Array.isArray(response.data?.days) ? response.data.days : []
                const items = days.map((item) => {
                    const tasks = Array.isArray(item.tasks) ? item.tasks : []
                    const conceptTask = tasks.find(
                        (task) => task?.type === "concept" && typeof task.id === "string"
                    )
                    const fallbackTask = tasks.find(
                        (task) => typeof task.id === "string"
                    )
                    const task = conceptTask || fallbackTask
                    if (!task) return null

                    return {
                        key: `day-${item.day}`,
                        day: item.day,
                        taskId: task.id,
                        label: `第${item.day}天 ${item.theme}`,
                        target: buildConceptLearningTarget({
                            task,
                            subject,
                            subjectKey,
                            pathId,
                            version,
                            versionName,
                            day: item.day,
                            chapterId: `day-${item.day}`,
                            chapterTitle: item.theme,
                        }),
                    }
                }).filter((item): item is ChapterNavigationItem => item !== null)

                if (!cancelled) {
                    setChapterNavigationItems(items.length > 0 ? items : fallbackChapterNavigationItems)
                }
            } catch (error) {
                console.error("加载章节导航失败:", error)
                if (!cancelled) {
                    setChapterNavigationItems(fallbackChapterNavigationItems)
                }
            }
        }

        loadChapterNavigation()

        return () => {
            cancelled = true
        }
    }, [fallbackChapterNavigationItems, pathId, subject, subjectKey, version, versionName])

    useEffect(() => {
        if (
            !hasRestoredExercisePreview
            || restoredExercisePreviewKey !== exercisePreviewStorageKey
            || !profile?.user_id
            || !taskId
        ) {
            return
        }

        let cancelled = false

        const syncExercisePreviewGroups = async () => {
            try {
                const response = await api.get<QuestionGroupListResponse>("/api/question-bank/groups", {
                    params: { user_id: profile.user_id },
                })
                const groups = Array.isArray(response.data?.groups) ? response.data.groups : []
                const liveGroups = groups.filter((group) => {
                    if (!group || typeof group.id !== "string") return false
                    if ((group.source_task_id || "") !== taskId) return false
                    if (pathId && (group.learning_path_id || "") !== pathId) return false
                    if (version != null && (group.learning_path_version ?? null) !== version) return false
                    if (chapterId && (group.source_chapter_id || "") !== chapterId) return false
                    if (day != null && group.source_day != null && group.source_day !== day) return false
                    return group.source_type === "concept_learning" || group.source_type === "ai_generated"
                })

                const liveGroupIds = new Set(liveGroups.map((group) => group.id))
                const missingLiveGroups = liveGroups.filter((group) => !exercisePreviewGroups.some((item) => item.id === group.id))

                const previews = await Promise.all(
                    missingLiveGroups.map(async (group) => {
                        const itemsResponse = await api.get<QuestionGroupItemsResponse>(
                            `/api/question-bank/groups/${group.id}/items`,
                            { params: { user_id: profile.user_id } }
                        )
                        const items = Array.isArray(itemsResponse.data?.items) ? itemsResponse.data.items : []
                        return {
                            id: group.id,
                            count: typeof group.item_count === "number" && group.item_count > 0 ? group.item_count : items.length,
                            target: buildQuestionBankTarget({
                                taskTitle,
                                taskDescription: searchParams.get("description") || "",
                                day,
                                taskId,
                                pathId,
                                version,
                                versionName,
                                chapterId: group.source_chapter_id || chapterId || `day-${day}`,
                                chapterTitle: group.source_chapter_title || chapterTitle || taskTitle,
                                subjectKey,
                                groupId: group.id,
                                entrySource: "concept-learning",
                                returnTo: currentConceptTarget,
                            }),
                            items: parseExercisePreviewFromCanonicalExercises(items),
                        } satisfies ExercisePreviewGroup
                    })
                )

                if (cancelled) return

                setExercisePreviewGroups((current) => {
                    const nextGroups = current.filter((group) => liveGroupIds.has(group.id))
                    const knownIds = new Set(nextGroups.map((group) => group.id))
                    for (const preview of previews) {
                        if (!knownIds.has(preview.id)) {
                            nextGroups.push(preview)
                            knownIds.add(preview.id)
                        }
                    }
                    if (
                        nextGroups.length === current.length
                        && nextGroups.every((group, index) => current[index]?.id === group.id)
                    ) {
                        return current
                    }
                    return nextGroups
                })
            } catch (error) {
                console.error("同步章节题组预览失败:", error)
            }
        }

        syncExercisePreviewGroups()

        return () => {
            cancelled = true
        }
    }, [
        chapterId,
        chapterTitle,
        day,
        exercisePreviewStorageKey,
        hasRestoredExercisePreview,
        pathId,
        profile?.user_id,
        restoredExercisePreviewKey,
        searchParams,
        subjectKey,
        taskId,
        taskTitle,
        currentConceptTarget,
        version,
        versionName,
    ])

    const conceptRequestPayload = useMemo(
        () => ({
            task_id: taskId || "",
            task_title: taskTitle,
            subject,
            description: searchParams.get("description") || "",
            duration_minutes: requestedDurationMinutes,
            resources: searchParams.get("resources")?.split(",").filter(Boolean) || [],
            ...conceptSourceScope,
        }),
        [conceptSourceScope, requestedDurationMinutes, searchParams, subject, taskId, taskTitle]
    )

    const generateContent = async () => {
        if (!profile?.user_id || !taskId || isGeneratingRef.current) return
        isGeneratingRef.current = true

        // Abort any existing stream from a previous chapter
        if (streamAbortRef.current) {
            streamAbortRef.current.abort()
        }
        const abortController = new AbortController()
        streamAbortRef.current = abortController

        // Stop any running placeholder
        if (placeholderTimerRef.current) {
            clearInterval(placeholderTimerRef.current)
            placeholderTimerRef.current = null
        }
        realMapContentStarted.current = false

        setLoading(true)
        setContent("")
        setReasoning("")
        setConceptMap(null)
        setMarkmapMarkdown("")
        setMarkmapStreamingText("")
        setIsMarkmapRevealed(false)
        if (markmapStreamTimerRef.current) {
            clearTimeout(markmapStreamTimerRef.current)
            markmapStreamTimerRef.current = null
        }

        setExerciseGenerationFeedback(null)
        setGenerationPhase("map")

        // ── Infinite placeholder typewriter ──
        // Large pool of varied lines that cycle until real LLM content arrives
        const title = conceptRequestPayload.task_title || "知识点"
        const topicPools = [
            [`# ${title}`, `## 基础概念`, `### 定义与特征`, `### 核心原理`, `## 基本语法`, `### 语法规则`, `### 使用方式`],
            [`## 进阶理解`, `### 关键区别`, `### 边界条件`, `## 实践应用`, `### 常见场景`, `### 代码示例`],
            [`## 常见问题`, `### 典型错误`, `### 调试技巧`, `## 最佳实践`, `### 性能优化`, `### 编码规范`],
            [`## 知识拓展`, `### 相关概念`, `### 技术演进`, `## 学习建议`, `### 练习方向`, `### 思维导图总结`],
        ]
        let poolIndex = 0
        let lineIndex = 0
        let charIndex = 0
        let currentText = ""

        const getNextLine = () => {
            const pool = topicPools[poolIndex % topicPools.length]
            const line = pool[lineIndex % pool.length]
            lineIndex++
            if (lineIndex >= pool.length) {
                lineIndex = 0
                poolIndex++
            }
            return line
        }

        let currentLine = getNextLine()

        // Type 2 chars per 35ms tick — fast enough to look alive
        placeholderTimerRef.current = setInterval(() => {
            if (realMapContentStarted.current) {
                if (placeholderTimerRef.current) {
                    clearInterval(placeholderTimerRef.current)
                    placeholderTimerRef.current = null
                }
                return
            }
            charIndex += 2
            if (charIndex >= currentLine.length) {
                // Finished current line, move to next
                currentText += currentLine + "\n"
                currentLine = getNextLine()
                charIndex = 0
            }
            setMarkmapStreamingText(currentText + currentLine.slice(0, charIndex))
        }, 35)

        try {
            await streamConceptContent(
                profile.user_id,
                conceptRequestPayload,
                {
                    onStart: () => { },
                    onMapStart: () => {
                        setGenerationPhase("map")
                    },
                    onMapContent: (text) => {
                        if (!realMapContentStarted.current) {
                            realMapContentStarted.current = true
                            if (placeholderTimerRef.current) {
                                clearInterval(placeholderTimerRef.current)
                                placeholderTimerRef.current = null
                            }
                        }
                        // Always append — real content flows after placeholder seamlessly
                        setMarkmapStreamingText(prev => prev + text)
                    },
                    onMapReady: ({ conceptMap: readyConceptMap, markmapMarkdown: readyMarkmapMarkdown }) => {
                        setConceptMap(readyConceptMap || null)
                        const fullMd = readyMarkmapMarkdown || ""
                        // Brief pause then transition to rendered markmap
                        markmapStreamTimerRef.current = setTimeout(() => {
                            setMarkmapMarkdown(fullMd)
                            setIsMarkmapRevealed(true)
                        }, 600)
                        setGenerationPhase("article")
                    },
                    onThinking: (text) => setReasoning(p => p + text),
                    onContent: (text) => setContent(p => p + text),
                    onDone: ({ conceptMap: doneConceptMap, markmapMarkdown: doneMarkmapMarkdown }) => {
                        setConceptMap(doneConceptMap || null)
                        setMarkmapMarkdown(doneMarkmapMarkdown || "")
                        // Ensure the markmap is visible when generation completes
                        if (doneMarkmapMarkdown) {
                            setIsMarkmapRevealed(true)
                        }
                        if (markmapStreamTimerRef.current) {
                            clearTimeout(markmapStreamTimerRef.current)
                            markmapStreamTimerRef.current = null
                        }
                        setGenerationPhase(null)
                        setLoading(false)
                        isGeneratingRef.current = false
                        if (placeholderTimerRef.current) {
                            clearInterval(placeholderTimerRef.current)
                            placeholderTimerRef.current = null
                        }
                    },

                    onError: (err) => {
                        setGenerationPhase(null)
                        setLoading(false)
                        isGeneratingRef.current = false
                        if (placeholderTimerRef.current) {
                            clearInterval(placeholderTimerRef.current)
                            placeholderTimerRef.current = null
                        }
                        if (markmapStreamTimerRef.current) {
                            clearTimeout(markmapStreamTimerRef.current)
                            markmapStreamTimerRef.current = null
                        }
                        setContent(`> ⚠️ 内容生成失败：${err}\n\n请尝试点击右上角"AI 定制内容"重新生成。`)
                        console.error("Content generation error:", err)
                    }
                },
                abortController.signal,
            )
        } catch (err) {
            setGenerationPhase(null)
            setLoading(false)
            isGeneratingRef.current = false
            if (placeholderTimerRef.current) {
                clearInterval(placeholderTimerRef.current)
                placeholderTimerRef.current = null
            }
            if (markmapStreamTimerRef.current) {
                clearTimeout(markmapStreamTimerRef.current)
                markmapStreamTimerRef.current = null
            }
            setContent(`> ⚠️ 网络连接失败，请检查网络后重试。`)
            console.error("Stream execution error:", err)
        }
    }

    // 重新生成（先删除缓存）
    const handleRegenerate = async () => {
        if (!profile?.user_id || !taskId) return
        await deleteConceptContent(profile.user_id, taskId, conceptSourceScope)
        generateContent()
    }

    // 完成学习：标记任务完成并返回学习路线
    const handleCompleteLearning = async () => {
        if (pathId && taskId) {
            try {
                await api.put(`/api/ai-learning-path/${pathId}/progress`, {
                    day,
                    task_id: taskId,
                    completed: true
                })
                updateTaskCompletion(subjectKey, day, taskId, true)
                // 发送章节完成通知
                useNotificationStore.getState().addNotification("chapter_complete")
            } catch (err) {
                console.error("更新学习任务进度失败:", err)
            }
        }
        navigate(learningPlanTarget)
    }

    // 首次加载：先检查缓存，无缓存则生成
    useEffect(() => {
        // Reset generation state for the new chapter
        setContent("")
        setReasoning("")
        setConceptMap(null)
        setMarkmapMarkdown("")
        setMarkmapStreamingText("")
        setIsMarkmapRevealed(false)
        setGenerationPhase(null)
        if (markmapStreamTimerRef.current) {
            clearTimeout(markmapStreamTimerRef.current)
            markmapStreamTimerRef.current = null
        }

        const loadContent = async () => {
            if (!profile?.user_id || !taskId) return

            setLoading(true)

            // 先尝试获取缓存
            const cached = await getCachedContent(profile.user_id, taskId, conceptSourceScope)

            if (cached?.exists && cached.content) {
                setContent(cached.content)
                setReasoning(cached.reasoning || "")
                setConceptMap(cached.concept_map || null)
                setMarkmapMarkdown(cached.markmap_markdown || "")
                setGenerationPhase(null)
                setLoading(false)
            } else {
                // 无缓存，调用生成
                generateContent()
            }
        }

        loadContent()

        // Cleanup: abort stream when this effect re-runs (chapter switch) or unmounts
        return () => {
            if (streamAbortRef.current) {
                streamAbortRef.current.abort()
                streamAbortRef.current = null
            }
            isGeneratingRef.current = false
            if (placeholderTimerRef.current) {
                clearInterval(placeholderTimerRef.current)
                placeholderTimerRef.current = null
            }
            if (markmapStreamTimerRef.current) {
                clearTimeout(markmapStreamTimerRef.current)
                markmapStreamTimerRef.current = null
            }
        }
    }, [conceptSourceScope, profile?.user_id, taskId])

    // 提取标题生成目录 (增强版：忽略代码块内的 # 注释)
    useEffect(() => {
        const lines = content.split('\n')
        const headers: { id: string, text: string, level: number }[] = []
        let inCodeBlock = false

        for (const line of lines) {
            const trimmed = line.trim()
            
            // 检测进入/退出代码块
            if (trimmed.startsWith('```')) {
                inCodeBlock = !inCodeBlock
                continue
            }

            // 只有在非代码块时才提取标题
            if (!inCodeBlock && trimmed.startsWith('#')) {
                const match = line.match(/^(#{1,3})\s*(.+)$/)
                if (match) {
                    const level = match[1].length
                    const text = match[2].trim()
                    if (text) {
                        headers.push({
                            level,
                            text,
                            id: normalizeHeadingKey(text)
                        })
                    }
                }
            }
        }
        setToc(headers)
    }, [content])

    const effectiveMarkmapMarkdown = useMemo(() => {
        let md = markmapMarkdown.trim()
        if (!md) {
            if (!taskTitle || toc.length === 0) return ""
            return buildFallbackMarkmapMarkdown(taskTitle, toc)
        }
        // Fix root heading if it looks like a code identifier (e.g. "# function_limit_definition")
        md = md.replace(/^#\s+([a-z][a-z0-9_]+)$/m, (_, id) => {
            return `# ${taskTitle || id.replace(/_/g, " ")}`
        })
        return md
    }, [markmapMarkdown, taskTitle, toc])

    // ── 构建章节摘要（从 concept map + TOC 提炼，用于传给 AI） ──
    const chapterSummary = useMemo(() => {
        const parts: string[] = []

        // 从 concept map 提取核心概念
        if (conceptMap?.chapter_order?.length) {
            parts.push(`章节结构: ${conceptMap.chapter_order.join(" → ")}`)
        }

        // 从 concept map nodes 提取每节摘要
        if (conceptMap?.nodes?.length) {
            const nodeSummaries = conceptMap.nodes
                .filter((n) => n.title && n.summary)
                .map((n) => `  - ${n.title}: ${n.summary}`)
                .slice(0, 12)
            if (nodeSummaries.length > 0) {
                parts.push(`知识点概述:\n${nodeSummaries.join("\n")}`)
            }
        }

        // 从 concept map 的 knowledge_skeleton（后端可能返回但 TS 接口未声明）
        const mapAny = conceptMap as Record<string, unknown> | null
        if (mapAny?.knowledge_skeleton) {
            const skeleton = mapAny.knowledge_skeleton
            if (typeof skeleton === "string" && skeleton.trim()) {
                parts.push(`知识骨架:\n${skeleton.slice(0, 1200)}`)
            } else if (typeof skeleton === "object") {
                parts.push(`知识骨架:\n${JSON.stringify(skeleton).slice(0, 1200)}`)
            }
        }

        // 从 TOC 提取目录结构
        const h2Items = toc.filter((h) => h.level === 2)
        if (h2Items.length > 0) {
            parts.push(`核心知识点: ${h2Items.map((h) => h.text).join("; ")}`)
        }
        const h3Items = toc.filter((h) => h.level === 3)
        if (h3Items.length > 0) {
            parts.push(`子知识点: ${h3Items.map((h) => h.text).join("; ")}`)
        }

        return parts.length > 0 ? parts.join("\n") : undefined
    }, [conceptMap, toc])

    // ── 同步学习上下文到 chat store（AI 面板始终感知） ──
    useEffect(() => {
        if (!taskId) return
        setLearningContext({
            subject,
            chapterTitle: chapterTitle || taskTitle,
            chapterSummary: chapterSummary,
            taskId,
        })
        return () => {
            setLearningContext(null)
        }
    }, [chapterSummary, chapterTitle, setLearningContext, subject, taskId, taskTitle])

    useEffect(() => {
        if (typeof window === "undefined") return
        if (!window.localStorage.getItem(CONCEPT_AI_ENTRY_HINT_KEY)) {
            setShowAiEntryHint(true)
        }
    }, [])

    const dismissAiEntryHint = () => {
        setShowAiEntryHint(false)
        if (typeof window !== "undefined") {
            window.localStorage.setItem(CONCEPT_AI_ENTRY_HINT_KEY, "1")
        }
    }

    const closeCodeSandbox = useCallback(() => {
        setShowCodeSandbox(false)
    }, [])

    const closeMobileMenu = useCallback(() => {
        setMobileMenuOpen(false)
    }, [])

    const openAiPanel = useCallback(() => {
        setChatOpen(true)
        setPanelCollapsed(false)
    }, [setChatOpen, setPanelCollapsed])

    useEffect(() => {
        if (!showCodeSandbox || typeof document === "undefined") return

        const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
        const dialog = codeSandboxDialogRef.current
        const focusableElements = getFocusableElements(dialog)
        ;(focusableElements[0] ?? dialog)?.focus()

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault()
                closeCodeSandbox()
                return
            }

            trapFocusWithin(event, dialog)
        }

        document.addEventListener("keydown", handleKeyDown)
        return () => {
            document.removeEventListener("keydown", handleKeyDown)
            previousActiveElement?.focus()
        }
    }, [closeCodeSandbox, showCodeSandbox])

    useEffect(() => {
        if (!mobileMenuOpen || typeof document === "undefined") return

        const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
        const dialog = mobileMenuDialogRef.current
        const focusableElements = getFocusableElements(dialog)
        ;(focusableElements[0] ?? dialog)?.focus()

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault()
                closeMobileMenu()
                return
            }

            trapFocusWithin(event, dialog)
        }

        document.addEventListener("keydown", handleKeyDown)
        return () => {
            document.removeEventListener("keydown", handleKeyDown)
            previousActiveElement?.focus()
        }
    }, [closeMobileMenu, mobileMenuOpen])



    const handleTextSelection = () => {
        if (!taskId) {
            setQuickAsk(null)
            return
        }

        const selection = window.getSelection()
        const selectedText = selection?.toString().trim() ?? ""
        if (!selection || !selectedText || selection.rangeCount === 0) {
            setQuickAsk(null)
            return
        }

        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()

        // 向上查找最近的标题元素来确定所属小节
        let sectionTitle = toc.find((item) => item.level <= 2)?.text ?? taskTitle
        let node: Node | null = range.startContainer
        while (node && node !== document.body) {
            const el = node instanceof HTMLElement ? node : node.parentElement
            if (el) {
                const heading = el.closest("h1, h2, h3") as HTMLElement | null
                if (heading) {
                    sectionTitle = heading.textContent?.trim() || sectionTitle
                    break
                }
                // 查找前面兄弟中最近的标题
                let prev = el.previousElementSibling
                while (prev) {
                    if (/^H[1-3]$/i.test(prev.tagName)) {
                        sectionTitle = prev.textContent?.trim() || sectionTitle
                        node = null // break outer
                        break
                    }
                    prev = prev.previousElementSibling
                }
                if (!node) break
            }
            node = node.parentNode
        }

        setQuickAsk({
            selectedText,
            sectionTitle,
            taskId,
            prompt: `我正在学习「${chapterTitle || taskTitle}」的「${sectionTitle}」部分，请基于我选中的内容进行讲解：${selectedText}`,
            x: rect.left + rect.width / 2,
            y: rect.bottom + 8
        })
    }

    const handleQuickAsk = () => {
        if (!quickAsk) return

        window.dispatchEvent(
            new CustomEvent<ContextQuickAskPayload>(CONTEXT_QUICK_ASK_EVENT, {
                detail: {
                    selectedText: quickAsk.selectedText,
                    sectionTitle: quickAsk.sectionTitle,
                    taskId: quickAsk.taskId,
                    prompt: quickAsk.prompt,
                    chapterSummary: chapterSummary,
                    chapterTitle: chapterTitle || taskTitle,
                    subject,
                }
            })
        )

        window.getSelection()?.removeAllRanges()
        setQuickAsk(null)
    }

    // ─── Exercise generation: progress bar + rotating tips ───
    useEffect(() => {
        if (!isGeneratingExercises) {
            setExerciseProgress(0)
            setExerciseTipIndex(0)
            setExerciseTipCharCount(0)
            return
        }

        // Simulated progress: ramp from 0→90 over ~12s
        let progress = 0
        const progressTimer = setInterval(() => {
            progress = Math.min(progress + Math.random() * 8 + 2, 90)
            setExerciseProgress(Math.round(progress))
        }, 800)

        // Typing tip carousel
        const tips = [
            "温馨提示：做完题后记得回顾错题，加深理解哦 📖",
            "小知识：分散练习比集中突击效果更好 🧠",
            "你知道吗？主动回忆比反复阅读更能巩固记忆 💡",
            "学习建议：尝试用自己的话复述知识点 ✍️",
            "有趣的是：教别人是最好的学习方式 🎓",
        ]
        let currentTip = exerciseTipIndex
        let charCount = 0
        let isWaiting = false

        const typeTimer = setInterval(() => {
            if (isWaiting) return

            const tipText = tips[currentTip]
            if (charCount < tipText.length) {
                charCount++
                setExerciseTipCharCount(charCount)
            } else {
                isWaiting = true
                setTimeout(() => {
                    currentTip = (currentTip + 1) % tips.length
                    setExerciseTipIndex(currentTip)
                    charCount = 0
                    setExerciseTipCharCount(0)
                    isWaiting = false
                }, 2000) // Pause for 2 seconds before the next tip
            }
        }, 80) // Type one character every 80ms

        return () => {
            clearInterval(progressTimer)
            clearInterval(typeTimer)
        }
    }, [isGeneratingExercises])

    const handleGenerateExercises = async () => {
        if (!profile?.user_id || !taskId || !content.trim() || isGeneratingExercises) return

        setIsGeneratingExercises(true)
        setExerciseGenerationFeedback(null)
        setExerciseReadyPrompt(null)

        try {
            const response = await generateConceptExercises(profile.user_id, {
                task_id: taskId,
                task_title: taskTitle,
                subject,
                subject_key: subjectKey,
                description: searchParams.get("description") || "",
                article_content: content,
                concept_map: conceptMap || undefined,
                ...conceptSourceScope,
            })

            if (!response.success) {
                setExerciseGenerationFeedback("本次未生成可保存的习题，请稍后重试。")
                setIsGeneratingExercises(false)
                return
            }

            const target = buildQuestionBankTarget({
                taskTitle,
                taskDescription: searchParams.get("description") || "",
                day,
                taskId,
                pathId,
                version,
                versionName,
                chapterId,
                chapterTitle,
                subjectKey,
                groupId: response.group_id,
                entrySource: "concept-learning",
                returnTo: currentConceptTarget,
            })

            const previewItems = Array.isArray(response.exercises) && response.exercises.length > 0
                ? parseExercisePreviewFromCanonicalExercises(response.exercises)
                : parseExercisePreview(response.raw_content || "")
            setExercisePreviewGroups((current) => {
                const previewGroupId = response.group_id || `${taskId}-${current.length + 1}`
                const nextGroup = {
                    id: previewGroupId,
                    count: response.exercises_count,
                    target,
                    items: previewItems,
                }
                const currentIndex = current.findIndex((group) => group.id === previewGroupId)
                if (currentIndex === -1) {
                    return [...current, nextGroup]
                }

                return current.map((group, index) => (index === currentIndex ? nextGroup : group))
            })

            setExerciseProgress(100)
            setExerciseGenerationFeedback(null)
            setExerciseReadyPrompt({
                count: response.exercises_count,
                target,
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : "未知错误"
            setExerciseGenerationFeedback(`生成习题失败：${message}`)
        } finally {
            setIsGeneratingExercises(false)
        }
    }

    return (
        <div data-testid="studio-concept-page" className={`${studioPageShellClass} min-h-screen bg-slate-50/90 font-sans text-slate-800`}>
            {/* Header */}
            <header
                ref={headerAnchorRef}
                data-testid="studio-concept-header"
                className={`${studioHeaderShellClass} sticky top-0 z-40 border-b border-slate-200/80 bg-slate-50/85 backdrop-blur-xl`}
            >
                <div
                    data-testid="concept-topbar"
                    className="relative mx-auto flex w-full min-h-[56px] items-center justify-between gap-6 px-4 xl:px-8 backdrop-blur"
                >
                    <div className="flex items-center gap-4 shrink-0">
                        <button
                            type="button"
                            className="flex items-center gap-2 text-left"
                            onClick={() => navigate(`/app/dashboard`)}
                        >
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 transition-colors hover:bg-teal-500/15">
                                <BookOpen className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-lg font-bold tracking-tight text-slate-900">概念学习文档</p>
                                <p className="text-[11px] uppercase tracking-[0.24em] text-teal-600">Adaptive Learning</p>
                            </div>
                        </button>

                        {/* Code Sandbox entry — between logo and center nav */}
                        {isEngineeringSubject && (
                            <button
                                onClick={() => setShowCodeSandbox(true)}
                                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:border-emerald-300"
                                aria-label="打开代码沙箱"
                                title="打开代码沙箱"
                            >
                                <Code className="h-3.5 w-3.5" />
                                <span>代码沙箱</span>
                            </button>
                        )}
                    </div>

                    <div className="hidden flex-1 items-center justify-center lg:flex overflow-hidden px-4">
                        <nav className="flex items-center gap-4 xl:gap-7 text-sm xl:text-base font-medium text-slate-500 whitespace-nowrap">
                            <button type="button" className="transition-colors hover:text-teal-600" onClick={() => navigate(learningPlanTarget)}>
                                学习路线主页
                            </button>
                            <button type="button" className="transition-colors hover:text-teal-600" onClick={() => navigate(`/app/dashboard`)}>
                                学习主页
                            </button>
                            <button type="button" className="transition-colors hover:text-teal-600" onClick={() => navigate(`/app/subject/${subjectKey}`)}>
                                我的科目
                            </button>
                            <button type="button" className="transition-colors hover:text-teal-600" onClick={() => navigate(`/app/studio/${subjectKey}`)}>
                                学习工作台
                            </button>
                            <button type="button" className="transition-colors hover:text-teal-600" onClick={() => navigate(`/app/profile`)}>
                                个人中心
                            </button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            className="hidden rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 sm:flex"
                            onClick={openAiPanel}
                            aria-label="AI 提问"
                        >
                            <Sparkles className="mr-2 h-4 w-4 text-teal-300" />
                            <span>AI 提问</span>
                        </button>

                        <button
                            className="p-2 text-slate-600 lg:hidden"
                            onClick={() => setMobileMenuOpen(true)}
                            aria-label="打开章节菜单"
                        >
                            <Menu className="h-6 w-6" />
                        </button>
                    </div>
                </div>
            </header>

            <div data-testid="concept-layout-shell" className="w-full mx-auto flex gap-2 h-[calc(100vh-56px)] overflow-hidden">
                {/* Left Sidebar */}
                <aside
                    data-testid="concept-layout-left"
                    className={`hidden xl:flex w-[300px] shrink-0 h-[calc(100vh-56px)] sticky top-14 flex-col overflow-y-auto border-r border-slate-200/80 bg-white/70 py-6 text-[18px] leading-[27px] ${studioSidebarShellClass}`}
                >
                    <div className="px-6 pb-4">
                        <div className="mb-1 flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-teal-600">{subject}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                {durationMinutes} min
                            </span>
                        </div>
                        <p className="text-base font-semibold text-slate-900">{taskTitle}</p>
                        <p className="mt-2 text-xs leading-relaxed tracking-normal break-words py-1 text-slate-500">
                            结构化概念讲解与章节导航集中在这一页完成。
                        </p>
                    </div>

                    <nav className="flex-1 px-4 py-4">
                        {chapterNavigationItems.length > 0 && (
                            <div className="mt-2">
                                <div className="flex items-center gap-3 px-3 py-2 text-base font-semibold text-teal-700">
                                    <BookOpen className="h-4 w-4" />
                                    <span>学习章节</span>
                                </div>
                                <div data-testid="concept-chapter-navigation" className="mt-2 space-y-1">
                                {chapterNavigationItems.map((item) => {
                                        const isActive = item.taskId === taskId && item.day === day
                                        const isLocked = loading && !isActive
                                        return (
                                            <button
                                                key={item.key}
                                                type="button"
                                                disabled={isLocked}
                                                title={isLocked ? "内容生成中，完成后可切换" : ""}
                                                onClick={() => {
                                                    if (!loading) navigate(item.target)
                                                }}
                                                className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm transition-colors ${
                                                    isActive
                                                        ? "bg-teal-50 font-semibold text-teal-700"
                                                        : isLocked
                                                        ? "cursor-not-allowed text-slate-300"
                                                        : "text-slate-500 hover:bg-slate-50 hover:text-teal-600"
                                                }`}
                                            >
                                                {item.label}
                                                {isLocked && (
                                                    <span className="ml-auto text-xs text-slate-300">🔒</span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="mt-8 border-t border-slate-200/80 pt-6">
                            <div className="flex items-center gap-3 px-3 py-2 text-base font-semibold text-teal-700">
                                <Lightbulb className="h-4 w-4" />
                                <span>核心概念</span>
                            </div>
                            <div id="concept-outline" className="ml-9 mt-2 space-y-1 border-l-2 border-teal-100">
                                <a className="block px-4 py-1.5 text-sm text-slate-500 transition-colors hover:text-teal-600" href="#concept-content">
                                    学习导读
                                </a>
                                {toc.filter(h => h.level === 2).map((heading, i) => (
                                    <a
                                        key={i}
                                        href={`#${heading.id}`}
                                        className={`block px-4 py-1.5 text-sm transition-colors ${
                                            i === 0
                                                ? "rounded-r-lg bg-teal-50/80 font-medium text-teal-700"
                                                : "text-slate-500 hover:text-teal-600"
                                        }`}
                                    >
                                        <InlineLatex text={`${i + 1}. ${heading.text.replace(/^#+\s*/, "")}`} />
                                    </a>
                                ))}
                            </div>
                        </div>


                    </nav>
                </aside>

                {/* Main Content Wrapper */}
                <div className="relative min-w-0 flex-1 h-full px-1">
                    <main
                        ref={mainRef}
                        data-testid="concept-layout-main"
                        className="custom-scrollbar h-full w-full px-3 py-8 md:px-5 xl:px-7 2xl:px-11 overflow-x-hidden overflow-y-auto scroll-smooth"
                    >
                    <article
                        data-testid="concept-article"
                        className="mb-12 w-full px-6 py-8 text-[18px] leading-[27px] prose prose-slate dark:prose-invert prose-p:leading-[27px] prose-li:leading-[27px] prose-headings:mt-12 prose-headings:mb-6 prose-pre:p-0 md:px-8 md:py-10"
                    >
                        <div
                            data-testid="concept-docs-hero"
                            className="mb-8 border-b border-slate-200/80 pb-6"
                        >
                            <h1 className="m-0 text-3xl md:text-[40px] font-bold tracking-tight text-slate-950">{taskTitle}</h1>
                            <p className="mt-4 text-[18px] md:text-[20px] leading-relaxed text-slate-500 max-w-3xl">
                                {searchParams.get("description")?.trim()
                                    || `围绕“${taskTitle}”展开结构化学习，阅读概念说明，并通过章节导航逐步掌握核心知识点。`}
                            </p>

                            <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-500">
                                <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">预计 {durationMinutes} 分钟</span>
                                <span className="rounded-full bg-teal-50 px-3 py-1.5 font-medium text-teal-700">AI 定制内容</span>
                            </div>
                        </div>

                        {showAiEntryHint && (
                            <div data-testid="concept-ai-entry-hint" className={`${studioPanelSurfaceClass} mb-4 flex items-center justify-between gap-3 px-4 py-3 not-prose`}>
                                <p className={`text-sm ${studioMutedTextClass}`}>
                                    可选中文本后使用“就这段提问”快速追问当前内容。
                                </p>
                                <button
                                    type="button"
                                    onClick={dismissAiEntryHint}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                >
                                    我知道了
                                </button>
                            </div>
                        )}

                        {/* Breadcrumb mobile */}
                        <div className="flex md:hidden items-center text-sm text-slate-500 mb-6 gap-2">
                            <button
                                type="button"
                                onClick={() => navigate(learningPlanTarget)}
                                className="rounded-sm text-left text-slate-500 transition-colors hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                            >
                                学习路线
                            </button>
                            <ChevronRight className="h-3 w-3" />
                            <span className="font-medium text-slate-900 dark:text-white">{taskTitle}</span>
                        </div>

                        {/* ── Mind Map: streaming markdown → rendered markmap ── */}
                        {(generationPhase === "map" || markmapStreamingText || effectiveMarkmapMarkdown) && (
                            <section
                                data-testid="concept-markmap-shell"
                                className="not-prose mb-8 overflow-hidden rounded-2xl border border-white/50 bg-gradient-to-br from-teal-100/55 via-white/72 to-sky-100/45 p-6 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.45)] backdrop-blur-2xl"
                            >
                                <div className="mb-4 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-teal-700">Chapter Map</p>
                                        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                                            {generationPhase === "map" && !markmapStreamingText
                                                ? "正在生成知识骨架…"
                                                : "先看知识骨架，再进入正文"}
                                        </h2>
                                    </div>
                                    {effectiveMarkmapMarkdown && (isMarkmapRevealed || (!loading && !markmapStreamingText)) && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setIsMarkmapFullscreen(true)}
                                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-slate-500 hover:bg-white/80 hover:text-teal-600 transition-colors"
                                                title="全屏查看"
                                            >
                                                <Maximize2 className="h-3 w-3" />
                                                <span className="hidden sm:inline">全屏查看</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Phase 1: real-time streaming markdown from LLM */}
                                {!isMarkmapRevealed && markmapStreamingText && (
                                    <div className="relative">
                                        {/* Top gradient fade */}
                                        <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-teal-50/80 via-teal-50/40 to-transparent z-10 rounded-t-2xl" />
                                        {/* Bottom gradient fade */}
                                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white/80 to-transparent z-10 rounded-b-2xl" />
                                        <pre
                                            className="max-h-[280px] overflow-y-auto rounded-2xl bg-white/70 backdrop-blur-sm p-5 font-mono text-sm leading-relaxed text-slate-700 whitespace-pre-wrap scroll-smooth"
                                            ref={(el) => { if (el) el.scrollTop = el.scrollHeight }}
                                        >
                                            {markmapStreamingText}
                                            <span className="inline-block w-2 h-4 bg-teal-500 animate-pulse ml-0.5 align-middle rounded-sm" />
                                        </pre>
                                    </div>
                                )}

                                {/* Phase 2: rendered markmap (after streaming animation completes) */}
                                {isMarkmapRevealed && effectiveMarkmapMarkdown && (
                                    <div className="animate-[fadeIn_0.5s_ease-out]">
                                        <ConceptMarkmap markdown={effectiveMarkmapMarkdown} />
                                    </div>
                                )}

                                {/* Phase 2b: non-generating (cached) content — show markmap directly */}
                                {!loading && !markmapStreamingText && !isMarkmapRevealed && effectiveMarkmapMarkdown && (
                                    <ConceptMarkmap markdown={effectiveMarkmapMarkdown} />
                                )}
                            </section>
                        )}



                        {/* Thinking Block */}
                        {reasoning && <ThinkingBlock content={reasoning} isStreaming={loading} />}

                        {/* AI Generation State — article skeleton */}
                        {loading && !content && generationPhase !== "map" && (
                            <div className="my-8 space-y-6 animate-pulse">
                                {/* Heading skeleton */}
                                <div className="h-7 w-3/5 rounded bg-slate-200/60" />
                                {/* Paragraph skeleton */}
                                <div className="space-y-2">
                                    <div className="h-4 w-full rounded bg-slate-100/80" />
                                    <div className="h-4 w-11/12 rounded bg-slate-100/80" />
                                    <div className="h-4 w-4/5 rounded bg-slate-100/80" />
                                </div>
                                {/* Sub-heading */}
                                <div className="h-6 w-2/5 rounded bg-slate-200/60 mt-4" />
                                {/* Paragraph skeleton */}
                                <div className="space-y-2">
                                    <div className="h-4 w-full rounded bg-slate-100/80" />
                                    <div className="h-4 w-5/6 rounded bg-slate-100/80" />
                                    <div className="h-4 w-3/4 rounded bg-slate-100/80" />
                                </div>
                            </div>
                        )}

                        {/* Content Rendering */}
                        <div id="concept-content" className="markdown-content text-slate-700 [counter-reset:h2-counter]" onMouseUp={handleTextSelection}>
                            {processedContent && (
                                <XMarkdown
                                    content={processedContent}
                                    components={markdownComponents}
                                    config={{ extensions: Latex() }}
                                    dompurifyConfig={{ ADD_ATTR: ['style'] }}
                                    openLinksInNewTab
                                />
                            )}

                            {loading && content && (
                                <span className="inline-block w-2 h-5 bg-teal-500 animate-pulse ml-1 align-middle rounded-sm" />
                            )}
                        </div>
                        <ContextQuickAsk
                            visible={Boolean(quickAsk)}
                            x={quickAsk?.x ?? 0}
                            y={quickAsk?.y ?? 0}
                            onAsk={handleQuickAsk}
                            onDismiss={() => setQuickAsk(null)}
                        />

                        {!loading && content && (
                            <div className="not-prose mt-14 w-full">
                                    {exercisePreviewGroups.length > 0 && (
                                        <section className="mb-6 rounded-2xl border border-slate-200/80 bg-white/85 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.5)] backdrop-blur-xl">
                                            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-600">
                                                        题目预览
                                                    </p>
                                                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                                                        已生成的题目会依次追加在这里
                                                    </h3>
                                                </div>
                                                <p className="text-sm leading-7 text-slate-500">
                                                    当前页面保留最近生成结果的预览，完整答题仍可进入动态题库。
                                                </p>
                                            </div>

                                            <div className="mt-6 space-y-6">
                                                {exercisePreviewGroups.map((group, groupIndex) => (
                                                    <article
                                                        key={group.id}
                                                        className="rounded-2xl border border-slate-200/80 bg-slate-50/90 p-5"
                                                    >
                                                        <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 md:flex-row md:items-center md:justify-between">
                                                            <div>
                                                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                                                    第 {groupIndex + 1} 组题目
                                                                </p>
                                                                <h4 className="mt-2 text-lg font-semibold text-slate-950">
                                                                    本组共生成 {group.count} 道题
                                                                </h4>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">
                                                                    预览
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => navigate(group.target)}
                                                                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                                                                >
                                                                    去做这组题
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="mt-5 space-y-4">
                                                            {group.items.map((item) => (
                                                                <div
                                                                    key={`${group.id}-${item.index}-${item.stem}`}
                                                                    className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm"
                                                                >
                                                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">
                                                                        第 {item.index} 题
                                                                    </p>
                                                                    <h5 className="mt-2 text-lg font-semibold leading-8 text-slate-950">
                                                                        <InlineLatex text={item.stem} />
                                                                    </h5>
                                                                    {item.prompt && (
                                                                        <div className="mt-3 text-sm leading-7 text-slate-600 prose prose-sm prose-slate max-w-none [&_.ant-md-ssr-paragraph]:my-2">
                                                                            <XMarkdown
                                                                                content={item.prompt}
                                                                                config={{ extensions: Latex() }}
                                                                                dompurifyConfig={{ ADD_ATTR: ['style'] }}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                    {item.options.length > 0 && (
                                                                        <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-600">
                                                                            {item.options.map((option) => (
                                                                                <li
                                                                                    key={`${group.id}-${item.index}-${option}`}
                                                                                    className="rounded-2xl bg-slate-50 px-4 py-2"
                                                                                >
                                                                                    <InlineLatex text={option} />
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </article>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {!isGeneratingExercises ? (
                                        <button
                                            type="button"
                                            data-testid="concept-generate-exercises"
                                            onClick={handleGenerateExercises}
                                            disabled={isGeneratingExercises}
                                            className="exercise-btn-idle group relative flex min-h-[72px] w-full max-w-[400px] mx-auto items-center justify-center gap-3 overflow-hidden rounded-2xl px-6 text-lg font-bold tracking-tight text-white mb-6"
                                        >
                                            {/* Shimmer sweep overlay */}
                                            <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                                                <span
                                                    className="absolute inset-0 opacity-30"
                                                    style={{
                                                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                                                        animation: 'exercise-shimmer-sweep 3s ease-in-out infinite',
                                                    }}
                                                />
                                            </span>
                                            {/* Floating particles */}
                                            <span className="pointer-events-none absolute inset-0">
                                                <span className="absolute left-[15%] top-[20%] h-1.5 w-1.5 rounded-full bg-white/30" style={{ animation: 'exercise-float-particle 3s ease-in-out infinite' }} />
                                                <span className="absolute left-[75%] top-[35%] h-1 w-1 rounded-full bg-white/25" style={{ animation: 'exercise-float-particle 3s ease-in-out 0.8s infinite' }} />
                                                <span className="absolute left-[50%] top-[65%] h-1 w-1 rounded-full bg-white/20" style={{ animation: 'exercise-float-particle 3s ease-in-out 1.6s infinite' }} />
                                            </span>
                                            <Sparkles className="relative z-10 h-5 w-5 text-white drop-shadow-md" />
                                            <span className="relative z-10 drop-shadow-sm">
                                                {exercisePreviewGroups.length > 0
                                                    ? "生成一组新的题目"
                                                    : "点我生成习题"}
                                            </span>
                                        </button>
                                    ) : (
                                        <div
                                            data-testid="concept-generate-exercises"
                                            className="w-full overflow-hidden rounded-2xl border border-teal-100/80 bg-[linear-gradient(135deg,rgba(240,253,250,0.96),rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-8 shadow-[0_28px_80px_-56px_rgba(15,23,42,0.4)] backdrop-blur-xl"
                                        >
                                            {/* Header */}
                                            <div className="flex items-center justify-center gap-3 mb-6">
                                                <div className="relative">
                                                    <div className="absolute inset-0 rounded-full border-2 border-teal-200/80" />
                                                    <Loader2 className="relative z-10 h-8 w-8 animate-spin text-teal-600" />
                                                </div>
                                                <h3 className="text-xl font-bold tracking-tight text-slate-900">
                                                    正在为你出题
                                                </h3>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="mx-auto w-full max-w-[360px] mb-5">
                                                <div className="h-2.5 w-full overflow-hidden rounded-full bg-teal-100/80">
                                                    <div
                                                        className="exercise-progress-bar h-full rounded-full bg-gradient-to-r from-teal-500 via-emerald-500 to-sky-500 shadow-[0_0_12px_rgba(20,184,166,0.28)] transition-all duration-500 ease-out"
                                                        style={{ width: `${exerciseProgress}%` }}
                                                    />
                                                </div>
                                                <p className="mt-2 text-center text-xs font-medium text-teal-700">{exerciseProgress}%</p>
                                            </div>

                                            {/* Typing tips */}
                                            <div className="h-12 overflow-hidden relative w-full flex justify-center items-center mb-3">
                                                <div className="text-center text-sm font-medium text-slate-700">
                                                    {(() => {
                                                        const tips = [
                                                            "温馨提示：做完题后记得回顾错题，加深理解哦 📖",
                                                            "小知识：分散练习比集中突击效果更好 🧠",
                                                            "你知道吗？主动回忆比反复阅读更能巩固记忆 💡",
                                                            "学习建议：尝试用自己的话复述知识点 ✍️",
                                                            "有趣的是：教别人是最好的学习方式 🎓",
                                                        ]
                                                        const currentTip = tips[exerciseTipIndex] || ""
                                                        return currentTip.substring(0, exerciseTipCharCount)
                                                    })()}
                                                    <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-teal-500 animate-pulse" />
                                                </div>
                                            </div>

                                            {/* Subtitle */}
                                            <p className="text-center text-xs text-slate-500">
                                                题目会自动保存到动态题库，保持在当前页面即可
                                            </p>
                                        </div>
                                    )}
                                    {exercisePreviewGroups.length > 0 && !isGeneratingExercises && (
                                        <p className="mt-3 text-center text-sm text-slate-500">
                                            继续生成后，新的一组题目会追加在当前预览下方。
                                        </p>
                                    )}
                                    {exerciseGenerationFeedback && (
                                        <p className="mt-3 text-center text-sm text-slate-500">{exerciseGenerationFeedback}</p>
                                    )}
                                </div>
                        )}

                        {/* Bottom Navigation */}
                        <div className="mt-16 flex items-center justify-between border-t border-slate-200/80 pt-8">
                            <button
                                onClick={() => navigate(learningPlanTarget)}
                                className="group flex flex-col items-start gap-1"
                            >
                                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 group-hover:text-teal-500 transition-colors">
                                    <ArrowLeft className="h-3 w-3" /> 返回路线
                                </span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                    AI 学习路线
                                </span>
                            </button>

                            {/* Regenerate Button */}
                            {!loading && content && (
                                <button
                                    onClick={handleRegenerate}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    重新生成内容
                                </button>
                            )}

                            <button
                                onClick={handleCompleteLearning}
                                className="group flex flex-col items-end gap-1"
                            >
                                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 group-hover:text-teal-500 transition-colors">
                                    完成学习 <ArrowRight className="h-3 w-3" />
                                </span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                    标记为已完成
                                </span>
                            </button>
                        </div>
                    </article>
                </main>

                {/* Scroll Controls */}
                <div className="absolute bottom-6 right-6 lg:bottom-10 lg:right-10 flex flex-col gap-2 z-[60]">
                    <button
                        onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                        className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200/80 dark:border-slate-700/80 shadow-[0_4px_12px_rgb(0,0,0,0.05)] text-slate-500 hover:text-teal-600 hover:border-teal-200 dark:hover:text-teal-400 dark:hover:border-teal-800 transition-all active:scale-95"
                        aria-label="回到顶部"
                        title="回到顶部"
                    >
                        <ArrowUpToLine className="h-4 w-4 md:h-[18px] md:w-[18px]" />
                    </button>
                    <button
                        onClick={() => mainRef.current?.scrollTo({ top: mainRef.current.scrollHeight, behavior: "smooth" })}
                        className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200/80 dark:border-slate-700/80 shadow-[0_4px_12px_rgb(0,0,0,0.05)] text-slate-500 hover:text-teal-600 hover:border-teal-200 dark:hover:text-teal-400 dark:hover:border-teal-800 transition-all active:scale-95"
                        aria-label="前往底部"
                        title="前往底部"
                    >
                        <ArrowDownToLine className="h-4 w-4 md:h-[18px] md:w-[18px]" />
                    </button>
                </div>
            </div>

            {/* Right Sidebar */}
                <aside
                    data-testid="concept-layout-right"
                    className="hidden 2xl:flex w-[300px] shrink-0 h-[calc(100vh-56px)] sticky top-14 flex-col overflow-y-auto border-l border-slate-200/80 bg-white/45 px-6 py-8 text-[18px] leading-[27px]"
                >
                    <div className="mb-8">
                        <h5 className="mb-6 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                            目录
                        </h5>
                        <ul className="space-y-3 border-l border-slate-200 pl-4 text-sm leading-[27px]">
                            {toc.filter(h => h.level >= 2 && h.level <= 3).map((item, i) => (
                                <li key={i}>
                                    <a
                                        href={`#${item.id}`}
                                        className={`block transition-colors ${item.level === 3 ? 'pl-4 text-xs text-slate-400' : 'font-semibold text-slate-700'} hover:text-teal-600`}
                                    >
                                        <InlineLatex text={item.text} />
                                    </a>
                                </li>
                            ))}
                        </ul>

                    </div>
                    <div className="mt-auto pt-8">
                        <div className="rounded-2xl border border-teal-100/50 bg-gradient-to-br from-teal-50/50 to-white/50 p-5 backdrop-blur-sm shadow-sm">
                            <div className="mb-3 flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                                    <Sparkles className="h-3 w-3" />
                                </div>
                                <span className="text-xs font-bold tracking-widest text-teal-800">学习向导</span>
                            </div>
                            <p className="mb-4 text-xs leading-5 text-teal-950/80">
                                当前内容由 AI 基于学习任务动态生成。阅读过程中，你可以选中文本快捷提问，AI 会结合当前章节上下文为你解答。
                            </p>
                            <div className="space-y-2.5 border-t border-teal-100/50 pt-4 text-xs font-medium text-teal-900/70">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5 text-teal-700/50" /> 预计阅读</span>
                                    <span className="text-teal-950">{durationMinutes} 分钟</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5"><List className="h-3.5 w-3.5 text-teal-700/50" /> 核心章节</span>
                                    <span className="text-teal-950">{toc.filter(h => h.level === 2).length || 1} 个</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Floating Action Button (Mobile) */}
            <button
                className="lg:hidden fixed bottom-6 left-6 h-14 w-14 bg-teal-500 hover:bg-teal-600 text-white rounded-full shadow-lg shadow-teal-500/30 flex items-center justify-center z-50 transition-transform active:scale-95"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="打开章节菜单"
            >
                <List className="h-6 w-6" />
            </button>

            {/* Mobile Code Sandbox Button — only for engineering subjects, visible on small screens */}
            {isEngineeringSubject && !showCodeSandbox && (
                <button
                    onClick={() => setShowCodeSandbox(true)}
                    className="sm:hidden fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 pl-3.5 pr-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
                    aria-label="打开代码沙箱"
                    title="打开代码沙箱"
                >
                    <Code className="h-4 w-4" />
                    <span>代码沙箱</span>
                </button>
            )}

            {isEngineeringSubject && showCodeSandbox && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center overscroll-none transition-all"
                    onClick={() => { closeCodeSandbox() }}
                    onWheel={(event) => event.stopPropagation()}
                >
                    <div
                        ref={codeSandboxDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="concept-code-sandbox-title"
                        tabIndex={-1}
                        className="overflow-auto overscroll-contain bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 ease-in-out w-full h-full rounded-none m-0 max-w-none max-h-none flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                        onWheel={(event) => event.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
                            <h2 id="concept-code-sandbox-title" className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Code className="w-5 h-5 text-emerald-500" />
                                代码沙箱
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                    边学边练
                                </span>
                            </h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={closeCodeSandbox}
                                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all"
                                    aria-label="关闭代码沙箱"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        {/* Body */}
                        <div className="flex-1 min-h-0 overscroll-contain p-3 sm:p-4 h-[calc(100vh-57px)]">
                            <Suspense
                                fallback={
                                    <div className="flex h-full items-center justify-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                    </div>
                                }
                            >
                                <CodeSandbox
                                    subjectKey={subjectKey}
                                    isFullscreen={true}
                                    fillContainer
                                    className="h-full"
                                    initialCode={sandboxInitialCodeRef.current?.code}
                                    initialLanguage={sandboxInitialCodeRef.current?.language}
                                    initialCells={sandboxInitialCellsRef.current}
                                />
                            </Suspense>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="fixed inset-0 bg-slate-950/18 backdrop-blur-sm transition-opacity" onClick={closeMobileMenu} />
                    <aside
                        ref={mobileMenuDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="concept-mobile-menu-title"
                        tabIndex={-1}
                        className="fixed right-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-900 shadow-xl border-l border-slate-200 dark:border-slate-800 p-6 overflow-y-auto transform transition-transform duration-300"
                    >
                        <div className="flex items-center justify-between mb-8">
                            <span id="concept-mobile-menu-title" className="font-bold text-lg text-slate-900 dark:text-white">章节导航菜单</span>
                            <button onClick={closeMobileMenu} className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-white" aria-label="关闭章节菜单">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <nav className="space-y-6">
                            <button onClick={() => navigate(learningPlanTarget)} className="flex items-center gap-3 text-slate-600 dark:text-slate-400 font-medium">
                                <Home className="h-5 w-5" />
                                <span>学习路线主页</span>
                            </button>

                            <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-4">当前章节</span>
                                <div className="text-teal-600 dark:text-teal-400 font-medium flex items-center gap-2">
                                    <BookOpen className="h-4 w-4" />
                                    {taskTitle}
                                </div>
                            </div>
                        </nav>
                    </aside>
                </div>
            )}

            {isMarkmapFullscreen && effectiveMarkmapMarkdown && (
                <div className="fixed inset-0 z-[70] bg-slate-950/75 backdrop-blur-md">
                    <div className="flex h-full flex-col p-4 md:p-8">
                        <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/70 px-5 py-4 text-white">
                            <div>
                                <p className="text-xs uppercase tracking-[0.24em] text-teal-300">Chapter Map</p>
                                <h3 className="mt-1 text-2xl font-semibold">{taskTitle}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMarkmapFullscreen(false)}
                                className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                            >
                                关闭全屏
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-white/95 p-4 shadow-2xl">
                            <ConceptMarkmap markdown={effectiveMarkmapMarkdown} heightClass="h-[calc(100vh-220px)]" />
                        </div>
                    </div>
                </div>
            )}

            {exerciseReadyPrompt && (
                <div className="fixed bottom-6 right-6 z-[68] w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.5)] backdrop-blur-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-600">题目已就绪</p>
                    <h4 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
                        已生成 {exerciseReadyPrompt.count} 道题，并保存至动态题库
                    </h4>
                    <p className="mt-2 text-sm leading-7 text-slate-500">
                        你可以继续阅读当前文档，也可以立刻进入做题。
                    </p>
                    <div className="mt-5 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setExerciseReadyPrompt(null)}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
                        >
                            稍后再做
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                navigate(exerciseReadyPrompt.target)
                                setExerciseReadyPrompt(null)
                            }}
                            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                        >
                            立刻进入做题
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
