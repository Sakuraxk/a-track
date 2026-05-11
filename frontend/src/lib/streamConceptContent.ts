/**
 * 流式获取概念学习内容
 * 用于与后端概念学习 SSE 端点交互
 */

import { API_BASE_URL } from "./api"

export interface ConceptMapNode {
  id: string
  title: string
  summary: string
  examples: string[]
  pitfalls: string[]
  prerequisites: string[]
  section_level: number
}

export interface ConceptMapEdge {
  source: string
  target: string
  relation_type: "prerequisite" | "contains" | "contrast" | "causes" | string
  label?: string
}

export interface ConceptMap {
  root: string
  chapter_order: string[]
  nodes: ConceptMapNode[]
  edges: ConceptMapEdge[]
}

export interface CachedConceptContent {
  task_id: string
  task_title: string
  subject: string
  content: string | null
  reasoning: string | null
  concept_map?: ConceptMap | null
  markmap_markdown?: string | null
  learning_path_id?: string | null
  learning_path_version?: number | null
  learning_path_version_name?: string | null
  source_day?: number | null
  source_chapter_id?: string | null
  source_chapter_title?: string | null
  source_task_title?: string | null
  source_scope_key?: string | null
  created_at: string | null
  exists: boolean
}

export interface ConceptSourceScope {
  learning_path_id?: string
  learning_path_version?: number
  learning_path_version_name?: string
  source_day?: number
  source_chapter_id?: string
  source_chapter_title?: string
  source_task_title?: string
  source_scope_key?: string
}

/**
 * 获取已缓存的概念学习内容
 */
