import { api } from "@/lib/api"
import type { LearningPath } from "@/stores/learning-path"

export type SkillTreeNode = {
  id: string
  label: string
  description: string
  tags: string[]
  children: SkillTreeNode[]
}

export type LearningPathMap = {
  subject_key: string
  version: number
  is_active: boolean
  tree: SkillTreeNode
  snapshot_id?: string
  snapshot_name?: string
}

export type AgentMessage = {
  role: "assistant" | "user"
  message_type: string
  content: string
  structured_payload?: Record<string, unknown> | null
}

export type ClarificationSession = {
  session_id: string
  user_id: string
  subject_key: string
  status: string
  current_turn_index: number
  messages: AgentMessage[]
}

export type PreferenceSnapshotPayload = {
  known_node_ids: string[]
  target_node_ids: string[]
  avoid_node_ids: string[]
  free_text_notes?: string | null
}

export type ReadyCheck = {
  session_id: string
  ready: boolean
  missing_items: string[]
  summary: string
}

export type SessionGenerateResponse = {
  session_id: string
  ready_check: ReadyCheck
  context: {
    session_id: string
    goal_summary: string
    constraints_json: Record<string, unknown>
    prompt_inputs_json: Record<string, unknown>
  }
  path: LearningPath
}

export type ExpandSkillNodeResponse = {
  subject_key: string
  version: number
  is_active: boolean
  tree: SkillTreeNode
  expanded_parent_id: string
  new_node_ids: string[]
  snapshot_id?: string
  snapshot_name?: string
}

export type SkillTreeSnapshot = {
  id: string
  name: string
  is_active: boolean
  base_version: number
  node_count: number
  expansion_count: number
  created_at: string
  updated_at: string
}

export type ClarificationStreamDonePayload = {
  session: ClarificationSession
  ready_check: ReadyCheck | null
  source?: string
}

export type ClarificationStreamOptionsPayload = {
  quick_options: string[]
  structured_payload?: Record<string, unknown> | null
}

export type ClarificationStreamCallbacks = {
  onStart: (session: ClarificationSession) => void
  onContent: (content: string) => void
  onOptions: (payload: ClarificationStreamOptionsPayload) => void
  onDone: (payload: ClarificationStreamDonePayload) => void
  onError: (error: string) => void
}

export async function fetchLearningPathMap(subjectKey: string, userId?: string) {
  const response = await api.get<LearningPathMap>(`/api/learning-path-map/${subjectKey}`, {
    params: userId ? { user_id: userId } : undefined,
  })
  return response.data
}

export async function startClarificationSession(userId: string, subjectKey: string) {
  const response = await api.post<ClarificationSession>(
    `/api/ai-learning-path/session/start`,
    { subject_key: subjectKey },
    { params: { user_id: userId } },
  )
  return response.data
}

export async function getClarificationSession(sessionId: string) {
  const response = await api.get<ClarificationSession>(`/api/ai-learning-path/session/${sessionId}`)
  return response.data
}

export async function replyClarificationSession(sessionId: string, content: string) {
  const response = await api.post<ClarificationSession>(
    `/api/ai-learning-path/session/${sessionId}/reply`,
    { content },
  )
  return response.data
}

export async function savePreferenceSnapshot(sessionId: string, payload: PreferenceSnapshotPayload) {
  const response = await api.put<PreferenceSnapshotPayload & { session_id: string }>(
    `/api/ai-learning-path/session/${sessionId}/preference-snapshot`,
    payload,
  )
  return response.data
}

export async function getReadyCheck(sessionId: string) {
  const response = await api.get<ReadyCheck>(`/api/ai-learning-path/session/${sessionId}/ready-check`)
  return response.data
}

export async function generateLearningPathFromSession(sessionId: string) {
  const response = await api.post<SessionGenerateResponse>(
    `/api/ai-learning-path/session/${sessionId}/generate`,
    undefined,
    { timeout: 300000 }
  )
  return response.data
}

export async function expandLearningPathSkillNode(
  sessionId: string,
  nodeId: string,
  mode: "curriculum" | "practical",
) {
  const response = await api.post<ExpandSkillNodeResponse>(
    `/api/ai-learning-path/session/${sessionId}/expand-node`,
    { node_id: nodeId, mode },
    { timeout: 300000 }
  )
  return response.data
}

// ── 星图快照 API ──────────────────────────────────────────

export async function fetchSkillTreeSnapshots(subjectKey: string, userId: string) {
  const response = await api.get<{ snapshots: SkillTreeSnapshot[] }>(
    `/api/learning-path-map/${subjectKey}/snapshots`,
    { params: { user_id: userId } },
  )
  return response.data.snapshots
}

