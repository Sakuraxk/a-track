import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  fetchSessionsMock,
  fetchSessionHistoryMock,
  deleteSessionMock,
} = vi.hoisted(() => ({
  fetchSessionsMock: vi.fn(),
  fetchSessionHistoryMock: vi.fn(),
  deleteSessionMock: vi.fn(),
}))

vi.mock("@/lib/chatApi", () => ({
  fetchSessions: (...args: unknown[]) => fetchSessionsMock(...args),
  fetchSessionHistory: (...args: unknown[]) => fetchSessionHistoryMock(...args),
  deleteSessionApi: (...args: unknown[]) => deleteSessionMock(...args),
}))

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: { profile: { user_id: string; ability_tags: Record<string, number> } }) => unknown) =>
    selector({
      profile: {
        user_id: "user-1",
        ability_tags: {},
      },
    }),
}))

import UnifiedAIPanel from "@/components/ai-chat/UnifiedAIPanel"
import { useChatStore } from "@/stores/chat"

function buildSession(id: string, title: string, scopeType: "concept" | "global", scopeId: string) {
  const now = new Date().toISOString()
  return {
    id,
    user_id: "user-1",
    title,
    role: "explainer",
    knowledge_node_code: null,
    exercise_id: null,
    scope_type: scopeType,
    scope_id: scopeId,
    is_active: true,
    created_at: now,
    updated_at: now,
    message_count: 1,
  }
}

describe("Session history tabs", () => {
  beforeEach(async () => {
    localStorage.clear()
    vi.clearAllMocks()

    const conceptSessions = [
      buildSession("c1", "概念：二分查找", "concept", "task_1_1"),
      buildSession("c2", "概念：边界条件", "concept", "task_1_1"),
    ]
    const globalSessions = [
      buildSession("g1", "全局：循环技巧", "global", "subject_python"),
      buildSession("g2", "Global for tips", "global", "subject_python"),
    ]

    fetchSessionsMock.mockImplementation(
      async (_userId: string, scope?: { scopeType?: string }, keyword?: string) => {
        const source = scope?.scopeType === "global" ? globalSessions : conceptSessions
        const key = (keyword || "").toLowerCase()
        const filtered = key
          ? source.filter((item) => (item.title || "").toLowerCase().includes(key))
          : source
        return { sessions: filtered, total: filtered.length }
      }
    )
    fetchSessionHistoryMock.mockResolvedValue({ session: null, messages: [] })
    deleteSessionMock.mockResolvedValue(undefined)

    useChatStore.setState({
      isOpen: true,
      panelCollapsed: false,
      panelWidth: 420,
      panelDock: "right",
      panelActiveTab: "history",
      activeScopeKey: "concept:task_1_1",
      sessions: [],
      currentSessionId: null,
      sessionId: null,
      sessionByScope: {},
      messages: [{ role: "ai", content: "你好！我是 AI 助手，有什么可以帮助你的？" }],
      isStreaming: false,
    })
    await act(async () => {
      await (useChatStore as unknown as { persist?: { rehydrate: () => Promise<void> } }).persist?.rehydrate?.()
    })
  })

  it("switches between concept-grouped history and global timeline", async () => {
    render(<UnifiedAIPanel />)

    await waitFor(() => {
      expect(fetchSessionsMock).toHaveBeenCalledWith(
        "user-1",
        { scopeType: "concept", scopeId: "task_1_1" },
        ""
      )
    })
    expect(screen.getByText("概念：二分查找")).toBeInTheDocument()
    expect(screen.queryByText("全局：循环技巧")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "全局时间线" }))
    await waitFor(() => {
      expect(fetchSessionsMock).toHaveBeenCalledWith(
        "user-1",
        { scopeType: "global" },
        ""
      )
    })
    expect(screen.getByText("全局：循环技巧")).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("搜索历史会话"), { target: { value: "for" } })
    await waitFor(() => {
      expect(fetchSessionsMock).toHaveBeenCalledWith(
        "user-1",
        { scopeType: "global" },
        "for"
      )
    })
    expect(screen.getByText("Global for tips")).toBeInTheDocument()
    expect(screen.queryByText("全局：循环技巧")).not.toBeInTheDocument()
  })
})
