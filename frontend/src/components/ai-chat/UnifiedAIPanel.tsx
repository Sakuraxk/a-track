import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import { useNavigate } from "react-router-dom"
import { PanelRightClose, Settings, Maximize2, Minimize2 } from "lucide-react"
import { api } from "@/lib/api"
import type { LLMConfigListResponse } from "@/lib/backendTypes"

import { useChatStore } from "@/stores/chat"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth"
import { createAbortableStreamChat, streamChat, type StreamChatRequest } from "@/lib/streamChat"
import type { ChatScope } from "@/lib/chatApi"
import {
  CONTEXT_QUICK_ASK_EVENT,
  type ContextQuickAskPayload,
} from "@/features/studio/components/ContextQuickAsk"
import ChatComposer from "@/components/ai-chat/ChatComposer"
import ChatMessageThread from "@/components/ai-chat/ChatMessageThread"

const MIN_WIDTH = 320
const MAX_WIDTH = 720

type UnifiedAIPanelProps = {
  topOffset?: number
  bottomOffset?: number
}

function resolveScopeFromKey(scopeKey: string): ChatScope {
  if (scopeKey === "global") {
    return { scopeType: "global" }
  }

  if (scopeKey.startsWith("concept:")) {
    const scopeId = scopeKey.slice("concept:".length)
    return { scopeType: "concept", ...(scopeId && scopeId !== "default" ? { scopeId } : {}) }
  }

  if (scopeKey.startsWith("practice:")) {
    const scopeId = scopeKey.slice("practice:".length)
    return { scopeType: "practice", ...(scopeId && scopeId !== "default" ? { scopeId } : {}) }
  }

  return { scopeType: "global" }
}