export async function createSkillTreeSnapshot(
  subjectKey: string,
  userId: string,
  name: string,
  source: "current" | "system",
) {
  const response = await api.post<SkillTreeSnapshot>(
    `/api/learning-path-map/${subjectKey}/snapshots`,
    { user_id: userId, name, source },
  )
  return response.data
}

export async function activateSkillTreeSnapshot(
  subjectKey: string,
  snapshotId: string,
  userId: string,
) {
  await api.put(
    `/api/learning-path-map/${subjectKey}/snapshots/${snapshotId}/activate`,
    { user_id: userId },
  )
}

export async function renameSkillTreeSnapshot(
  subjectKey: string,
  snapshotId: string,
  userId: string,
  name: string,
) {
  await api.put(
    `/api/learning-path-map/${subjectKey}/snapshots/${snapshotId}/rename`,
    { user_id: userId, name },
  )
}

export async function deleteSkillTreeSnapshot(
  subjectKey: string,
  snapshotId: string,
  userId: string,
) {
  await api.delete(
    `/api/learning-path-map/${subjectKey}/snapshots/${snapshotId}`,
    { params: { user_id: userId } },
  )
}

export async function resetSkillTreeSnapshot(
  subjectKey: string,
  snapshotId: string,
  userId: string,
) {
  const response = await api.post<LearningPathMap>(
    `/api/learning-path-map/${subjectKey}/snapshots/${snapshotId}/reset`,
    { user_id: userId },
  )
  return response.data
}

async function streamClarificationRequest(
  url: string,
  body: Record<string, unknown>,
  callbacks: ClarificationStreamCallbacks,
) {
  const abortController = new AbortController()
  const initialTimeoutId = setTimeout(() => abortController.abort(), 60000)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: abortController.signal,
    })

    clearTimeout(initialTimeoutId)

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("无法获取澄清响应流")
    }

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const readTimeoutId = setTimeout(() => abortController.abort(), 60000)
      let done = false
      let value: Uint8Array | undefined

      try {
        const result = await reader.read()
        done = result.done
        value = result.value
      } finally {
        clearTimeout(readTimeoutId)
      }

      if (done) {
        if (buffer.trim()) {
          processClarificationSseBlock(buffer, callbacks)
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const chunks = buffer.split("\n\n")
      buffer = chunks.pop() || ""

      for (const chunk of chunks) {
        processClarificationSseBlock(chunk, callbacks)
      }
    }
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("请求超时，网络连接不稳定，请稍后重试")
    }
    throw error
  }
}

function processClarificationSseBlock(
  block: string,
  callbacks: ClarificationStreamCallbacks,
) {
  const trimmed = block.trim()
  if (!trimmed || !trimmed.startsWith("data: ")) {
    return
  }

  const payload = JSON.parse(trimmed.slice(6)) as
    | { type: "start"; session: ClarificationSession }
    | { type: "content"; content: string }
    | { type: "options"; quick_options?: string[]; structured_payload?: Record<string, unknown> | null }
    | ({ type: "done" } & ClarificationStreamDonePayload)
    | { type: "error"; content: string }

  switch (payload.type) {
    case "start":
      callbacks.onStart(payload.session)
      break
    case "content":
      callbacks.onContent(payload.content || "")
      break
    case "options":
      callbacks.onOptions({
        quick_options: Array.isArray(payload.quick_options) ? payload.quick_options : [],
        structured_payload: payload.structured_payload ?? null,
      })
      break
    case "done":
      callbacks.onDone({
        session: payload.session,
        ready_check: payload.ready_check,
        source: payload.source,
      })
      break
    case "error":
      callbacks.onError(payload.content || "流式澄清失败")
      throw new Error(payload.content || "流式澄清失败")
  }
}

export async function streamStartClarificationSession(
  userId: string,
  subjectKey: string,
  callbacks: ClarificationStreamCallbacks,
) {
  await streamClarificationRequest(
    `/api/ai-learning-path/session/start/stream?user_id=${encodeURIComponent(userId)}`,
    { subject_key: subjectKey },
    callbacks,
  )
}

export async function streamReplyClarificationSession(
  sessionId: string,
  content: string,
  callbacks: ClarificationStreamCallbacks,
) {
  await streamClarificationRequest(
    `/api/ai-learning-path/session/${sessionId}/reply/stream`,
    { content },
    callbacks,
  )
}
