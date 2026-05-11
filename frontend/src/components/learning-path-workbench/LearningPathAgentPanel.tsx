import { useMemo, useState, useRef, useEffect } from "react"
import { Loader2, Send, ChevronLeft, ChevronRight, ChevronDown, Sparkles, CheckCircle2, ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { AgentMessage, LearningPathMap, PreferenceSnapshotPayload, ReadyCheck } from "@/lib/learningPathWorkbench"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth"
import { StarMapPreferencesPopover } from "./StarMapPreferencesPopover"

function SupplementInfoPopover({ texts = [] }: { texts?: string[] }) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  if (!texts || texts.length === 0) return null

  return (
    <div className={cn("relative", open && "z-50")} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all select-none shrink-0",
          open
            ? "border-amber-300 bg-amber-50 text-amber-700 shadow-sm"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:shadow-sm",
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>补充信息</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 origin-top-right animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-black/5">
            <div className="mb-3">
              <span className="text-sm font-semibold text-slate-900">补充信息详情</span>
            </div>
            <div className="flex flex-col gap-1.5 mt-1">
              {texts.map((line, i) => (
                <div key={i} className="flex gap-1.5 text-xs text-slate-600 leading-relaxed">
                  <span className="shrink-0 text-slate-400 font-medium font-mono text-right w-3.5">{i + 1}.</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type Props = {
  messages: AgentMessage[]
  sessionStatus: string
  readyCheck: ReadyCheck | null
  replying: boolean
  generating: boolean
  map: LearningPathMap | null
  preferences: PreferenceSnapshotPayload
  onSend: (content: string) => Promise<void>
  onGenerate: () => Promise<void>
  onRemovePreference?: (nodeId: string) => void
  onBack?: () => void
}

export function LearningPathAgentPanel({
  messages,
  sessionStatus,
  readyCheck,
  replying,
  generating,
  map,
  preferences,
  onSend,
  onGenerate,
  onRemovePreference,
  onBack,
}: Props) {
  const profile = useAuthStore((s: any) => s.profile)
  const [draft, setDraft] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  )
  const latestStructuredPayload = latestAssistantMessage?.structured_payload as
    | { quick_options?: string[]; mode?: string }
    | undefined
  const isOpenSupplementMode = latestStructuredPayload?.mode === "open_supplement"

  // Keys that overlap with the StarMapPreferences popover — filter them out
  const FILTERED_PROGRESS_KEYS = ['重点范围', '暂不学习', '补充信息']

  const supplementTexts = useMemo(() => {
    // Find the first time the AI presented generation options ("已具备生成条件")
    const convergenceIdx = messages.findIndex(
      (m) =>
        m.role === "assistant" &&
        Array.isArray(m.structured_payload?.quick_options) &&
        m.structured_payload.quick_options.some((opt: string) => opt.includes("生成"))
    )

    // Capture explicitly requested fine-tunings
    const refineMsgs = messages.filter((m, idx) => {
      if (m.role !== "user") return false
      // Treat as refine message if it's after convergence OR it explicitly has the fine-tune prefix
      return (convergenceIdx !== -1 && idx > convergenceIdx) || m.content.includes("我想再微调一下重点") || m.content.includes("补充信息")
    }).map(m => m.content.replace(/^(我想再微调一下重点|补充信息)[：:]\s*/, "").trim())
      .filter(content => {
        if (!content) return false
        // Filter out simple affirmative responses that don't add actual info
        if (/^(没问题|可以|是的|确认|直接生成|生成|好|不需要|无|没有)/.test(content) && content.length < 25 && !content.includes("微调") && !content.includes("补充")) {
          return false
        }
        return true
      })

    return Array.from(new Set(refineMsgs))
  }, [messages])

  const parseProgress = () => {
    if (!readyCheck?.summary) return []
    if (!readyCheck.summary.includes(';') && !readyCheck.summary.includes('；')) {
      return [{ key: '任务状态', value: readyCheck.summary, isPending: false }]
    }
    return readyCheck.summary.split(/[;；]/).map((s: string) => s.trim()).filter(Boolean).map((part: string) => {
      const splitIdx = part.indexOf(':') !== -1 ? part.indexOf(':') : part.indexOf('：')
      if (splitIdx !== -1) {
        const key = part.slice(0, splitIdx).trim()
        const value = part.slice(splitIdx + 1).trim()
        const isPending = value.includes('待补充') || value.includes('待确认') || value.includes('未完成')
        return { key, value, isPending }
      }
      return null
    }).filter(Boolean).filter((item) => !FILTERED_PROGRESS_KEYS.includes(item!.key)) as { key: string; value: string; isPending: boolean }[]
  }

  const progressItems = useMemo(() => parseProgress(), [readyCheck?.summary])
  const completedProgressItems = useMemo(
    () => progressItems.filter((item) => !item.isPending),
    [progressItems],
  )
  const [currentProgressIndex, setCurrentProgressIndex] = useState(0)
  const prevProgressRef = useRef<{ key: string; value: string; isPending: boolean }[]>([])
  const [progressDropdownOpen, setProgressDropdownOpen] = useState(false)

  // When readyCheck updates, auto-position to the item that just changed from pending → filled
  useEffect(() => {
    if (progressItems.length === 0) return
    const prev = prevProgressRef.current
    prevProgressRef.current = progressItems

    // Clamp index if items shrunk
    if (currentProgressIndex >= progressItems.length) {
      setCurrentProgressIndex(Math.max(0, progressItems.length - 1))
      return
    }

    // Find the first item that just transitioned from pending to filled
    if (prev.length > 0 && prev.length === progressItems.length) {
      const changedIdx = progressItems.findIndex((item, idx) => {
        const prevItem = prev[idx]
        return prevItem && prevItem.isPending && !item.isPending
      })
      if (changedIdx >= 0) {
        setCurrentProgressIndex(changedIdx)
        return
      }
    }

    // Fallback: position to the first pending item
    const firstPendingIdx = progressItems.findIndex(item => item.isPending)
    setCurrentProgressIndex(firstPendingIdx >= 0 ? firstPendingIdx : progressItems.length - 1)
  }, [readyCheck?.summary])

  const handlePrevProgress = () => setCurrentProgressIndex(i => Math.max(0, i - 1))
  const handleNextProgress = () => setCurrentProgressIndex(i => Math.min(progressItems.length - 1, i + 1))

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleRefineBeforeGenerate = () => {
    setDraft((previous) => previous.trim() || "我想再微调一下重点：")
    textareaRef.current?.focus()
  }

  const showConvergenceCard = Boolean(readyCheck?.ready)

  // When convergence card is shown, suppress the last AI message that triggered convergence
  // to avoid duplicate content (the convergence card already provides generate/refine UI)
  const convergenceTriggerIdx = useMemo(() => {
    if (!showConvergenceCard) return -1
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (
        m.role === "assistant" &&
        Array.isArray(m.structured_payload?.quick_options) &&
        m.structured_payload.quick_options.some((opt: string) => opt.includes("生成"))
      ) {
        return i
      }
    }
    return -1
  }, [messages, showConvergenceCard])

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-visible bg-white",
        onBack
          ? "border-0 shadow-none"
          : "rounded-2xl border border-slate-200/80 shadow-[0_16px_42px_-30px_rgba(15,23,42,0.20)]"
      )}
      data-testid="learning-path-agent-panel"
    >
      {/* Header */}
      <div className={cn(
        "relative z-20 shrink-0 border-b border-slate-100 bg-white px-6 py-3",
        !onBack && "rounded-t-[24px]"
      )}>
        {/* Star Map Preferences & Progress Carousel & Generation Action */}
        <div className="flex flex-col gap-3">
          {readyCheck?.ready && (
            <div className="sr-only">
              <Button
                size="sm"
                onClick={onGenerate}
                disabled={generating}
                className="h-11 rounded-xl bg-teal-600 px-5 text-sm font-medium text-white shadow-sm transition-all group hover:bg-teal-700"
                data-testid="agent-generate-button"
              >
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 group-hover:animate-pulse" />}
                生成新版本
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3" data-testid="agent-progress-row">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 shadow-sm shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5 opacity-70" />
                上一步
              </button>
            )}
          <StarMapPreferencesPopover map={map} preferences={preferences} onRemovePreference={onRemovePreference} />
          <SupplementInfoPopover texts={supplementTexts} />
          {progressItems.length > 0 ? (
            <div className={cn("ml-auto relative flex w-fit min-w-[160px] max-w-[480px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-4 pr-1.5 shadow-sm animate-in fade-in zoom-in duration-300", progressDropdownOpen && "z-50")}>
              <button
                type="button"
                className="flex min-w-0 flex-1 flex-col text-left transition-opacity hover:opacity-80"
                onClick={() => setProgressDropdownOpen((prev) => !prev)}
              >
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  {progressItems[currentProgressIndex]?.key}
                  <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", progressDropdownOpen && "rotate-180")} />
                </span>
                <span className={cn("truncate text-xs font-semibold", progressItems[currentProgressIndex]?.isPending ? "text-amber-600" : "text-emerald-600")}>
                  {progressItems[currentProgressIndex]?.value}
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-1 rounded-full border border-slate-100 bg-white px-1 py-0.5">
                <button
                  onClick={handlePrevProgress}
                  disabled={currentProgressIndex === 0}
                  className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="min-w-[28px] text-center text-[10px] font-medium text-slate-400">
                  {currentProgressIndex + 1}/{progressItems.length}
                </div>
                <button
                  onClick={handleNextProgress}
                  disabled={currentProgressIndex === progressItems.length - 1}
                  className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {progressDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                  {progressItems.map((item, idx) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setCurrentProgressIndex(idx)
                        setProgressDropdownOpen(false)
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors",
                        idx === currentProgressIndex ? "bg-teal-50" : "hover:bg-slate-50",
                        idx < progressItems.length - 1 && "border-b border-slate-100"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.key}</div>
                        <div className={cn("mt-0.5 truncate text-xs font-semibold", item.isPending ? "text-amber-600" : "text-emerald-600")}>
                          {item.value}
                        </div>
                      </div>
                      <div className={cn("h-2 w-2 shrink-0 rounded-full", item.isPending ? "bg-amber-400" : "bg-emerald-400")} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-hidden text-ellipsis whitespace-nowrap rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-1.5 text-[11px] font-medium text-slate-400">
              正在分析需求...
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        <div className="w-full space-y-6 p-6 md:p-8">
          {messages.map((message, index) => {
            // Skip the convergence-trigger message when convergence card is visible
            if (index === convergenceTriggerIdx) return null
            // Skip AI messages with empty content (streaming placeholder before actual content arrives)
            // The "正在思考..." indicator handles visual feedback during this phase
            if (message.role === "assistant" && !message.content.trim()) return null
            const isAI = message.role === "assistant"
            return (
              <div
                key={`${message.role}-${index}-${message.content.substring(0, 10)}`}
                className={cn(
                  "flex flex-col max-w-[85%]",
                  isAI ? "items-start" : "items-end ml-auto"
                )}
              >
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  {isAI ? (
                    <>
                      <div className="flex h-6 w-6 overflow-hidden items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm p-[1px]">
                        <img src="/logo2.png" alt="AI Agent" className="w-full h-full object-contain" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">AI 助手</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] font-bold text-slate-500">
                        {profile?.portrait?.nickname || "用户"}
                      </span>
                      <div className="flex h-5 w-5 overflow-hidden items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold border border-white/10">
                        {profile?.portrait?.avatar_url ? (
                          <img
                            key={profile.portrait.avatar_url}
                            src={profile.portrait.avatar_url}
                            alt="User"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement
                              img.style.display = "none"
                              const fallback = img.parentElement?.querySelector(".chat-avatar-fallback") as HTMLElement | null
                              if (fallback) fallback.style.display = "flex"
                            }}
                          />
                        ) : null}
                        {!profile?.portrait?.avatar_url && (
                          <span className="chat-avatar-fallback flex items-center justify-center">
                            {profile?.portrait?.nickname?.charAt(0) || profile?.user_id?.charAt(0)?.toUpperCase() || "U"}
                          </span>
                        )}
                        {profile?.portrait?.avatar_url && (
                          <span className="chat-avatar-fallback items-center justify-center" style={{ display: "none" }}>
                            {profile?.portrait?.nickname?.charAt(0) || profile?.user_id?.charAt(0)?.toUpperCase() || "U"}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 text-[14px] leading-7 shadow-sm",
                    isAI 
                      ? "rounded-tl-none border border-slate-100 bg-white text-slate-700" 
                      : "rounded-tr-none bg-slate-900 text-white shadow-[0_18px_36px_-28px_rgba(15,23,42,0.9)]"
                  )}
                >
                  {message.content}
                  
                  {isAI &&
                    !messages.slice(index + 1).some((m) => m.role === "user") &&
                    Array.isArray(message.structured_payload?.quick_options) &&
                    message.structured_payload.quick_options.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                        {message.structured_payload.quick_options.map((option) => (
                          <button
                            key={`${index}-${option}`}
                            type="button"
                            disabled={replying}
                            onClick={async () => {
                              if (option.includes("直接生成")) {
                                await onGenerate()
                              } else {
                                await onSend(option)
                              }
                            }}
                            className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-teal-100 hover:border-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            )
          })}
          {showConvergenceCard && !replying && (
            <div
              className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-sm"
              data-testid="learning-path-convergence-card"
            >
              <div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <span className="text-sm font-bold tracking-wide">已具备生成条件</span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    现在可以直接生成新版本学习路线
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    你的所有个性化需求我们已清晰记录。万事俱备，随时可以为你量身定做专属的学习计划。
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={onGenerate}
                    disabled={generating}
                    className="rounded-xl bg-emerald-600 px-6 text-white hover:bg-emerald-700"
                  >
                    直接生成新版本
                  </Button>
                  <Button
                    type="button"
                    onClick={handleRefineBeforeGenerate}
                    variant="outline"
                    className="rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-6"
                  >
                    我再微调一下
                  </Button>
                </div>
              </div>
            </div>
          )}
          {/* Show thinking indicator only when replying AND no AI content is visible yet.
              Once the streaming message has content, the bubble itself is displayed — no need for both. */}
          {(replying || messages.some(m => m.role === "assistant" && !m.content.trim())) &&
           !(messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.content.trim()) && (
            <div className="flex items-start gap-2 px-1">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex h-6 w-6 overflow-hidden items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm p-[1px]">
                  <img src="/logo2.png" alt="AI Agent" className="w-full h-full object-contain" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">AI 助手</span>
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-none border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-teal-500" />
                <span>正在思考中...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="shrink-0 rounded-b-[24px] border-t border-slate-100 bg-white">
        <div className="w-full px-6 py-4 sm:py-5 md:px-8">
          <div className="flex items-end gap-3 w-full">
            <div className="relative flex flex-1 items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-1.5 shadow-sm transition-all focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/10">
            <Textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (draft.trim() && !replying) {
                    onSend(draft)
                    setDraft("")
                  }
                }
              }}
              placeholder={
                isOpenSupplementMode
                  ? "继续补充细节，或确认可以直接生成学习计划..."
                  : "输入你想说的..."
              }
              className="min-h-[36px] max-h-[150px] w-full resize-none border-0 bg-transparent py-2 px-3 text-[14px] focus-visible:ring-0 shadow-none leading-relaxed"
              rows={draft.split('\n').length > 1 ? Math.min(draft.split('\n').length, 5) : 1}
            />
            <Button
              type="button"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-xl shrink-0 transition-all",
                draft.trim() 
                  ? "bg-teal-600 text-white hover:bg-teal-700 shadow-md" 
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
              disabled={!draft.trim() || replying}
              onClick={async () => {
                await onSend(draft)
                setDraft("")
              }}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          </div>
          
          {/* Optional: Notes toggle or minimal area if needed, keeping it clean for now */}
          <div className="mt-3 flex items-center justify-between px-2 text-[12px] text-slate-400">
            <span>按 Enter 发送，Shift + Enter 换行</span>
            {isOpenSupplementMode && <span className="text-emerald-500 font-medium tracking-wide">条件已就绪，可生成计划</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