export default function UnifiedAIPanel({ topOffset = 16, bottomOffset = 16 }: UnifiedAIPanelProps) {
  const {
    isOpen,
    messages,
    sessionId,
    currentSessionId,
    activeScopeKey,
    panelCollapsed,
    panelWidth,
    panelDock,
    chatInput,
    isStreaming,
    learningContext,
    addMessage,
    setSessionId,
    setIsStreaming,
    appendToLastMessage,
    updateLastMessage,
    setActiveScope,
    setOpen,
    setPanelCollapsed,
    setPanelWidth,
    setPanelDock,
    setChatInput,
    startNewSession,
  } = useChatStore()
  const profile = useAuthStore((s) => s.profile)
  const navigate = useNavigate()
  const resizingRef = useRef(false)
  const abortableChatRef = useRef<ReturnType<typeof createAbortableStreamChat> | null>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(panelWidth)
  const [isFullScreen, setIsFullScreen] = useState(false)

  // 检查用户是否已配置 AI 模型
  const [hasLLMConfig, setHasLLMConfig] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isOpen || !profile?.user_id) return
    let cancelled = false
    api.get<LLMConfigListResponse>("/api/llm-config/", {
      params: { user_id: profile.user_id }
    }).then((res) => {
      if (!cancelled) setHasLLMConfig(res.data.configs.length > 0)
    }).catch(() => {
      if (!cancelled) setHasLLMConfig(false)
    })
    return () => { cancelled = true }
  }, [isOpen, profile?.user_id])

  const activeChatScope = resolveScopeFromKey(activeScopeKey)

  const handleStopStreaming = useCallback(() => {
    abortableChatRef.current?.abort()
    abortableChatRef.current = null
    setIsStreaming(false)
    updateLastMessage({ isStreaming: false })
  }, [setIsStreaming, updateLastMessage])

  const sendMessage = useCallback(
    async (message: string, scope: ChatScope) => {
      // 未配置 AI 模型时阻止发送（null 表示仍在加载，不应跳转）
      if (hasLLMConfig === false) {
        navigate('/app/profile')
        return
      }
      if (hasLLMConfig === null) {
        return
      }
      if (!profile?.user_id || !message.trim() || isStreaming) {
        return
      }

      addMessage({ role: "user", content: message })
      addMessage({ role: "ai", content: "", reasoning: "", isStreaming: true })
      setIsStreaming(true)

      const request: StreamChatRequest = {
        session_id: currentSessionId || sessionId || undefined,
        message,
        context: {
          user_ability_tags: profile.ability_tags || {},
          // 始终注入学习上下文（如果有）
          ...(learningContext?.chapterSummary ? { chapter_summary: learningContext.chapterSummary } : {}),
          ...(learningContext?.chapterTitle ? { chapter_title: learningContext.chapterTitle } : {}),
          ...(learningContext?.subject ? { subject: learningContext.subject } : {}),
          ...(learningContext?.taskId ? { task_id: learningContext.taskId } : {}),
        },
      }

      const streamClient = createAbortableStreamChat()
      abortableChatRef.current = streamClient

      try {
        await streamClient.stream(
          profile.user_id,
          request,
          {
            onSession: (id) => setSessionId(id),
            onThinking: (chunk) => appendToLastMessage("", chunk),
            onContent: (chunk) => appendToLastMessage(chunk),
            onDone: () => {
              updateLastMessage({ isStreaming: false })
              setIsStreaming(false)
              abortableChatRef.current = null
            },
            onError: (error) => {
              updateLastMessage({ content: `[错误] ${error}`, isStreaming: false })
              setIsStreaming(false)
              abortableChatRef.current = null
            },
          },
          scope
        )
      } catch (error) {
        updateLastMessage({
          content: `[错误] ${error instanceof Error ? error.message : String(error)}`,
          isStreaming: false,
        })
        setIsStreaming(false)
        abortableChatRef.current = null
      }
    },
    [
      addMessage,
      appendToLastMessage,
      currentSessionId,
      hasLLMConfig,
      isStreaming,
      learningContext,
      navigate,
      profile,
      sessionId,
      setIsStreaming,
      setSessionId,
      updateLastMessage,
    ]
  )

  const handleResizeStart = (event: ReactMouseEvent<HTMLElement>) => {
    if (panelCollapsed) return

    resizingRef.current = true
    startXRef.current = event.clientX
    startWidthRef.current = panelWidth

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return

      const delta = startXRef.current - moveEvent.clientX
      const nextWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidthRef.current + delta))
      setPanelWidth(nextWidth)
    }

    const onMouseUp = () => {
      resizingRef.current = false
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }

  useEffect(() => {
    return () => {
      abortableChatRef.current?.abort()
      abortableChatRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleQuickAsk = (event: Event) => {
      const detail = (event as CustomEvent<ContextQuickAskPayload>).detail
      if (!detail?.selectedText || !detail.taskId || !profile?.user_id) {
        return
      }

      const scope: ChatScope = {
        scopeType: "concept",
        scopeId: detail.taskId,
      }
      const message = detail.prompt || `请解释这段内容：${detail.selectedText}`

      setOpen(true)
      setPanelCollapsed(false)
      setActiveScope(scope)
      setChatInput("")

      addMessage({ role: "user", content: message })
      addMessage({ role: "ai", content: "", reasoning: "", isStreaming: true })
      setIsStreaming(true)

      const request: StreamChatRequest = {
        session_id: currentSessionId || sessionId || undefined,
        message,
        context: {
          user_ability_tags: profile.ability_tags || {},
          selected_text: detail.selectedText,
          section_title: detail.sectionTitle,
          task_id: detail.taskId,
          // Quick Ask 传入的章节上下文
          ...(detail.chapterSummary ? { chapter_summary: detail.chapterSummary } : {}),
          ...(detail.chapterTitle ? { chapter_title: detail.chapterTitle } : {}),
          ...(detail.subject ? { subject: detail.subject } : {}),
        },
      }

      void streamChat(
        profile.user_id,
        request,
        {
          onSession: (id) => setSessionId(id),
          onThinking: (chunk) => appendToLastMessage("", chunk),
          onContent: (chunk) => appendToLastMessage(chunk),
          onDone: () => {
            updateLastMessage({ isStreaming: false })
            setIsStreaming(false)
          },
          onError: (error) => {
            updateLastMessage({
              content: `[错误] ${error}`,
              isStreaming: false,
            })
            setIsStreaming(false)
          },
        },
        scope
      )
    }

    window.addEventListener(CONTEXT_QUICK_ASK_EVENT, handleQuickAsk)
    return () => window.removeEventListener(CONTEXT_QUICK_ASK_EVENT, handleQuickAsk)
  }, [
    addMessage,
    appendToLastMessage,
    currentSessionId,
    profile,
    sessionId,
    setActiveScope,
    setChatInput,
    setIsStreaming,
    setOpen,
    setPanelCollapsed,
    setSessionId,
    updateLastMessage,
  ])

  if (!isOpen) {
    return null
  }

  return (
    <>
      <aside
        data-testid="unified-ai-panel"
        data-collapsed={panelCollapsed}
        data-dock={panelDock}
        data-top-offset={String(topOffset)}
        className={cn(
          "fixed z-40 overflow-hidden border border-slate-200/90 bg-white shadow-[0_28px_90px_-42px_rgba(15,23,42,0.32)] transition-all duration-300",
          panelDock === "right"
            ? "right-2 rounded-2xl"
            : "right-12 rounded-2xl",
          panelCollapsed && "translate-x-[calc(100%+3rem)] opacity-0 pointer-events-none",
          isFullScreen && "right-0 top-0 !rounded-none !border-none !w-screen !h-screen !z-[100]"
        )}
        style={{
          width: isFullScreen ? "100vw" : panelWidth,
          top: isFullScreen ? 0 : topOffset,
          height: isFullScreen ? "100vh" : `calc(100vh - ${topOffset + bottomOffset}px)`,
        }}
      >
      <div className="relative flex h-full flex-col">
        <header
          className="flex items-center justify-between border-b border-slate-200/80 bg-white px-4 py-3"
          onMouseDown={(event) => {
            if (event.detail >= 2) {
              setPanelDock(panelDock === "right" ? "floating" : "right")
            }
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setPanelCollapsed(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 shadow-sm transition hover:border-emerald-200 hover:bg-white hover:text-emerald-600"
              aria-label="折叠面板"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,oklch(98%_0.012_165),oklch(98%_0.01_220))] shadow-[0_18px_40px_-24px_rgba(15,23,42,0.6)]">
                  <img src="/logo3_original-Photoroom.png" alt="AI Avatar" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-600/80">
                    学习面板
                  </p>
                  <p className="truncate text-sm font-semibold text-slate-900">AI 助手</p>
                  <p className="truncate text-[11px] font-medium text-slate-500">智能问答与上下文学习</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullScreen(prev => !prev)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-white hover:text-emerald-600 outline-none"
              title={isFullScreen ? "退出全屏" : "全屏展示"}
            >
              {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 pb-5">
          {hasLLMConfig === false ? (
            /* 未配置 AI 模型时显示引导界面 */
            <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-100 to-emerald-50 shadow-inner">
                <Settings className="h-7 w-7 text-teal-600" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-800 mb-2">需要先配置 AI 模型</p>
                <p className="text-sm text-slate-500 leading-relaxed">
                  请前往个人中心完成 AI 模型配置（API Key、模型名称等），配置完成后即可开始对话。
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/app/profile')}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-95"
              >
                <Settings className="h-4 w-4" />
                前往配置
              </button>
            </div>
          ) : (
            /* 正常聊天界面 */
            <>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-[linear-gradient(135deg,oklch(99%_0.006_220),oklch(98.8%_0.008_165))] px-3.5 py-3 shrink-0">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    当前模式
                  </p>
                  <p className="truncate text-sm font-medium text-slate-700">
                    {activeChatScope.scopeType === "concept"
                      ? "围绕当前概念对话"
                      : activeChatScope.scopeType === "practice"
                        ? "围绕练习上下文对话"
                        : "全局学习对话"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startNewSession}
                  disabled={isStreaming}
                  className="rounded-full border border-slate-200/80 bg-white px-3.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm disabled:opacity-50"
                >
                  新会话
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,white,oklch(99%_0.003_220))]">
                <div className="h-full overflow-y-auto px-3 py-3">
                  <ChatMessageThread messages={messages} />
                </div>
              </div>

              <div className="shrink-0 rounded-2xl border border-slate-200/80 bg-white px-3 py-3 shadow-[0_14px_40px_-24px_rgba(15,23,42,0.28)]">
                <ChatComposer
                  value={chatInput}
                  isStreaming={isStreaming}
                  disabled={!profile?.user_id}
                  quickPrompts={["核心概念解释", "请帮我梳理本节重点", "这道题为什么错了？"]}
                  onChange={setChatInput}
                  onSend={() => {
                    void sendMessage(chatInput, activeChatScope)
                    setChatInput("")
                  }}
                  onStop={handleStopStreaming}
                />
              </div>

              {!profile?.user_id && (
                <p className="text-center text-[10px] font-semibold text-slate-400">
                  请先登录以开始对话
                </p>
              )}
            </>
          )}

        </div>

        <div
          role="separator"
          aria-label="调整面板宽度"
          onMouseDown={handleResizeStart}
          className="absolute left-0 top-0 h-full w-1 cursor-col-resize rounded-l-2xl bg-transparent"
        />
      </div>
    </aside>

    {/* Edge Toggle Handle */}
    <div
      className={cn(
        "fixed right-0 z-40 transition-all duration-300",
        panelCollapsed ? "translate-x-0" : "translate-x-full"
      )}
      style={{ top: topOffset + 120 }}
    >
      <button
        type="button"
        onClick={() => setPanelCollapsed(false)}
        className="flex h-14 w-10 items-center justify-center rounded-l-2xl border border-r-0 border-slate-200/80 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.3)] transition-all hover:w-12 hover:bg-slate-50 p-1.5"
        aria-label="展开 AI 助手"
      >
        <img src="/logo3_original-Photoroom.png" alt="AI Agent" className="w-full h-full object-contain" />
      </button>
    </div>
    </>
  )
}
