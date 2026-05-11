import { useState, useEffect, useRef, useCallback } from "react"
import {
  MessageSquare, Lightbulb, BookOpen, ChevronRight, ChevronLeft,
  Send, RefreshCw, Brain, ChevronDown, Loader2,
  StopCircle, Sparkles,
} from "lucide-react"
import { Bubble } from "@ant-design/x"
import { XMarkdown } from "@ant-design/x-markdown"
import Latex from "@ant-design/x-markdown/plugins/Latex"
import "@ant-design/x-markdown/es/XMarkdown/index.css"
import "@/styles/x-markdown-overrides.css"
import InlineLatex from "@/components/ui/InlineLatex"
import { useChatStore, type ChatMessage } from "@/stores/chat"
import { useAuthStore } from "@/stores/auth"
import { streamChat } from "@/lib/streamChat"
import { cn } from "@/lib/utils"

interface ExplanationData {
  success: boolean
  explanation?: string | null
  key_points?: string[] | null
  similar_examples?: string[] | null
  error?: string | null
}

export interface PracticeAIPanelProps {
  currentQuestion: {
    id: string
    hints?: string[] | null
    question_type: string
    stem: string
  }
  explanation: ExplanationData | null
  isExplanationLoading: boolean
  onGetExplanation: () => void
  onGetHint?: (questionId: string, hintLevel: number) => Promise<{ hint_text: string } | null>
  collapsed: boolean
  onToggleCollapse: () => void
  /** When true, the parent wants us to open the hints tab (e.g. from sidebar click) */
  forceHintsTab?: boolean
}

