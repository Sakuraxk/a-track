import { useState, useRef, useEffect, useCallback } from "react"
import {
  X, RefreshCw, Brain, ChevronDown, Maximize2, Minimize2
} from "lucide-react"
import { Bubble } from "@ant-design/x"
import { XMarkdown } from "@ant-design/x-markdown"
import Latex from "@ant-design/x-markdown/plugins/Latex"
import "@ant-design/x-markdown/es/XMarkdown/index.css"
import "@/styles/x-markdown-overrides.css"
import { useChatStore } from "@/stores/chat"
import { useAuthStore } from "@/stores/auth"
import { streamChat } from "@/lib/streamChat"
import { cn } from "@/lib/utils"
import ChatComposer from "@/components/ai-chat/ChatComposer"

function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(true)
  if (!content) return null

  return (
    <div className="mb-3 w-full">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[11px] font-semibold text-indigo-500 hover:text-indigo-600 transition-colors mb-1.5"
      >
        <Brain className="h-3.5 w-3.5" />
        <span>思维链</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", !expanded && "-rotate-90")} />
        {isStreaming && (
          <span className="flex gap-0.5 items-center ml-1">
            <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        )}
      </button>
      {expanded && (
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl p-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap font-mono italic">
          {content}
          {isStreaming && <span className="inline-block w-1.5 h-3.5 bg-indigo-400/30 animate-pulse ml-0.5 align-middle" />}
        </div>
      )}
    </div>
  )
}

export default function AIChatWidget() {
  const profile = useAuthStore((s) => s.profile)
  const {
    isOpen, messages, sessionId,
    isStreaming, hideGlobalButton,
    setOpen, addMessage, clearMessages, setSessionId,
    setIsStreaming, updateLastMessage, appendToLastMessage,
  } = useChatStore()

  const [chatInput, setChatInput] = useState("")
  const [isFullScreen, setIsFullScreen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    return () => { abortRef.current?.abort(); abortRef.current = null }
  }, [])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
    updateLastMessage({ isStreaming: false })
  }, [setIsStreaming, updateLastMessage])

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
        session_id: sessionId || undefined,
        message: prompt,
        context: { user_ability_tags: profile.ability_tags || {} },
      }, {
        onSession: (id) => { if (!sessionId) setSessionId(id) },
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
      updateLastMessage({
        content: `[错误] ${err instanceof Error ? err.message : String(err)}`,
        isStreaming: false,
      })
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-screen z-50",
        isFullScreen ? "w-screen sm:w-screen md:w-screen" : "w-[400px]",
        "bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/5 shadow-2xl",
        "transition-all duration-300 ease-in-out flex flex-col",
        isOpen && !hideGlobalButton ? "translate-x-0" : "translate-x-full",
      )}
    >
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-slate-100 dark:border-white/5 flex-shrink-0 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", isStreaming ? "bg-indigo-500 animate-pulse" : "bg-emerald-500")} />
              <span className="text-sm font-bold text-slate-900 dark:text-white">AI 智能助手</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
              {isStreaming ? "正在思考..." : "在线"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            title={isFullScreen ? "退出全屏" : "全屏展示"}
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            title="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden flex">
        {/* Chat Pane */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-white/5 flex items-center justify-end flex-shrink-0">
            <button
              onClick={clearMessages}
              disabled={isStreaming}
              className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-white/5 transition-all disabled:opacity-50"
              title="清空对话"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-white dark:bg-slate-900">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
                  <img src="/logo3_original-Photoroom.png" alt="AI Agent" className="w-full h-full object-cover" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">欢迎使用 AI 智能助手</h3>
                  <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">您可以询问概念、请求代码审查或寻求学习建议。</p>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}>
                {msg.role === "ai" && (
                  <div className="mb-1.5 ml-1 flex items-center gap-2">
                    <div className="flex h-6 w-6 overflow-hidden items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm p-[1px]">
                      <img src="/logo2.png" alt="AI Agent" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">AI 助手</span>
                  </div>
                )}
                {msg.role === "ai" && msg.reasoning && (
                  <div className="max-w-[90%] w-full">
                    <ThinkingBlock content={msg.reasoning} isStreaming={msg.isStreaming} />
                  </div>
                )}
                {msg.role === "ai" ? (
                  <Bubble
                    variant="borderless"
                    className="max-w-[95%] !p-0"
                    content={msg.content || (msg.isStreaming && !msg.reasoning ? "..." : "")}
                    contentRender={(content: string) => (
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-2xl px-4 py-3 shadow-sm">
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
                  <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-2.5 text-sm font-medium max-w-[85%] shadow-lg shadow-indigo-600/10">
                    {msg.content}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-white/5 space-y-3 flex-shrink-0">
            <ChatComposer
              value={chatInput}
              isStreaming={isStreaming}
              disabled={!profile?.user_id}
              quickPrompts={["核心概念解释", "帮我审查代码", "怎么提高学习效率？"]}
              onChange={setChatInput}
              onSend={() => {
                void handleSend()
              }}
              onStop={handleStop}
            />
            {!profile?.user_id && (
              <p className="text-[10px] text-center text-slate-400 font-bold">请先登录以开始对话</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