export async function getCachedContent(
  userId: string,
  taskId: string,
  sourceScope?: ConceptSourceScope
): Promise<CachedConceptContent | null> {
  const baseUrl = API_BASE_URL || ""
  const params = new URLSearchParams({ user_id: userId })
  if (sourceScope?.learning_path_id) params.set("learning_path_id", sourceScope.learning_path_id)
  if (sourceScope?.learning_path_version != null) params.set("learning_path_version", String(sourceScope.learning_path_version))
  if (sourceScope?.source_day != null) params.set("source_day", String(sourceScope.source_day))
  if (sourceScope?.source_chapter_id) params.set("source_chapter_id", sourceScope.source_chapter_id)
  if (sourceScope?.source_scope_key) params.set("source_scope_key", sourceScope.source_scope_key)
  const url = `${baseUrl}/api/concept-learning/${taskId}?${params.toString()}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    return await response.json()
  } catch (e) {
    console.error("获取缓存内容失败:", e)
    return null
  }
}

/**
 * 删除缓存的概念内容（用于重新生成）
 */
export async function deleteConceptContent(
  userId: string,
  taskId: string,
  sourceScope?: ConceptSourceScope
): Promise<boolean> {
  const baseUrl = API_BASE_URL || ""
  const params = new URLSearchParams({ user_id: userId })
  if (sourceScope?.learning_path_id) params.set("learning_path_id", sourceScope.learning_path_id)
  if (sourceScope?.learning_path_version != null) params.set("learning_path_version", String(sourceScope.learning_path_version))
  if (sourceScope?.source_day != null) params.set("source_day", String(sourceScope.source_day))
  if (sourceScope?.source_chapter_id) params.set("source_chapter_id", sourceScope.source_chapter_id)
  if (sourceScope?.source_scope_key) params.set("source_scope_key", sourceScope.source_scope_key)
  const url = `${baseUrl}/api/concept-learning/${taskId}?${params.toString()}`

  try {
    const response = await fetch(url, { method: "DELETE" })
    return response.ok
  } catch (e) {
    console.error("删除缓存内容失败:", e)
    return false
  }
}

export interface ConceptContentRequest {
  task_id: string
  task_title: string
  subject: string
  description: string
  duration_minutes: number
  resources: string[]
  learning_path_id?: string
  learning_path_version?: number
  learning_path_version_name?: string
  source_day?: number
  source_chapter_id?: string
  source_chapter_title?: string
  source_task_title?: string
  source_scope_key?: string
  diagram_only?: boolean
  existing_content?: string
  target_headings?: string[]
  concept_map?: ConceptMap
}

export interface ConceptStreamDonePayload {
  fullContent: string
  fullReasoning: string
  conceptMap?: ConceptMap | null
  markmapMarkdown?: string | null
}

export interface StreamConceptCallbacks {
  /** 开始生成时调用 */
  onStart: (taskId: string) => void
  /** 开始生成思维导图时调用 */
  onMapStart?: () => void
  /** 思维导图内容流式输出（每个 LLM chunk） */
  onMapContent?: (content: string) => void
  /** 思维导图生成完成时调用 */
  onMapReady?: (payload: { conceptMap?: ConceptMap | null; markmapMarkdown?: string | null }) => void
  /** 收到思维链内容时调用（DeepSeek R1） */
  onThinking: (content: string) => void
  /** 收到正常内容时调用 */
  onContent: (content: string) => void
  /** 流结束时调用 */
  onDone: (payload: ConceptStreamDonePayload) => void
  /** 发生错误时调用 */
  onError: (error: string) => void
}

/**
 * 流式获取概念学习内容
 *
 * @param userId 用户ID
 * @param request 请求参数
 * @param callbacks 各事件回调函数
 * @returns Promise<void>
 */
export async function streamConceptContent(
  userId: string,
  request: ConceptContentRequest,
  callbacks: StreamConceptCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const baseUrl = API_BASE_URL || ""
  const url = `${baseUrl}/api/concept-learning/generate/stream?user_id=${encodeURIComponent(userId)}`

  let fullContent = ""
  let fullReasoning = ""
  let hasReceivedDone = false

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal,
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
          if (line.includes('"type":"done"') || line.includes('"type": "done"')) {
            hasReceivedDone = true
          }
        }
      }
    }

    // 确保 onDone 被调用
    if (!hasReceivedDone) {
      callbacks.onDone({ fullContent, fullReasoning })
    }
  } catch (error) {
    // AbortError is expected when switching chapters — ignore silently
    if (error instanceof DOMException && error.name === "AbortError") {
      return
    }
    const errorMessage = error instanceof Error ? error.message : String(error)
    callbacks.onError(`网络错误: ${errorMessage}`)
  }
}

export interface GenerateConceptExercisesRequest {
  task_id: string
  task_title: string
  subject: string
  subject_key?: string
  description: string
  article_content: string
  concept_map?: ConceptMap
  learning_path_id?: string
  learning_path_version?: number
  learning_path_version_name?: string
  source_day?: number
  source_chapter_id?: string
  source_chapter_title?: string
  source_task_title?: string
  source_scope_key?: string
}

export interface GenerateConceptExercisesResponse {
  success: boolean
  exercises_count: number
  raw_content: string
  group_id?: string | null
  exercises?: Array<{
    type?: string
    title?: string
    description?: string
    prompt?: string
    question?: string
    stem?: string
    answer_key?: unknown
    options?: unknown[]
  }>
}

export async function generateConceptExercises(
  userId: string,
  request: GenerateConceptExercisesRequest
): Promise<GenerateConceptExercisesResponse> {
  const baseUrl = API_BASE_URL || ""
  const url = `${baseUrl}/api/concept-learning/generate-exercises?user_id=${encodeURIComponent(userId)}`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`请求失败: ${response.status} - ${errorText}`)
  }

  return await response.json()
}

/**
 * 处理单行 SSE 数据
 */
function processLine(
  line: string,
  callbacks: StreamConceptCallbacks,
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
      case "start":
        callbacks.onStart(chunk.task_id)
        break

      case "thinking":
        state.fullReasoning += chunk.content || ""
        callbacks.onThinking(chunk.content || "")
        break

      case "map_start":
        callbacks.onMapStart?.()
        break

      case "map_content":
        callbacks.onMapContent?.(chunk.content || "")
        break

      case "map_ready":
        callbacks.onMapReady?.({
          conceptMap: chunk.concept_map ?? null,
          markmapMarkdown: chunk.markmap_markdown ?? null,
        })
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
        callbacks.onDone({
          fullContent: state.fullContent,
          fullReasoning: state.fullReasoning,
          conceptMap: chunk.concept_map ?? null,
          markmapMarkdown: chunk.markmap_markdown ?? null,
        })
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
