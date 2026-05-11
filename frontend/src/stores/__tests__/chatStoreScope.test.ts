import { beforeEach, describe, expect, it } from "vitest"

import { useChatStore } from "@/stores/chat"

describe("chat store scope", () => {
  beforeEach(async () => {
    localStorage.clear()
    useChatStore.setState({
      isOpen: false,
      messages: [{ role: "ai", content: "你好！我是 AI 助手，有什么可以帮助你的？" }],
      sessionId: null,
      currentSessionId: null,
      activeScopeKey: "global",
      sessionByScope: {},
    })
    await (useChatStore as unknown as { persist?: { rehydrate: () => Promise<void> } }).persist?.rehydrate?.()
  })

  it("keeps separate session pointers per scope key", () => {
    const store = useChatStore.getState()

    store.setActiveScope({
      scopeType: "concept",
      scopeId: "task_1_1",
    })
    store.setSessionId("session-concept")

    store.setActiveScope({
      scopeType: "global",
    })
    store.setSessionId("session-global")

    store.setActiveScope({
      scopeType: "concept",
      scopeId: "task_1_1",
    })

    const state = useChatStore.getState()
    expect(state.currentSessionId).toBe("session-concept")
    expect(state.sessionByScope["concept:task_1_1"]).toBe("session-concept")
    expect(state.sessionByScope["global"]).toBe("session-global")
  })
})
