import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ChatScope } from "@/lib/chatApi"

/** Context about what the user is currently learning (set by ConceptLearning page) */
export type LearningContext = {
  subject?: string
  chapterTitle?: string
  chapterSummary?: string
  taskId?: string
}

export type ChatMessage = {
  role: "user" | "ai"
  content: string
  reasoning?: string
  isStreaming?: boolean
}

type ChatState = {
  isOpen: boolean
  messages: ChatMessage[]
  sessionId: string | null
  currentSessionId: string | null

  chatInput: string
  isStreaming: boolean
  abortController: AbortController | null
  hideGlobalButton: boolean
  panelCollapsed: boolean
  panelWidth: number
  panelDock: "right" | "floating"
  activeScopeKey: string
  learningContext: LearningContext | null

  // Actions
  toggleOpen: () => void
  setOpen: (open: boolean) => void
  addMessage: (msg: ChatMessage) => void
  clearMessages: () => void
  setSessionId: (id: string | null) => void

  setChatInput: (input: string) => void
  setIsStreaming: (streaming: boolean) => void
  setAbortController: (controller: AbortController | null) => void
  updateLastMessage: (update: Partial<ChatMessage>) => void
  appendToLastMessage: (content: string, reasoning?: string) => void
  setHideGlobalButton: (hide: boolean) => void
  setActiveScope: (scope: ChatScope) => void
  setPanelCollapsed: (collapsed: boolean) => void
  setPanelWidth: (width: number) => void
  setPanelDock: (dock: "right" | "floating") => void
  setLearningContext: (ctx: LearningContext | null) => void
  startNewSession: () => void
}

const WELCOME_MSG: ChatMessage = {
  role: "ai",
  content: "你好！我是 AI 助手，有什么可以帮助你的？",
}

function buildScopeKey(scope?: ChatScope): string {
  const scopeType = scope?.scopeType ?? "global"
  if (scopeType === "global") {
    return "global"
  }
  return `${scopeType}:${scope?.scopeId ?? "default"}`
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      messages: [WELCOME_MSG],
      sessionId: null,
      currentSessionId: null,

      chatInput: "",
      isStreaming: false,
      abortController: null,
      hideGlobalButton: false,
      panelCollapsed: false,
      panelWidth: 420,
      panelDock: "right",
      activeScopeKey: "global",
      learningContext: null,

      toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
      setOpen: (open) => set({ isOpen: open }),
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      clearMessages: () =>
        set(() => ({
          messages: [{ role: "ai", content: "新会话已开始，有什么可以帮助你的？" }],
          sessionId: null,
          currentSessionId: null,
          isStreaming: false,
          abortController: null,
        })),
      setSessionId: (id) =>
        set(() => ({
          sessionId: id,
          currentSessionId: id,
        })),

      setChatInput: (input) => set({ chatInput: input }),
      setIsStreaming: (streaming) => set({ isStreaming: streaming }),
      setAbortController: (ctrl) => set({ abortController: ctrl }),
      setHideGlobalButton: (hide) => set({ hideGlobalButton: hide }),
      setActiveScope: (scope) =>
        set(() => {
          const scopeKey = buildScopeKey(scope)
          return {
            activeScopeKey: scopeKey,
            currentSessionId: null,
            sessionId: null,
          }
        }),
      setPanelCollapsed: (collapsed) => set({ panelCollapsed: collapsed }),
      setPanelWidth: (width) =>
        set({
          panelWidth: Math.max(320, Math.min(720, width)),
        }),
      setPanelDock: (dock) => set({ panelDock: dock }),
      setLearningContext: (ctx) => set({ learningContext: ctx }),

      updateLastMessage: (update) =>
        set((s) => {
          const msgs = [...s.messages]
          if (msgs.length > 0) {
            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], ...update }
          }
          return { messages: msgs }
        }),

      appendToLastMessage: (content, reasoning) =>
        set((s) => {
          const msgs = [...s.messages]
          if (msgs.length > 0) {
            const last = msgs[msgs.length - 1]
            msgs[msgs.length - 1] = {
              ...last,
              content: last.content + content,
              reasoning:
                reasoning !== undefined
                  ? (last.reasoning || "") + reasoning
                  : last.reasoning,
            }
          }
          return { messages: msgs }
        }),

      startNewSession: () => {
        get().abortController?.abort()
        set(() => ({
          messages: [WELCOME_MSG],
          sessionId: null,
          currentSessionId: null,
          isStreaming: false,
          abortController: null,
          chatInput: "",
          learningContext: null,
        }))
      },
    }),
    {
      name: "chat-store-v3",
      partialize: (state) => ({
        isOpen: state.isOpen,
        panelCollapsed: state.panelCollapsed,
        panelWidth: state.panelWidth,
        panelDock: state.panelDock,
        activeScopeKey: state.activeScopeKey,
      }),
    }
  )
)
