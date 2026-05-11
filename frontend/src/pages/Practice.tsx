import { useEffect, useMemo, useState } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft, Play, RotateCcw, RefreshCw,
  Sparkles, Terminal, ChevronRight, Info,
  ShieldCheck, Zap, Brain, ChevronDown
} from "lucide-react"
import Editor from "@monaco-editor/react"
import { XMarkdown } from "@ant-design/x-markdown"
import Latex from "@ant-design/x-markdown/plugins/Latex"
import "@ant-design/x-markdown/es/XMarkdown/index.css"
import "@/styles/x-markdown-overrides.css"

import { api, getApiErrorMessage } from "@/lib/api"
import { streamChat } from "@/lib/streamChat"
import type { ChatMessage } from "@/stores/chat"
import type { Exercise, ExerciseSubmissionResponse, CodeExecutionResponse } from "@/lib/backendTypes"
import { useAuthStore } from "@/stores/auth"
import { useNotificationStore } from "@/stores/notification"

function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (!content) return null

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 transition-colors mb-1"
      >
        <Brain className="h-3.5 w-3.5" />
        <span>思维过程</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${isExpanded ? "" : "-rotate-90"}`}
        />
        {isStreaming && (
          <span className="ml-1 flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-pulse" />
            <span className="text-indigo-400">思考中</span>
          </span>
        )}
      </button>
      {isExpanded && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-800 leading-relaxed max-h-40 overflow-auto whitespace-pre-wrap">
          {content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle" />
          )}
        </div>
      )}
    </div>
  )
}

export default function Practice() {
  const { topic } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const profile = useAuthStore((s) => s.profile)

  const isReview = new URLSearchParams(location.search).get('review') === 'true'

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [, setLoadingExercise] = useState(false)
  const [, setExerciseError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [, setSubmitError] = useState<string | null>(null)

  const isUuid = useMemo(() => {
    return (value: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  }, [])

  const [code, setCode] = useState("# 在这里编写你的代码\n\ndef solution():\n    pass")
  const [output, setOutput] = useState("")
  const [running, setRunning] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", content: "你好！我是你的 AI 导师。正在加载题目信息..." }
  ])

  const [sessionId, setSessionId] = useState<string | null>(null)


  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!topic) return
    if (!isUuid(topic)) return

    let cancelled = false
    setLoadingExercise(true)
    api.get<Exercise>(`/api/practice/exercises/${topic}`)
      .then((res) => { if (!cancelled) setExercise(res.data) })
      .catch((err) => { if (!cancelled) setExerciseError(getApiErrorMessage(err)) })
      .finally(() => { if (!cancelled) setLoadingExercise(false) })
    return () => { cancelled = true }
  }, [isUuid, topic])

  useEffect(() => {
    if (!topic || !profile?.user_id || !isReview) return

    api.get(`/api/practice/exercises/${topic}/last-attempt`, {
      params: { user_id: profile.user_id }
    }).then(res => {
      // @ts-ignore
      if (res.data.success && res.data.attempt?.response) {
        // @ts-ignore
        setCode(res.data.attempt.response)
        setMessages(prev => [
          ...prev,
          { role: 'ai', content: '已为您恢复上次提交的内容，您可以继续修改或重新运行。' }
        ])
      }
    }).catch(err => console.error("Failed to fetch last attempt:", err))
  }, [topic, profile?.user_id, isReview])

  // 当exercise加载成功后，更新初始消息显示题目标题
  useEffect(() => {
    if (exercise?.title) {
      setMessages([{
        role: 'ai',
        content: `你好！我是你的 AI 导师。看来你正在练习「${exercise.title}」。如果遇到困难，随时问我！`
      }])
    }
  }, [exercise?.title])





  const handleRunCode = async () => {
    setRunning(true)
    setOutput("运行中...")
    try {
      const res = await api.post<CodeExecutionResponse>("/api/practice/execute", { code, timeout: 10 })
      if (res.data.success) {
        setOutput(`${res.data.output}\n\n> [执行成功] 耗时 ${res.data.execution_time_ms}ms`)
      } else {
        setOutput(`${res.data.output}\n\n> [执行失败]\n${res.data.error}`)
      }
    } catch (err) { setOutput(`> [请求失败] ${getApiErrorMessage(err)}`) }
    finally { setRunning(false) }
  }

  const handleSubmit = async () => {
    if (!profile?.user_id || !exercise) return
    setSubmitting(true)
    try {
      const res = await api.post<ExerciseSubmissionResponse>(
        "/api/practice/results",
        {
          exercise_id: exercise.id,
          code,
          timeout: 10,
          status: "submitted",
          score: 0,
          error_tags: [],
        },
        { params: { user_id: profile.user_id } }
      )

      const verdict =
        res.data.status === "correct"
          ? `✅ 正确（得分 ${res.data.score}）`
          : res.data.status === "wrong"
            ? `❌ 错误（得分 ${res.data.score}）`
            : res.data.status === "timeout"
              ? "⏱️ 超时"
              : res.data.status === "error"
                ? "⚠️ 运行错误"
                : "已提交"

      const expected = res.data.expected_output != null ? String(res.data.expected_output) : null
      const actual = res.data.output != null ? String(res.data.output) : ""
      const errText = res.data.error ? `\n错误信息：${res.data.error}` : ""
      const tagsText = res.data.error_tags?.length ? `\n错误标签：${res.data.error_tags.join(", ")}` : ""

      setOutput((prev) => {
        const parts = [
          prev,
          `\n\n> [提交结果] ${verdict}（耗时 ${res.data.execution_time_ms}ms）${errText}${tagsText}`,
        ]
        if (expected != null) {
          parts.push(`\n\n[预期输出]\n${expected}\n\n[实际输出]\n${actual}`)
        }
        return parts.join("")
      })
      // 提交成功时发送通知
      if (res.data.status === "correct") {
        useNotificationStore.getState().addNotification("exercise_complete")
      }
    } catch (err) { setSubmitError(getApiErrorMessage(err)) }
    finally {
      setSubmitting(false)
    }
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const prompt = chatInput.trim()
    if (!prompt || sending || !profile?.user_id) return

    setMessages((prev) => [
      ...prev,
      { role: "user", content: prompt },
      { role: "ai", content: "", reasoning: "", isStreaming: true }
    ])
    setChatInput("")
    setSending(true)

    try {
      const appendToLastAiMessage = (contentDelta: string, reasoningDelta?: string) => {
        setMessages((prev) => {
          if (prev.length === 0) return prev
          const lastIndex = prev.length - 1
          const last = prev[lastIndex]
          if (last.role !== "ai") return prev

          const next: ChatMessage = {
            ...last,
            content: `${last.content || ""}${contentDelta}`,
            reasoning: `${last.reasoning || ""}${reasoningDelta || ""}`,
            isStreaming: true,
          }
          return [...prev.slice(0, lastIndex), next]
        })
      }

      const finalizeLastAiMessage = (patch: Partial<ChatMessage>) => {
        setMessages((prev) => {
          if (prev.length === 0) return prev
          const lastIndex = prev.length - 1
          const last = prev[lastIndex]
          if (last.role !== "ai") return prev
          return [...prev.slice(0, lastIndex), { ...last, ...patch }]
        })
      }

      await streamChat(
        profile.user_id,
        {
          session_id: sessionId || undefined,
          message: prompt,
          tutor_role: "explainer",
          context: {
            knowledge_node_code: exercise?.linked_nodes?.[0] || topic,
            exercise_id: exercise?.id,
            user_ability_tags: profile.ability_tags || {},
            question_stem: typeof exercise?.content?.prompt === "string" ? exercise.content.prompt : undefined,
            question_type: typeof exercise?.content?.type === "string" ? exercise.content.type : undefined,
          },
        },
        {
          onSession: (newSessionId) => {
            if (!sessionId) {
              setSessionId(newSessionId)
            }
          },
          onThinking: (content) => appendToLastAiMessage("", content),
          onContent: (content) => appendToLastAiMessage(content),
          onDone: () => {
            finalizeLastAiMessage({ isStreaming: false })
            setSending(false)
          },
          onError: (error) => {
            appendToLastAiMessage(`\n\n[错误] ${error}`)
            finalizeLastAiMessage({ isStreaming: false })
            setSending(false)
          },
        }
      )
    } catch (err) {
      const errorText = `[错误] ${getApiErrorMessage(err)}`
      setMessages((prev) => {
        if (prev.length === 0) return [{ role: "ai", content: errorText }]
        const lastIndex = prev.length - 1
        const last = prev[lastIndex]
        if (last.role !== "ai") return [...prev, { role: "ai", content: errorText }]
        return [...prev.slice(0, lastIndex), { ...last, content: errorText, isStreaming: false }]
      })
      setSending(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-surface font-sans selection:bg-brand-green selection:text-white overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/app/problems")}
            className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all active:scale-95"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCode("# 已重置示例代码\n\ndef solution():\n    pass")}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" /> 重置
          </button>
          <button
            onClick={handleRunCode}
            disabled={running}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-all flex items-center gap-2"
          >
            <Play className="h-4 w-4 text-brand-green" /> {running ? "运行中..." : "运行代码"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !exercise}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-green rounded-lg hover:bg-brand-green-dark transition-all flex items-center gap-2"
          >
            <ShieldCheck className="h-4 w-4" /> 提交
          </button>
        </div>
      </header>

      {/* Main Content - LeetCode Style Split */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">

        {/* Left Panel: Problem & AI Tutor */}
        <div className="w-[40%] flex flex-col gap-3 min-h-0">
          <div className="flex-1 bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col shadow-sm">
            <Tabs defaultValue="problem" className="flex-1 grid grid-rows-[auto,1fr] min-h-0 overflow-hidden">
              <div className="px-4 pt-4">
                <TabsList className="bg-gray-100 p-1 rounded-xl w-full">
                  <TabsTrigger value="problem" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm font-medium">
                    <Info className="h-4 w-4 mr-2" /> 题目描述
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm font-medium">
                    <Sparkles className="h-4 w-4 mr-2 text-brand-green" /> AI 导师
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="problem" className="min-h-0 overflow-y-auto overflow-x-hidden scroll-smooth mt-0">
                <div className="p-6 pb-10">

                  <XMarkdown
                    className="text-gray-600 x-markdown-light"
                    content={typeof exercise?.content?.prompt === "string"
                      ? exercise.content.prompt.replace(/^\s*(练习模式|专注练习模式)\s*\n*/, "").trim()
                      : "正在加载题目描述..."}
                    config={{ extensions: Latex() }}
                    dompurifyConfig={{ ADD_ATTR: ['style'] }}
                  />

                  {exercise?.linked_nodes && (
                    <div className="pt-5 border-t border-gray-100">
                      <h4 className="text-xs font-medium text-gray-500 mb-3">相关知识点</h4>
                      <div className="flex flex-wrap gap-2">
                        {exercise.linked_nodes.map(node => (
                          <span key={node} className="px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-700">{node}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden">
                {/* AI Header */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gray-800 flex items-center justify-center text-white font-medium text-xs">AI</div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">AI 助手</div>
                      <div className="text-xs text-brand-green">准备就绪</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setMessages([{ role: 'ai', content: '新会话已开始，有什么可以帮助你的？' }])} className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 transition-all">
                      <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-auto p-4 space-y-3 no-scrollbar">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] ${msg.role === 'user' ? '' : 'w-full'}`}>
                        {msg.role !== "user" && msg.reasoning && (
                          <ThinkingBlock content={msg.reasoning} isStreaming={msg.isStreaming} />
                        )}
                        <div
                          className={`rounded-2xl p-4 text-sm leading-relaxed ${msg.role === 'user'
                            ? 'bg-gray-800 text-white'
                            : 'bg-gray-100 text-gray-800'
                            }`}
                        >
                          {msg.content ? (
                            <XMarkdown
                              className={msg.role === 'user' ? 'text-white' : 'text-gray-800 x-markdown-light'}
                              content={msg.content}
                              config={{ extensions: Latex() }}
                              dompurifyConfig={{ ADD_ATTR: ['style'] }}
                            />
                          ) : (msg.isStreaming && !msg.reasoning ? (
                            <span className="text-gray-400 animate-pulse">等待回复...</span>
                          ) : null)}
                          {msg.role !== "user" && msg.isStreaming && msg.content && (
                            <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5 align-middle" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-2xl p-4 text-sm text-gray-500 animate-pulse">
                        思考中...
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                  <div className="flex gap-2 mb-3">
                    {['解释代码', '获取提示', '检查复杂度'].map(hint => (
                      <button
                        key={hint}
                        onClick={() => { setChatInput(hint); }}
                        className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-all"
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={handleSendMessage} className="relative">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="向导师提问..."
                      className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none"
                    />
                    <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-brand-green text-white rounded-lg flex items-center justify-center active:scale-95 transition-all hover:bg-brand-green-dark">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Right Panel: Editor & Console */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Editor */}
          <div className="flex-[2] bg-gray-900 rounded-2xl overflow-hidden relative shadow-lg">
            <div className="absolute top-3 right-4 z-10 flex items-center gap-2">
              <div className="px-3 py-1 rounded-lg bg-gray-800 border border-gray-700 text-xs font-medium text-gray-300">
                Python 3.10
              </div>
            </div>
            <Editor
              height="100%"
              defaultLanguage="python"
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
                scrollBeyondLastLine: false,
                padding: { top: 20 }
              }}
            />
          </div>

          {/* Console */}
          <div className="flex-1 bg-gray-900 rounded-2xl overflow-hidden flex flex-col shadow-lg">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-400">控制台输出</span>
              </div>
              <button onClick={() => setOutput("")} className="text-xs font-medium text-gray-500 hover:text-white transition-colors">清空</button>
            </div>
            <div className="flex-1 p-4 overflow-auto font-mono text-sm text-brand-green no-scrollbar">
              {output ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-500">
                    <ChevronRight className="h-3 w-3" />
                    <span>执行结果:</span>
                  </div>
                  <pre className="whitespace-pre-wrap leading-relaxed">{output}</pre>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2">
                  <Zap className="h-6 w-6 opacity-30" />
                  <span className="text-xs text-gray-500">等待执行</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
