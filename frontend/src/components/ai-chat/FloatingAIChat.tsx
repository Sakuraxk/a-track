import { useState, useRef, useEffect } from "react"
import { RefreshCw, Send, X, Brain, ChevronDown, StopCircle } from "lucide-react"
import { useChatStore, type ChatMessage } from "@/stores/chat"
import { useAuthStore } from "@/stores/auth"
import { streamChat } from "@/lib/streamChat"

interface FloatingAIChatProps {
  onClose: () => void
}

/**
 * 思维链展示组件（可折叠）- 深色主题
 */
function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (!content) return null

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors mb-1"
      >
        <Brain className="h-3.5 w-3.5" />
        <span>思维过程</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${isExpanded ? "" : "-rotate-90"}`}
        />
        {isStreaming && (
          <span className="ml-1 flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-pulse" />
            <span className="text-indigo-300">思考中</span>
          </span>
        )}
      </button>
      {isExpanded && (
        <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-lg p-3 text-xs text-indigo-200 leading-relaxed max-h-32 overflow-auto whitespace-pre-wrap">
          {content}
          {isStreaming && <span className="inline-block w-1.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle" />}
        </div>
      )}
    </div>
  )
}

/**
 * 单条消息组件 - 深色主题
 */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] ${isUser ? "" : "w-full"}`}>
        {!isUser && (
          <div className="mb-1.5 ml-1 flex items-center gap-2">
            <div className="flex h-6 w-6 overflow-hidden items-center justify-center rounded-lg border border-gray-600/50 bg-gray-800 shadow-sm p-[1px]">
              <img src="/logo2.png" alt="AI Agent" className="w-full h-full object-contain" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">AI 助手</span>
          </div>
        )}
        {/* AI 消息可能有思维链 */}
        {!isUser && message.reasoning && (
          <ThinkingBlock
            content={message.reasoning}
            isStreaming={message.isStreaming}
          />
        )}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg ${
            isUser
              ? "bg-gradient-to-r from-brand-green to-emerald-600 text-white"
              : "bg-gray-700/80 text-gray-200 backdrop-blur-sm border border-gray-600/30"
          }`}
        >
          {message.content || (message.isStreaming && !message.reasoning ? (
            <span className="text-gray-400 animate-pulse">等待回复...</span>
          ) : null)}
          {/* 流式输出光标 */}
          {!isUser && message.isStreaming && message.content && (
            <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5 align-middle" />
          )}
        </div>
      </div>
    </div>
  )
}

export default function FloatingAIChat({ onClose }: FloatingAIChatProps) {
  const profile = useAuthStore((s) => s.profile)
  const {
    messages,
    sessionId,
    chatInput,
    isStreaming,
    addMessage,
    clearMessages,
    setSessionId,
    setChatInput,
    setIsStreaming,
    updateLastMessage,
    appendToLastMessage
  } = useChatStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Use a more controlled way to scroll the message container
    const container = messagesEndRef.current?.parentElement
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth"
      })
    }
  }, [messages])

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
    updateLastMessage({ isStreaming: false })
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const prompt = chatInput.trim()
    if (!prompt || isStreaming || !profile?.user_id) return

    // 添加用户消息
    addMessage({ role: "user", content: prompt })
    setChatInput("")

    // 添加空的 AI 消息占位
    addMessage({ role: "ai", content: "", reasoning: "", isStreaming: true })
    setIsStreaming(true)

    // 创建 AbortController
    abortControllerRef.current = new AbortController()

    try {
      await streamChat(
        profile.user_id,
        {
          session_id: sessionId || undefined,
          message: prompt,
          context: {
            user_ability_tags: profile.ability_tags || {}
          }
        },
        {
          onSession: (newSessionId) => {
            if (!sessionId) {
              setSessionId(newSessionId)
            }
          },
          onThinking: (content) => {
            appendToLastMessage("", content)
          },
          onContent: (content) => {
            appendToLastMessage(content)
          },
          onDone: () => {
            updateLastMessage({ isStreaming: false })
            setIsStreaming(false)
            abortControllerRef.current = null
          },
          onError: (error) => {
            updateLastMessage({
              content: `[错误] ${error}`,
              isStreaming: false
            })
            setIsStreaming(false)
            abortControllerRef.current = null
          }
        }
      )
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      updateLastMessage({
        content: `[错误] ${errorMsg}`,
        isStreaming: false
      })
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }

  return (
    <div className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden backdrop-blur-xl">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-gray-800 via-gray-800 to-indigo-900/50 border-b border-gray-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-xl bg-white border border-gray-600 flex items-center justify-center shadow-lg">
            <img src="/logo3_original-Photoroom.png" alt="AI Agent" className="h-full w-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">AI 智能助手</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                isStreaming
                  ? "bg-brand-green/20 text-brand-green border-brand-green/30"
                  : "bg-brand-green/20 text-brand-green border-brand-green/30"
              }`}>
                {isStreaming ? (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-brand-green rounded-full animate-pulse" />
                    生成中
                  </span>
                ) : "在线"}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">随时为你解答编程问题</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <X className="h-4 w-4 text-gray-400 hover:text-white" />
        </button>
      </div>

      <div className="px-4 py-2.5 flex items-center justify-end border-b border-gray-700/50 bg-gray-800/30">
        <button
          onClick={clearMessages}
          disabled={isStreaming}
          className="px-3 py-1.5 rounded-lg bg-gray-700/50 border border-gray-600/50 hover:bg-gray-600 transition-all flex items-center gap-1.5 text-xs text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          新对话
        </button>
      </div>

      {/* Messages */}
      <div className="h-[600px] overflow-auto p-6 space-y-4 bg-gradient-to-b from-gray-800/20 to-gray-900/50">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick questions */}
      <div className="px-4 py-2.5 flex gap-2 border-t border-gray-700/50 bg-gray-800/30">
        {["解释这个概念", "帮我优化代码", "算法思路提示"].map((q) => (
          <button
            key={q}
            onClick={() => setChatInput(q)}
            disabled={isStreaming}
            className="px-3 py-1.5 rounded-lg bg-gray-700/30 border border-gray-600/30 text-xs font-medium text-gray-300 hover:bg-gray-600/50 hover:border-gray-500/50 hover:text-white transition-all disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-700/50 bg-gray-800/50">
        <form onSubmit={handleSendMessage} className="relative">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="向 AI 助手提问..."
            disabled={!profile?.user_id || isStreaming}
            className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl py-3 pl-4 pr-12 text-sm text-gray-200 placeholder:text-gray-500 focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50 outline-none disabled:opacity-50 transition-all"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStopStreaming}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-red-500 text-white rounded-lg flex items-center justify-center active:scale-95 transition-all hover:bg-red-600"
              title="停止生成"
            >
              <StopCircle className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!chatInput.trim() || !profile?.user_id}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-gradient-to-r from-brand-green to-emerald-600 text-white rounded-lg flex items-center justify-center active:scale-95 transition-all hover:shadow-lg hover:shadow-brand-green/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </form>
        {!profile?.user_id && (
          <p className="text-xs text-gray-500 mt-2 text-center">请先登录以使用 AI 助手</p>
        )}
      </div>
    </div>
  )
}
