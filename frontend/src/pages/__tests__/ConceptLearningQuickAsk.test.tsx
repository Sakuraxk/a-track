import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import ConceptLearning from "@/pages/ConceptLearning"
import UnifiedAIPanel from "@/components/ai-chat/UnifiedAIPanel"
import { useChatStore } from "@/stores/chat"

const { mockStreamConceptContent, mockGetCachedContent, mockDeleteConceptContent, mockGenerateConceptExercises } = vi.hoisted(() => ({
  mockStreamConceptContent: vi.fn(),
  mockGetCachedContent: vi.fn(async () => ({
    exists: true,
    markmap_markdown: "# 二分查找基础\n## 二分查找基础",
    concept_map: { root: "二分查找基础", nodes: [], edges: [], chapter_order: [] },
    content: "## 二分查找基础\n这是可选中的内容。",
    reasoning: "",
  })),
  mockDeleteConceptContent: vi.fn(),
  mockGenerateConceptExercises: vi.fn(),
}))

const mockStreamChat = vi.fn()

vi.mock("@ant-design/x-markdown", () => ({
  XMarkdown: ({ content }: { content: string }) => <div>{content}</div>,
  useStreaming: (content: string) => content,
}))

vi.mock("@/components/concept/ConceptMarkmap", () => ({
  default: ({ markdown }: { markdown: string }) => <div data-testid="concept-markmap">{markdown}</div>,
}))

vi.mock("@/lib/streamConceptContent", () => ({
  streamConceptContent: mockStreamConceptContent,
  generateConceptExercises: mockGenerateConceptExercises,
  getCachedContent: mockGetCachedContent,
  deleteConceptContent: mockDeleteConceptContent,
}))

vi.mock("@/lib/streamChat", () => ({
  streamChat: (...args: unknown[]) => mockStreamChat(...args),
}))

const mockProfile = { user_id: "user-1", ability_tags: { python: 0.8 } }

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: { profile: typeof mockProfile }) => unknown) =>
    selector({ profile: mockProfile }),
}))

vi.mock("@/stores/learning-path", () => ({
  useLearningPathStore: (selector: (state: { updateTaskCompletion: (...args: unknown[]) => void }) => unknown) =>
    selector({ updateTaskCompletion: vi.fn() }),
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}))

function renderConceptLearningPage(
  initialEntry = "/app/concept-learning/task-001?title=二分查找基础&subject=Python"
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/app/concept-learning/:taskId"
          element={
            <>
              <ConceptLearning />
              <UnifiedAIPanel />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe("ConceptLearning 选中即问", () => {
  beforeEach(() => {
    localStorage.clear()
    mockStreamChat.mockReset()
    mockStreamConceptContent.mockReset()
    mockDeleteConceptContent.mockReset()
    mockGetCachedContent.mockClear()
    mockStreamChat.mockImplementation(async (_userId, _request, callbacks) => {
      callbacks.onSession?.("session-1")
      callbacks.onDone?.("收到", "")
    })
    useChatStore.setState({
      isOpen: false,
      panelCollapsed: false,
      panelDock: "right",
      panelWidth: 420,
      currentSessionId: null,
      sessionId: null,
      activeScopeKey: "global",
      sessionByScope: {},
      messages: [{ role: "ai", content: "你好！我是 AI 助手，有什么可以帮助你的？" }],
      isStreaming: false,
      sessions: [],
    })
  })

  it("opens quick ask when text is selected and sends scoped context", async () => {
    renderConceptLearningPage()

    const removeAllRanges = vi.fn()
    const selectionSpy = vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "二分查找",
      rangeCount: 1,
      getRangeAt: () =>
        ({
          getBoundingClientRect: () => ({
            left: 16,
            top: 16,
            right: 96,
            bottom: 40,
            width: 80,
            height: 24,
            x: 16,
            y: 16,
            toJSON: () => ({}),
          }),
        }) as Range,
      removeAllRanges,
    } as Selection)

    fireEvent.mouseUp(await screen.findByText(/可选中的内容/))
    fireEvent.click(await screen.findByRole("button", { name: "就这段提问" }))

    await waitFor(() => {
      expect(mockStreamChat).toHaveBeenCalledTimes(1)
    })

    const [, request, , scope] = mockStreamChat.mock.calls[0]
    expect(scope).toEqual({ scopeType: "concept", scopeId: "task-001" })
    expect(request).toEqual(
      expect.objectContaining({
        message: expect.stringContaining("二分查找"),
        context: expect.objectContaining({
          selected_text: "二分查找",
          section_title: "二分查找基础",
          task_id: "task-001",
        }),
      })
    )
    expect(removeAllRanges).toHaveBeenCalled()

    selectionSpy.mockRestore()
  })

  it("loads cached concept content with learning-path version and chapter metadata", async () => {
    renderConceptLearningPage(
      "/app/concept-learning/task-001?title=二分查找基础&subject=Python&pathId=path-1&version=2&versionName=%E5%AD%A6%E4%B9%A0%E8%AE%A1%E5%88%92%20v2&chapterId=day-1&chapterTitle=%E5%BC%82%E6%AD%A5%E5%9F%BA%E7%A1%80&day=1"
    )

    await screen.findByText(/可选中的内容/)

    expect(mockGetCachedContent).toHaveBeenCalledWith(
      "user-1",
      "task-001",
      expect.objectContaining({
        learning_path_id: "path-1",
        learning_path_version: 2,
        learning_path_version_name: "学习计划 v2",
        source_day: 1,
        source_chapter_id: "day-1",
        source_chapter_title: "异步基础",
        source_task_title: "二分查找基础",
      })
    )
  })
})
