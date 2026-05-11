/**
 * 流式聊天请求工具
 * 用于与后端 SSE 端点交互，支持思维链展示
 */

import type { ChatScope } from "./chatApi"

export interface StreamChatRequest {
  session_id?: string
  message: string
  tutor_role?: string
  context?: {
    knowledge_node_code?: string
    exercise_id?: string
    recent_errors?: string[]
    user_ability_tags?: Record<string, number>
    selected_text?: string
    section_title?: string
    task_id?: string
    /** 章节内容摘要（从 concept map + TOC 提炼） */
    chapter_summary?: string
    /** 当前章节标题 */
    chapter_title?: string
    /** 当前学习学科 */
    subject?: string
    /** 当前正在做的题目内容（题干） */
    question_stem?: string
    /** 题目类型 */
    question_type?: string
  }
  request_direct_answer?: boolean
}

export interface StreamChatCallbacks {
  /** 收到 session_id 时调用 */
  onSession: (sessionId: string) => void
  /** 收到思维链内容时调用（DeepSeek R1） */
  onThinking: (content: string) => void
  /** 收到正常回复内容时调用 */
  onContent: (content: string) => void
  /** 流结束时调用 */
  onDone: (fullContent: string, fullReasoning: string) => void
  /** 发生错误时调用 */
  onError: (error: string) => void
}

/**
 * 发起流式聊天请求
 *
 * @param userId 用户ID
 * @param request 聊天请求参数
 * @param callbacks 各事件回调函数
 * @returns Promise<void>
 *
 * @example
 * ```ts
 * await streamChat(userId, { message: "你好" }, {
 *   onSession: (id) => setSessionId(id),
 *   onThinking: (text) => setThinking(prev => prev + text),
 *   onContent: (text) => setContent(prev => prev + text),
 *   onDone: () => setLoading(false),
 *   onError: (err) => showError(err)
 * })
 * ```
 */
/**
 * 将 ability_tags 的值取整，后端要求 Dict[str, int]
 */
function sanitizeAbilityTags(
  tags?: Record<string, number>
): Record<string, number> | undefined {
  if (!tags) return tags
  const result: Record<string, number> = {}
  for (const [key, value] of Object.entries(tags)) {
    result[key] = Math.round(value)
  }
  return result
}

/**
 * 构建发送前的请求体（统一处理 ability_tags 取整）
 */
function buildRequestBody(request: StreamChatRequest, scope?: ChatScope) {
  const sanitized = {
    ...request,
    ...(request.context ? {
      context: {
        ...request.context,
        user_ability_tags: sanitizeAbilityTags(request.context.user_ability_tags),
      },
    } : {}),
    ...(scope?.scopeType ? { scope_type: scope.scopeType } : {}),
    ...(scope?.scopeId ? { scope_id: scope.scopeId } : {}),
  }
  return JSON.stringify(sanitized)
}

export async function streamChat(
  userId: string,
  request: StreamChatRequest,
  callbacks: StreamChatCallbacks,
  scope?: ChatScope
): Promise<void> {
  const url = `/api/ai-tutor/chat/stream?user_id=${encodeURIComponent(userId)}`

  let fullContent = ""
  let fullReasoning = ""

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: buildRequestBody(request, scope),
    })

    if (!response.ok) {
      const errorText = await response.text()
      callbacks.onError(`请求失败: ${response.status} - ${errorText}`)
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      callbacks.onError("无法获取响应流")
      return
    }

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // 处理剩余的 buffer
        if (buffer.trim()) {
          processLine(buffer, callbacks, { fullContent, fullReasoning })
        }
        break
      }

      // 解码并添加到 buffer
      buffer += decoder.decode(value, { stream: true })

      // 按 SSE 格式分割（双换行）
      const lines = buffer.split("\n\n")
      // 最后一个可能不完整，保留在 buffer 中
      buffer = lines.pop() || ""

      for (const line of lines) {
        const result = processLine(line, callbacks, { fullContent, fullReasoning })
        if (result) {
          fullContent = result.fullContent
          fullReasoning = result.fullReasoning
        }
      }
    }

    // 确保 onDone 被调用
    callbacks.onDone(fullContent, fullReasoning)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    callbacks.onError(`网络错误: ${errorMessage}`)
  }
}

/**
 * 处理单行 SSE 数据
 */
function processLine(
  line: string,
  callbacks: StreamChatCallbacks,
  state: { fullContent: string; fullReasoning: string }
): { fullContent: string; fullReasoning: string } | null {
  const trimmed = line.trim()
  if (!trimmed || !trimmed.startsWith("data: ")) {
    return null
  }

  try {
    const jsonStr = trimmed.slice(6) // 移除 "data: " 前缀
    const chunk = JSON.parse(jsonStr)

    switch (chunk.type) {
      case "session":
        callbacks.onSession(chunk.session_id)
        break

      case "thinking":
        state.fullReasoning += chunk.content || ""
        callbacks.onThinking(chunk.content || "")
        break

      case "content":
        state.fullContent += chunk.content || ""
        callbacks.onContent(chunk.content || "")
        break

      case "done":
        // done 事件由外层处理
        if (chunk.full_content) {
          state.fullContent = chunk.full_content
        }
        if (chunk.full_reasoning) {
          state.fullReasoning = chunk.full_reasoning
        }
        break

      case "error":
        callbacks.onError(chunk.content || "未知错误")
        break
    }

    return state
  } catch (e) {
    console.warn("解析 SSE 数据失败:", trimmed, e)
    return null
  }
}

/**
 * 创建一个可取消的流式聊天请求
 *
 * @returns 包含 stream 方法和 abort 方法的对象
 */
export function createAbortableStreamChat() {
  const controller = new AbortController()

  return {
    /**
     * 发起流式请求
     */
    async stream(
      userId: string,
      request: StreamChatRequest,
      callbacks: StreamChatCallbacks,
      scope?: ChatScope
    ): Promise<void> {
      const url = `/api/ai-tutor/chat/stream?user_id=${encodeURIComponent(userId)}`

      let fullContent = ""
      let fullReasoning = ""

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: buildRequestBody(request, scope),
          signal: controller.signal,
        })

        if (!response.ok) {
          const errorText = await response.text()
          callbacks.onError(`请求失败: ${response.status} - ${errorText}`)
          return
        }

        const reader = response.body?.getReader()
        if (!reader) {
          callbacks.onError("无法获取响应流")
          return
        }

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            if (buffer.trim()) {
              processLine(buffer, callbacks, { fullContent, fullReasoning })
            }
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            const result = processLine(line, callbacks, { fullContent, fullReasoning })
            if (result) {
              fullContent = result.fullContent
              fullReasoning = result.fullReasoning
            }
          }
        }

        callbacks.onDone(fullContent, fullReasoning)
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          callbacks.onError("请求已取消")
        } else {
          const errorMessage = error instanceof Error ? error.message : String(error)
          callbacks.onError(`网络错误: ${errorMessage}`)
        }
      }
    },

    /**
     * 取消请求
     */
    abort() {
      controller.abort()
    },
  }
}