function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(true)
  if (!content) return null
  return (
    <div className="mb-3 w-full">
      <button
        onClick={() => setExpanded(!expanded)}
        className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[oklch(45%_0.09_220)] transition-colors hover:text-[oklch(38%_0.1_220)] dark:text-[oklch(78%_0.09_220)]"
      >
        <Brain className="h-3.5 w-3.5" strokeWidth={1.8} />
        <span>思考链</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", !expanded && "-rotate-90")} />
        {isStreaming && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[oklch(55%_0.1_220)] animate-pulse" />}
      </button>
      {expanded && (
        <div className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-3 font-mono text-[10px] italic leading-relaxed text-slate-500 dark:border-white/5 dark:bg-slate-800/50 dark:text-slate-400">
          {content}
          {isStreaming && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-[oklch(55%_0.1_220)]/30 align-middle" />}
        </div>
      )}
    </div>
  )
}

function isUser(msg: ChatMessage) {
  return msg.role === "user"
}

export function PracticeAIPanel({
  currentQuestion, explanation, isExplanationLoading,
  onGetExplanation: _onGetExplanation, onGetHint, collapsed, onToggleCollapse,
  forceHintsTab,
}: PracticeAIPanelProps) {
  const profile = useAuthStore((s) => s.profile)
  const {
    messages, currentSessionId, isStreaming,
    addMessage, clearMessages, setSessionId,
    setIsStreaming, updateLastMessage, appendToLastMessage,
  } = useChatStore()

  const [activeTab, setActiveTab] = useState<"chat" | "hints" | "explanation">("chat")
  const [chatInput, setChatInput] = useState("")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [hintIndex, setHintIndex] = useState(-1)
  const [isHintLoading, setIsHintLoading] = useState(false)
  const extraHintsRef = useRef<string[]>([])
  const nextHintLevelRef = useRef(1)
  const currentQuestionIdRef = useRef(currentQuestion.id)

  // Streaming explanation state
  const [streamExplanation, setStreamExplanation] = useState("")
  const [streamExplanationReasoning, setStreamExplanationReasoning] = useState("")
  const [isExplanationStreaming, setIsExplanationStreaming] = useState(false)
  const explanationAbortRef = useRef<AbortController | null>(null)
  const explanationQuestionIdRef = useRef<string | null>(null)

  const localHints = currentQuestion.hints && currentQuestion.hints.length > 0
    ? currentQuestion.hints
    : ["仔细审题，注意题目中的关键词", "尝试用排除法缩小选项范围", "回忆一下相关的知识点"]
  const allHints = [...localHints, ...extraHintsRef.current]

  // Handle forceHintsTab from parent (sidebar click when collapsed)
  useEffect(() => {
    if (forceHintsTab && !collapsed) {
      setActiveTab("hints")
      if (hintIndex < 0) handleNextHintRef.current?.()
    }
  }, [forceHintsTab, collapsed, hintIndex])

  const handleNextHintRef = useRef<(() => void) | null>(null)



  useEffect(() => {
    currentQuestionIdRef.current = currentQuestion.id
    setHintIndex(-1)
    extraHintsRef.current = []
    nextHintLevelRef.current = 1
    // Reset streaming explanation when question changes
    setStreamExplanation("")
    setStreamExplanationReasoning("")
    setIsExplanationStreaming(false)
    explanationAbortRef.current?.abort()
    explanationAbortRef.current = null
    explanationQuestionIdRef.current = null
  }, [currentQuestion.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    return () => {
      abortRef.current?.abort(); abortRef.current = null
      explanationAbortRef.current?.abort(); explanationAbortRef.current = null
    }
  }, [])

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const prompt = chatInput.trim()
    if (!prompt || isStreaming || !profile?.user_id) return

    addMessage({ role: "user", content: prompt })
    setChatInput("")
    addMessage({ role: "ai", content: "", reasoning: "", isStreaming: true })
    setIsStreaming(true)
    abortRef.current = new AbortController()

    try {
      await streamChat(profile.user_id, {
        session_id: currentSessionId || undefined,
        message: prompt,
        context: {
          user_ability_tags: profile.ability_tags || {},
          exercise_id: currentQuestion.id,
          question_stem: currentQuestion.stem,
          question_type: currentQuestion.question_type,
        },
      }, {
        onSession: (id) => { if (!currentSessionId) setSessionId(id) },
        onThinking: (c) => appendToLastMessage("", c),
        onContent: (c) => appendToLastMessage(c),
        onDone: () => {
          updateLastMessage({ isStreaming: false })
          setIsStreaming(false)
          abortRef.current = null
        },
        onError: (err) => {
          updateLastMessage({ content: `[错误] ${err}`, isStreaming: false })
          setIsStreaming(false)
          abortRef.current = null
        },
      })
    } catch (err) {
      updateLastMessage({ content: `[错误] ${err instanceof Error ? err.message : String(err)}`, isStreaming: false })
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
    updateLastMessage({ isStreaming: false })
  }

  // Streaming explanation handler
  const handleStreamExplanation = useCallback(async () => {
    if (!profile?.user_id || isExplanationStreaming) return

    const targetId = currentQuestion.id
    explanationQuestionIdRef.current = targetId

    // Reset state
    setStreamExplanation("")
    setStreamExplanationReasoning("")
    setIsExplanationStreaming(true)
    explanationAbortRef.current = new AbortController()

    const prompt = `请详细讲解这道题目，包括：
1. 解题思路和关键知识点
2. 逐步分析解答过程
3. 总结核心要点和易错点`

    try {
      let localContent = ""
      let localReasoning = ""

      await streamChat(profile.user_id, {
        session_id: currentSessionId || undefined,
        message: prompt,
        context: {
          user_ability_tags: profile.ability_tags || {},
          exercise_id: currentQuestion.id,
          question_stem: currentQuestion.stem,
          question_type: currentQuestion.question_type,
        },
      }, {
        onSession: (id) => { if (!currentSessionId) setSessionId(id) },
        onThinking: (chunk) => {
          if (explanationQuestionIdRef.current !== targetId) return
          localReasoning += chunk
          setStreamExplanationReasoning(localReasoning)
        },
        onContent: (chunk) => {
          if (explanationQuestionIdRef.current !== targetId) return
          localContent += chunk
          setStreamExplanation(localContent)
        },
        onDone: () => {
          if (explanationQuestionIdRef.current !== targetId) return
          setIsExplanationStreaming(false)
          explanationAbortRef.current = null
        },
        onError: (err) => {
          if (explanationQuestionIdRef.current !== targetId) return
          setStreamExplanation((prev) => prev + `\n\n[错误] ${err}`)
          setIsExplanationStreaming(false)
          explanationAbortRef.current = null
        },
      })
    } catch (err) {
      if (explanationQuestionIdRef.current === targetId) {
        setStreamExplanation(`[错误] ${err instanceof Error ? err.message : String(err)}`)
        setIsExplanationStreaming(false)
        explanationAbortRef.current = null
      }
    }
  }, [currentQuestion, currentSessionId, isExplanationStreaming, profile, setSessionId])

  const handleStopExplanation = useCallback(() => {
    explanationAbortRef.current?.abort()
    explanationAbortRef.current = null
    setIsExplanationStreaming(false)
  }, [])

  const handleNextHint = async () => {
    const targetId = currentQuestion.id
    const nextIdx = hintIndex + 1
    if (nextIdx < allHints.length) {
      setHintIndex(nextIdx)
      return
    }
    if (!onGetHint) { setHintIndex(0); return }
    setIsHintLoading(true)
    try {
      const result = await onGetHint(targetId, nextHintLevelRef.current)
      if (currentQuestionIdRef.current !== targetId) return
      if (result?.hint_text) {
        extraHintsRef.current = [...extraHintsRef.current, result.hint_text]
        nextHintLevelRef.current += 1
        setHintIndex(nextIdx)
      } else {
        setHintIndex(0)
      }
    } catch {
      if (currentQuestionIdRef.current === targetId) { setHintIndex(0) }
    } finally {
      if (currentQuestionIdRef.current === targetId) setIsHintLoading(false)
    }
  }

  // Keep ref in sync for forceHintsTab effect
  handleNextHintRef.current = handleNextHint

  const tabs = [
    { key: "chat" as const, label: "对话", icon: MessageSquare },
    { key: "hints" as const, label: "提示", icon: Lightbulb },
    { key: "explanation" as const, label: "讲解", icon: BookOpen },
  ]

  // Whether the explanation tab has content (streamed or legacy)
  const hasStreamedExplanation = streamExplanation.length > 0 || isExplanationStreaming

  return (
    <div className={cn(
      "relative flex-shrink-0 h-full transition-all duration-300 ease-in-out",
      collapsed ? "w-0" : "w-full"
    )}>
      <button
        onClick={onToggleCollapse}
        className="absolute -left-5 top-1/2 z-30 flex h-16 w-5 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:text-slate-900 dark:border-white/5 dark:bg-slate-800 dark:hover:text-white"
      >
        {collapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>

      {!collapsed && (
        <div className="flex h-full w-full flex-col overflow-hidden border-l border-slate-200 bg-white dark:border-white/5 dark:bg-slate-900">
          {/* Header */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 py-3 dark:border-white/5 dark:bg-slate-900">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-[oklch(97%_0.022_165)] text-[oklch(45%_0.11_165)] dark:border-slate-700 dark:bg-[oklch(26%_0.03_165)] dark:text-[oklch(80%_0.11_165)]">
                <Sparkles className="h-4 w-4" strokeWidth={1.6} />
              </div>
              <div>
                <div className="font-display text-[14px] font-semibold tracking-tight text-slate-900 dark:text-white">AI 助教</div>
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">智能答疑</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex-shrink-0 border-b border-slate-50 px-4 py-2 dark:border-white/5">
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/50">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setActiveTab(t.key)
                    if (t.key === "hints" && hintIndex < 0) handleNextHint()
                  }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12px] font-medium transition-all",
                    activeTab === t.key
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
                  )}
                >
                  <t.icon size={13} strokeWidth={1.8} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden relative flex flex-col">


            {/* Chat Tab */}
            {activeTab === "chat" && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                  {messages.map((msg, i) => (
                    <div key={i} className={cn("flex flex-col", isUser(msg) ? "items-end" : "items-start")}>
                      {!isUser(msg) && msg.reasoning && (
                        <div className="w-full max-w-[90%]">
                          <ThinkingBlock content={msg.reasoning} isStreaming={msg.isStreaming} />
                        </div>
                      )}
                      {!isUser(msg) ? (
                        <Bubble
                          variant="borderless"
                          className="max-w-[95%] !p-0"
                          content={msg.content || (msg.isStreaming && !msg.reasoning ? "..." : "")}
                          contentRender={(content: string) => (
                            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-white/5 rounded-2xl px-4 py-3 shadow-sm">
                              <XMarkdown
                                className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 x-markdown-light dark:x-markdown-dark"
                                content={content}
                                config={{ extensions: Latex() }}
                                dompurifyConfig={{ ADD_ATTR: ['style'] }}
                              />
                            </div>
                          )}
                        />
                      ) : (
                        <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-slate-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900">
                          {msg.content}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-white/5 space-y-2 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div />
                    <button onClick={clearMessages} disabled={isStreaming} className="text-[10px] font-bold text-slate-400 hover:text-red-500 flex items-center gap-1 disabled:opacity-50">
                      <RefreshCw size={10} /> 清空
                    </button>
                  </div>
                  <form onSubmit={handleSend} className="relative">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="询问关于这道题的问题..."
                      disabled={!profile?.user_id || isStreaming}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-3.5 pr-10 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[oklch(55%_0.1_165)] focus:ring-2 focus:ring-[oklch(55%_0.1_165)]/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-600"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {isStreaming ? (
                        <button type="button" onClick={handleStop} className="flex h-8 w-8 items-center justify-center rounded-lg text-[oklch(55%_0.15_25)] transition-all hover:bg-[oklch(97%_0.022_25)]">
                          <StopCircle size={16} />
                        </button>
                      ) : (
                        <button type="submit" disabled={!chatInput.trim() || !profile?.user_id} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white transition-all hover:bg-slate-800 disabled:bg-slate-200 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">
                          <Send size={14} />
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </>
            )}

            {/* Hints Tab */}
            {activeTab === "hints" && (
              <div className="flex flex-1 flex-col p-4">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                    <Lightbulb size={14} className="text-[oklch(45%_0.11_165)] dark:text-[oklch(80%_0.11_165)]" strokeWidth={1.8} />
                    <span>分阶段提示</span>
                  </div>
                  {hintIndex >= 0 ? (
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[oklch(45%_0.11_165)] dark:text-[oklch(80%_0.11_165)]">
                        提示 {hintIndex + 1}
                      </div>
                      <div className="prose prose-sm max-w-none text-[13px] leading-relaxed text-slate-700 dark:prose-invert dark:text-slate-200">
                        <XMarkdown
                          className="x-markdown-light dark:x-markdown-dark"
                          content={allHints[hintIndex] ?? allHints[0]}
                          config={{ extensions: Latex() }}
                          dompurifyConfig={{ ADD_ATTR: ['style'] }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-white/5 dark:bg-white/[0.02]">
                      <Lightbulb className="mb-3 text-slate-300 dark:text-slate-600" size={24} strokeWidth={1.5} />
                      <p className="text-[13px] text-slate-500">点击下方按钮获取第一条提示。</p>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 space-y-2 pt-4">
                  <button
                    onClick={handleNextHint}
                    disabled={isHintLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white py-2.5 text-[13px] font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {isHintLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} strokeWidth={1.8} />}
                    {hintIndex === -1 ? "获取提示" : "换个提示"}
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("explanation")
                      if (!hasStreamedExplanation && !isExplanationLoading) {
                        handleStreamExplanation()
                      }
                    }}
                    className="w-full rounded-xl py-2.5 text-[13px] text-slate-500 transition-colors hover:text-slate-900 dark:hover:text-white"
                  >
                    直接看讲解
                  </button>
                </div>
              </div>
            )}

            {/* Explanation Tab - Streaming */}
            {activeTab === "explanation" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {hasStreamedExplanation ? (
                  // Streaming explanation content
                  <div className="space-y-4">
                    {/* Thinking block */}
                    {streamExplanationReasoning && (
                      <ThinkingBlock
                        content={streamExplanationReasoning}
                        isStreaming={isExplanationStreaming}
                      />
                    )}

                    {/* Main explanation content */}
                    {streamExplanation ? (
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="prose dark:prose-invert prose-sm max-w-none text-slate-600 dark:text-slate-300 leading-relaxed">
                          <XMarkdown
                            className="x-markdown-light dark:x-markdown-dark"
                            content={streamExplanation}
                            config={{ extensions: Latex() }}
                            dompurifyConfig={{ ADD_ATTR: ['style'] }}
                            openLinksInNewTab
                          />
                          {isExplanationStreaming && (
                            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-[oklch(55%_0.11_165)]/50 align-middle" />
                          )}
                        </div>
                      </div>
                    ) : isExplanationStreaming ? (
                      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                        <Loader2 className="h-5 w-5 animate-spin text-[oklch(50%_0.1_165)]" />
                        <span className="text-[13px] text-slate-500">正在生成讲解…</span>
                      </div>
                    ) : null}

                    {/* Stop / Regenerate buttons */}
                    <div className="flex justify-center pt-2">
                      {isExplanationStreaming ? (
                        <button
                          onClick={handleStopExplanation}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                        >
                          <StopCircle size={14} />
                          停止生成
                        </button>
                      ) : (
                        <button
                          onClick={handleStreamExplanation}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[13px] font-medium text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <RefreshCw size={14} strokeWidth={1.8} />
                          重新生成
                        </button>
                      )}
                    </div>
                  </div>
                ) : isExplanationLoading ? (
                  // Legacy loading (fallback)
                  <div className="flex h-full flex-col items-center justify-center gap-4">
                    <Loader2 className="h-6 w-6 animate-spin text-[oklch(50%_0.1_165)]" />
                    <p className="text-[13px] text-slate-500 dark:text-slate-400">正在生成详细讲解…</p>
                  </div>
                ) : explanation?.success ? (
                  // Legacy explanation display (fallback)
                  <div className="space-y-4">
                    {explanation.explanation && (
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="prose dark:prose-invert prose-sm max-w-none text-slate-600 dark:text-slate-300 leading-relaxed">
                          <XMarkdown
                            className="x-markdown-light dark:x-markdown-dark"
                            content={explanation.explanation}
                            config={{ extensions: Latex() }}
                            dompurifyConfig={{ ADD_ATTR: ['style'] }}
                            openLinksInNewTab
                          />
                        </div>
                      </div>
                    )}
                    {explanation.key_points && explanation.key_points.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(45%_0.11_165)] dark:text-[oklch(80%_0.11_165)]">
                          <Lightbulb size={12} strokeWidth={1.8} /> 核心知识点
                        </div>
                        <ul className="space-y-1.5">
                          {explanation.key_points.map((p, i) => (
                            <li key={i} className="flex items-start gap-2 text-[12px] text-slate-600 dark:text-slate-400">
                              <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[oklch(55%_0.11_165)]" />
                              <InlineLatex text={p} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {explanation.similar_examples && explanation.similar_examples.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(45%_0.09_220)] dark:text-[oklch(80%_0.1_220)]">
                          <BookOpen size={12} strokeWidth={1.8} /> 举一反三
                        </div>
                        {explanation.similar_examples.map((ex, i) => (
                          <div key={i} className="prose prose-sm max-w-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-600 shadow-sm dark:prose-invert dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                            <XMarkdown
                              className="x-markdown-light dark:x-markdown-dark"
                              content={ex}
                              config={{ extensions: Latex() }}
                              dompurifyConfig={{ ADD_ATTR: ['style'] }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : explanation && !explanation.success ? (
                  <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm">
                    {explanation.error || "讲解生成失败"}
                  </div>
                ) : (
                  // Empty state - prompt to get explanation
                  <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                    <BookOpen className="text-slate-300 dark:text-slate-600" size={28} strokeWidth={1.5} />
                    <p className="text-[13px] text-slate-500">点击下方按钮获取 AI 详细讲解</p>
                    <button
                      onClick={handleStreamExplanation}
                      disabled={!profile?.user_id}
                      className="rounded-xl bg-slate-900 px-5 py-2.5 text-[13px] font-medium text-white ring-1 ring-slate-900/5 transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:ring-slate-100/10 dark:hover:bg-white"
                    >
                      获取讲解
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
