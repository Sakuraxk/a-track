import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
  },
}))

import { fetchSessions, fetchSessionHistory } from "@/lib/chatApi"
import { streamChat } from "@/lib/streamChat"

describe("chat scope api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requests sessions with scope filters", async () => {
    getMock.mockResolvedValue({
      data: {
        sessions: [],
        total: 0,
      },
    })

    await fetchSessions("user-1", {
      scopeType: "concept",
      scopeId: "task_1_1",
    })

    expect(getMock).toHaveBeenCalledWith("/api/ai-tutor/sessions", {
      params: {
        user_id: "user-1",
        scope_type: "concept",
        scope_id: "task_1_1",
      },
    })
  })

  it("requests session history with scope filters", async () => {
    getMock.mockResolvedValue({
      data: {
        session: null,
        messages: [],
      },
    })

    await fetchSessionHistory("user-1", "session-1", {
      scopeType: "concept",
      scopeId: "task_1_1",
    })

    expect(getMock).toHaveBeenCalledWith("/api/ai-tutor/sessions/session-1", {
      params: {
        user_id: "user-1",
        scope_type: "concept",
        scope_id: "task_1_1",
      },
    })
  })

  it("passes scope to streamChat payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        }),
      },
    })
    vi.stubGlobal("fetch", fetchMock)

    await streamChat(
      "user-1",
      { message: "hello" },
      {
        onSession: vi.fn(),
        onThinking: vi.fn(),
        onContent: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
      {
        scopeType: "concept",
        scopeId: "task_1_1",
      }
    )

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(requestBody.scope_type).toBe("concept")
    expect(requestBody.scope_id).toBe("task_1_1")
  })
})
