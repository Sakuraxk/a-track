import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { act, type ReactNode } from "react"
import userEvent from "@testing-library/user-event"

import AILearningPath from "@/pages/AILearningPath"
import { useLearningPathWorkbenchStore } from "@/stores/learning-path-workbench"

function createSseResponse(events: Array<Record<string, unknown>>, chunkDelayMs = 0) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = (index: number) => {
        if (index >= events.length) {
          controller.close()
          return
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(events[index])}\n\n`))
        if (chunkDelayMs > 0) {
          setTimeout(() => push(index + 1), chunkDelayMs)
          return
        }
        push(index + 1)
      }

      push(0)
    },
  })

  return Promise.resolve(
    new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    }),
  )
}

const {
  mockSetPathForSubject,
  mockUpdateTaskCompletion,
  mockClearPathForSubject,
  mockStartGenerating,
  mockSetGeneratingStep,
  mockStopGenerating,
  mockSetVersionsForSubject,
  learningPathStoreState,
  mockApiGet,
  mockApiPost,
  mockApiPut,
  mockApiPatch,
  mockApiDelete,
  mockNavigate,
  mockFetch,
} = vi.hoisted(() => {
  const mockSetPathForSubject = vi.fn()
  const mockUpdateTaskCompletion = vi.fn()
  const mockClearPathForSubject = vi.fn()
  const mockStartGenerating = vi.fn()
  const mockSetGeneratingStep = vi.fn()
  const mockStopGenerating = vi.fn()
  const mockSetVersionsForSubject = vi.fn()
  const learningPathStoreState = {
    pathsBySubject: {} as Record<string, unknown>,
    getPathForSubject: vi.fn((subjectKey: string) => learningPathStoreState.pathsBySubject[subjectKey] ?? null),
    setPathForSubject: mockSetPathForSubject,
    updateTaskCompletion: mockUpdateTaskCompletion,
    clearPathForSubject: mockClearPathForSubject,
    generating: false,
    generatingStep: 0,
    startGenerating: mockStartGenerating,
    setGeneratingStep: mockSetGeneratingStep,
    stopGenerating: mockStopGenerating,
    setVersionsForSubject: mockSetVersionsForSubject,
  }

  return {
    mockSetPathForSubject,
    mockUpdateTaskCompletion,
    mockClearPathForSubject,
    mockStartGenerating,
    mockSetGeneratingStep,
    mockStopGenerating,
    mockSetVersionsForSubject,
    learningPathStoreState,
    mockApiGet: vi.fn(),
    mockApiPost: vi.fn(),
    mockApiPut: vi.fn(),
    mockApiPatch: vi.fn(),
    mockApiDelete: vi.fn(),
    mockNavigate: vi.fn(),
    mockFetch: vi.fn(),
  }
})

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@/lib/api", () => ({
  api: {
    get: mockApiGet,
    post: mockApiPost,
    put: mockApiPut,
    patch: mockApiPatch,
    delete: mockApiDelete,
  },
  getApiErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "unknown error",
}))

vi.mock("@/components/navigation/SubjectGate", () => ({
  SubjectGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/navigation/SubPageHeader", () => ({
  SubPageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  ),
}))

vi.mock("@/components/knowledge-graph/FullKnowledgeGraph", () => ({
  FullKnowledgeGraph: () => <div data-testid="knowledge-graph" />,
}))

vi.mock("@/stores/auth", () => ({
  useAuthStore: vi.fn((selector: (state: unknown) => unknown) =>
    selector({
      profile: {
        user_id: "user-1",
        ability_tags: { python: 60 },
      },
    })
  ),
}))

vi.mock("@/stores/subject", () => ({
  useSubjectStore: vi.fn((selector: (state: unknown) => unknown) =>
    selector({
      currentSubjectId: "python",
      subjects: [
        {
          id: "python",
          key: "python",
          name: "Python 编程",
          icon: "🐍",
          description: "Python",
          onboarding_status: "completed",
          progress_percent: 40,
          mastered_nodes: 4,
          total_nodes: 10,
        },
      ],
    })
  ),
}))

vi.mock("@/stores/learning-path", () => {
  const useLearningPathStore = vi.fn((selector?: (state: typeof learningPathStoreState) => unknown) =>
    selector ? selector(learningPathStoreState) : learningPathStoreState
  )
  ;(useLearningPathStore as typeof useLearningPathStore & { getState: () => typeof learningPathStoreState }).getState = () =>
    learningPathStoreState

  return {
    useLearningPathStore,
  }
})

describe("AILearningPath 工作台骨架", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", mockFetch)

    learningPathStoreState.pathsBySubject = {}
    let readyCheckPayload = {
      session_id: "session-1",
      ready: false,
      missing_items: ["goal", "confirmation"],
      summary: "学习目标：待补充；当前水平：待补充；时间安排：待补充；确认状态：待确认",
    }

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes("/api/ai-learning-path/user/user-1/active")) {
        return Promise.resolve({
          data: {
            id: "path-1",
            user_id: "user-1",
            goal: "掌握 Python 自动化",
            total_days: 14,
            daily_minutes: 45,
            created_at: "2026-03-14T00:00:00Z",
            progress_percent: 25,
            current_day: 2,
            days: [],
            version: 2,
            version_name: "学习计划 v2",
            is_active: true,
          },
        })
      }

      if (url.includes("/api/ai-learning-path/user/user-1/versions")) {
        return Promise.resolve({
          data: {
            success: true,
            versions: [
              {
                id: "path-1",
                version: 2,
                version_name: "学习计划 v2",
                is_active: true,
                goal: "掌握 Python 自动化",
                total_days: 14,
                daily_minutes: 45,
                progress_percent: 25,
                current_day: 2,
                generated_days: 7,
                created_at: "2026-03-14T00:00:00Z",
                archived_at: null,
              },
            ],
            active_version: {
              id: "path-1",
              version: 2,
              version_name: "学习计划 v2",
              is_active: true,
              goal: "掌握 Python 自动化",
              total_days: 14,
              daily_minutes: 45,
              progress_percent: 25,
              current_day: 2,
              generated_days: 7,
              created_at: "2026-03-14T00:00:00Z",
              archived_at: null,
            },
          },
        })
      }

      if (url.includes("/api/learning-path-map/python")) {
        return Promise.resolve({
          data: {
            subject_key: "python",
            version: 1,
            is_active: true,
            tree: {
              id: "python",
              label: "Python 学习路线",
              description: "Python",
              tags: ["python"],
              children: [
                {
                  id: "python.syntax.variables",
                  label: "变量与数据类型",
                  description: "基础语法",
                  tags: ["foundation"],
                  children: [],
                },
              ],
            },
          },
        })
      }

      if (url.includes("/ready-check")) {
        return Promise.resolve({ data: readyCheckPayload })
      }

      return Promise.reject(new Error(`Unhandled GET ${url}`))
    })

    mockApiPost.mockImplementation((url: string) => {
      if (url.includes("/generate")) {
        return Promise.resolve({
          data: {
            session_id: "session-1",
            ready_check: {
              session_id: "session-1",
              ready: true,
              missing_items: [],
              summary: "生成条件满足。",
            },
            context: {
              session_id: "session-1",
              goal_summary: "聚焦 Python 自动化与异步能力。",
              constraints_json: {
                target_node_ids: ["python.syntax.variables"],
              },
              prompt_inputs_json: {},
            },
            path: {
              id: "path-3",
              user_id: "user-1",
              goal: "聚焦 Python 自动化与异步能力。",
              total_days: 14,
              daily_minutes: 45,
              created_at: "2026-03-14T00:00:00Z",
              progress_percent: 0,
              current_day: 1,
              days: [],
              version: 3,
              version_name: "学习计划 v3",
              is_active: true,
              generated_days: 7,
              phase_size: 7,
            },
          },
        })
      }

      if (url.includes("/expand-node")) {
        return Promise.resolve({
          data: {
            subject_key: "python",
            version: 1,
            is_active: true,
            expanded_parent_id: "python.syntax.variables",
            new_node_ids: ["python.syntax.variables.variable-naming"],
            tree: {
              id: "python",
              label: "Python 学习路线",
              description: "Python",
              tags: ["python"],
              children: [
                {
                  id: "python.syntax.variables",
                  label: "变量与数据类型",
                  description: "基础语法",
                  tags: ["foundation"],
                  children: [
                    {
                      id: "python.syntax.variables.variable-naming",
                      label: "变量命名规范",
                      description: "理解变量命名、可读性与一致性。",
                      tags: ["foundation", "user-generated"],
                      children: [],
                    },
                  ],
                },
              ],
            },
          },
        })
      }

      return Promise.reject(new Error(`Unhandled POST ${url}`))
    })

    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/session/start/stream")) {
        return createSseResponse([
          {
            type: "start",
            session: {
              session_id: "session-1",
              user_id: "user-1",
              subject_key: "python",
              status: "collecting",
              current_turn_index: 0,
              messages: [],
            },
          },
          { type: "content", content: "你最想优先掌握哪些 Python 能力？" },
          {
            type: "done",
            session: {
              session_id: "session-1",
              user_id: "user-1",
              subject_key: "python",
              status: "awaiting_user",
              current_turn_index: 1,
              messages: [
                {
                  role: "assistant",
                  message_type: "question",
                  content: "你最想优先掌握哪些 Python 能力？",
                  structured_payload: {
                    quick_options: [
                      "构建自动化工具",
                      "补强异步编程",
                      "建立 pytest 测试习惯",
                    ],
                  },
                },
              ],
            },
            ready_check: readyCheckPayload,
            source: "llm",
          },
        ])
      }

      if (url.includes("/reply/stream")) {
        readyCheckPayload = {
          session_id: "session-1",
          ready: true,
          missing_items: [],
          summary: "学习目标：构建自动化工具；当前水平：基础语法熟悉；时间安排：每天 45 分钟；确认状态：已确认，可生成",
        }

        return createSseResponse([
          {
            type: "start",
            session: {
              session_id: "session-1",
              user_id: "user-1",
              subject_key: "python",
              status: "collecting",
              current_turn_index: 1,
              messages: [
                {
                  role: "assistant",
                  message_type: "question",
                  content: "你最想优先掌握哪些 Python 能力？",
                  structured_payload: {
                    quick_options: [
                      "构建自动化工具",
                      "补强异步编程",
                      "建立 pytest 测试习惯",
                    ],
                  },
                },
                {
                  role: "user",
                  message_type: "answer",
                  content: "构建自动化工具",
                },
              ],
            },
          },
          { type: "content", content: "已收敛到可生成状态。" },
          { type: "content", content: "你仍然可以继续补充日志处理、脚本拆解等细节。" },
          {
            type: "done",
            session: {
              session_id: "session-1",
              user_id: "user-1",
              subject_key: "python",
              status: "awaiting_user",
              current_turn_index: 5,
              messages: [
                {
                  role: "assistant",
                  message_type: "question",
                  content: "你最想优先掌握哪些 Python 能力？",
                  structured_payload: {
                    quick_options: [
                      "构建自动化工具",
                      "补强异步编程",
                      "建立 pytest 测试习惯",
                    ],
                  },
                },
                {
                  role: "user",
                  message_type: "answer",
                  content: "构建自动化工具",
                },
                {
                  role: "assistant",
                  message_type: "summary",
                  content: "已收敛到可生成状态。你仍然可以继续补充日志处理、脚本拆解等细节。",
                  structured_payload: {
                    mode: "open_supplement",
                    quick_options: [
                      "补充日志处理",
                      "加入真实脚本拆解",
                    ],
                  },
                },
              ],
            },
            ready_check: readyCheckPayload,
            source: "llm",
          },
        ])
      }

      return Promise.reject(new Error(`Unhandled fetch ${url}`))
    })

    mockApiPut.mockImplementation((url: string, payload: unknown) => {
      if (url.includes("/preference-snapshot")) {
        readyCheckPayload = {
          session_id: "session-1",
          ready: false,
          missing_items: ["confirmation"],
          summary: "学习目标：待补充；当前水平：待补充；时间安排：每天 45 分钟；确认状态：待确认",
        }
        return Promise.resolve({
          data: {
            session_id: "session-1",
            ...(payload as Record<string, unknown>),
          },
        })
      }

      return Promise.resolve({ data: { success: true } })
    })
  })

  it("renders an immersive clarification workbench without the legacy plan schedule", async () => {
    render(
      <MemoryRouter initialEntries={["/app/ai-learning-path"]}>
        <AILearningPath />
      </MemoryRouter>
    )

    const user = userEvent.setup()
    expect(await screen.findByTestId("learning-path-workbench-layout")).toBeInTheDocument()
    expect(await screen.findByTestId("learning-path-tree-panel")).toBeInTheDocument()
    expect(screen.queryByText("节点详情")).not.toBeInTheDocument()
    expect(await screen.findByTestId("learning-path-agent-panel")).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes("会话状态"))).toBeInTheDocument()
    expect(screen.queryByText("Version Summary")).not.toBeInTheDocument()
    expect(screen.queryByText("学习日程")).not.toBeInTheDocument()
  })

  it("shows an entry to open the existing active plan from the workbench", async () => {
    render(
      <MemoryRouter initialEntries={["/app/ai-learning-path"]}>
        <AILearningPath />
      </MemoryRouter>
    )

    const user = userEvent.setup()
    expect(await screen.findByRole("button", { name: "查看当前计划" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "查看当前计划" }))

    expect(mockNavigate).toHaveBeenCalledWith("/app/ai-learning-path/plan/path-1?day=2")
  })

  it("renders quick options, sends replies from option cards, and keeps open supplement mode after five turns", async () => {
    render(
      <MemoryRouter initialEntries={["/app/ai-learning-path"]}>
        <AILearningPath />
      </MemoryRouter>
    )

    const user = userEvent.setup()
    expect(await screen.findByTestId("learning-path-tree-panel")).toBeInTheDocument()
    expect(await screen.findByTestId("learning-path-agent-panel")).toBeInTheDocument()

    expect(screen.getByRole("button", { name: "构建自动化工具" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "补强异步编程" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "构建自动化工具" }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/reply/stream"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ content: "构建自动化工具" }),
        }),
      )
    })

    expect(await screen.findByTestId("learning-path-convergence-card")).toBeInTheDocument()
    const headerGenerateButton = screen.getByTestId("agent-generate-button")
    const progressRow = screen.getByTestId("agent-progress-row")
    expect(headerGenerateButton.compareDocumentPosition(progressRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getAllByText("已收敛到可生成状态。你仍然可以继续补充日志处理、脚本拆解等细节。").length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "我再微调一下" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "直接生成新版本" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText("继续补充细节，或确认可以直接生成学习计划...")).toBeInTheDocument()
  })

  it("navigates to the dedicated plan page after generation succeeds", async () => {
    render(
      <MemoryRouter initialEntries={["/app/ai-learning-path"]}>
        <AILearningPath />
      </MemoryRouter>
    )

    const user = userEvent.setup()
    expect(await screen.findByTestId("learning-path-tree-panel")).toBeInTheDocument()
    expect(await screen.findByTestId("learning-path-agent-panel")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "构建自动化工具" }))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/reply/stream"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ content: "构建自动化工具" }),
        }),
      )
    })

    expect(await screen.findByTestId("learning-path-convergence-card")).toBeInTheDocument()
    const generateButton = screen.getByRole("button", { name: "直接生成新版本" })
    await waitFor(() => {
      expect(generateButton).toBeEnabled()
    })

    await user.click(generateButton)

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        expect.stringContaining("/generate"),
        undefined,
        expect.any(Object),
      )
    })
    await waitFor(() => {
      expect(mockSetPathForSubject).toHaveBeenCalledWith(
        "python",
        expect.objectContaining({ version_name: "学习计划 v3" }),
      )
    })
    expect(mockNavigate).toHaveBeenCalledWith("/app/ai-learning-path/plan/path-3")
  })

  it("allows expanding a target node from the detail panel", async () => {
    render(
      <MemoryRouter initialEntries={["/app/ai-learning-path"]}>
        <AILearningPath />
      </MemoryRouter>
    )

    const user = userEvent.setup()
    expect(await screen.findByTestId("learning-path-tree-panel")).toBeInTheDocument()
    expect(screen.queryByText("节点详情")).not.toBeInTheDocument()
    act(() => {
      useLearningPathWorkbenchStore.getState().setSelectedNodeId("python.syntax.variables")
    })
    expect((await screen.findAllByText("节点详情")).length).toBeGreaterThan(0)

    const expandButton = await screen.findByRole("button", { name: "继续发散" })
    expect(expandButton).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "想学习" }))
    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "继续发散" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "继续发散" }))

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        expect.stringContaining("/expand-node"),
        { node_id: "python.syntax.variables", mode: "curriculum" },
        expect.objectContaining({ timeout: 300000 }),
      )
    })
  })

  it("shows node details only while a node is selected", async () => {
    render(
      <MemoryRouter initialEntries={["/app/ai-learning-path"]}>
        <AILearningPath />
      </MemoryRouter>
    )

    expect(await screen.findByTestId("learning-path-tree-panel")).toBeInTheDocument()
    expect(screen.queryByText("节点详情")).not.toBeInTheDocument()

    act(() => {
      useLearningPathWorkbenchStore.getState().setSelectedNodeId("python.syntax.variables")
    })
    expect((await screen.findAllByText("节点详情")).length).toBeGreaterThan(0)

    act(() => {
      useLearningPathWorkbenchStore.getState().setSelectedNodeId(null)
    })

    await waitFor(() => {
      expect(screen.queryAllByText("节点详情")).toHaveLength(0)
    })
  })

  it("anchors node details near the map and lets the card be dragged", async () => {
    render(
      <MemoryRouter initialEntries={["/app/ai-learning-path"]}>
        <AILearningPath />
      </MemoryRouter>
    )

    expect(await screen.findByTestId("learning-path-tree-panel")).toBeInTheDocument()

    const stage = screen.getByTestId("learning-path-stage")
    Object.defineProperty(stage, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 720,
        right: 960,
        width: 960,
        height: 720,
        toJSON: () => ({}),
      }),
    })

    act(() => {
      useLearningPathWorkbenchStore.getState().setSelectedNodeId("python.syntax.variables")
    })

    const detailCard = await screen.findByTestId("learning-path-detail-card")
    const initialLeft = detailCard.style.left
    const initialTop = detailCard.style.top

    fireEvent.mouseDown(screen.getByTestId("learning-path-detail-drag-handle"), { clientX: 180, clientY: 180 })
    fireEvent.mouseMove(window, { clientX: 320, clientY: 280 })
    fireEvent.mouseUp(window)

    await waitFor(() => {
      expect(detailCard.style.left).not.toBe(initialLeft)
      expect(detailCard.style.top).not.toBe(initialTop)
    })
  })

  it("shows the specific expansion error when star-map divergence is unavailable", async () => {
    mockApiPost.mockImplementation((url: string) => {
      if (url.includes("/expand-node")) {
        return Promise.reject(new Error("未找到可用的技术树发散 LLM 配置"))
      }
      if (url.includes("/generate")) {
        return Promise.resolve({
          data: {
            session_id: "session-1",
            ready_check: {
              session_id: "session-1",
              ready: true,
              missing_items: [],
              summary: "生成条件满足。",
            },
            context: {
              session_id: "session-1",
              goal_summary: "聚焦 Python 自动化与异步能力。",
              constraints_json: {
                target_node_ids: ["python.syntax.variables"],
              },
              prompt_inputs_json: {},
            },
            path: {
              id: "path-3",
              user_id: "user-1",
              goal: "聚焦 Python 自动化与异步能力。",
              total_days: 14,
              daily_minutes: 45,
              created_at: "2026-03-14T00:00:00Z",
              progress_percent: 0,
              current_day: 1,
              days: [],
              version: 3,
              version_name: "学习计划 v3",
              is_active: true,
              generated_days: 7,
              phase_size: 7,
            },
          },
        })
      }
      return Promise.reject(new Error(`Unhandled POST ${url}`))
    })

    render(
      <MemoryRouter initialEntries={["/app/ai-learning-path"]}>
        <AILearningPath />
      </MemoryRouter>
    )

    const user = userEvent.setup()
    expect(await screen.findByTestId("learning-path-tree-panel")).toBeInTheDocument()
    act(() => {
      useLearningPathWorkbenchStore.getState().setSelectedNodeId("python.syntax.variables")
    })

    await user.click(screen.getByRole("button", { name: "想学习" }))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "继续发散" })).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: "继续发散" }))

    expect(await screen.findByText("未找到可用的技术树发散 LLM 配置")).toBeInTheDocument()
  })

  it("shows collapse controls and a minimap for the larger tree", async () => {
    render(
      <MemoryRouter initialEntries={["/app/ai-learning-path"]}>
        <AILearningPath />
      </MemoryRouter>
    )

    const treePanel = await screen.findByTestId("learning-path-tree-panel")
    expect(treePanel).toBeInTheDocument()
    expect(treePanel).toHaveAttribute("data-layout-mode", "compact")
    expect(screen.getByRole("button", { name: "全部展开" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "全部收起" })).toBeInTheDocument()
    expect(screen.getByTestId("learning-path-minimap")).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "全部展开" }))
    await waitFor(() => {
      expect(screen.getByTestId("learning-path-tree-panel")).toHaveAttribute("data-layout-mode", "expanded")
    })

    await user.click(screen.getByRole("button", { name: "全部收起" }))
    await waitFor(() => {
      expect(screen.getByTestId("learning-path-tree-panel")).toHaveAttribute("data-layout-mode", "compact")
    })
  })

  it("streams clarification cards progressively and applies quick options before done", async () => {
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/session/start/stream")) {
        return createSseResponse(
          [
            {
              type: "start",
              session: {
                session_id: "session-1",
                user_id: "user-1",
                subject_key: "python",
                status: "collecting",
                current_turn_index: 0,
                messages: [],
              },
            },
            { type: "content", content: "先别急着选模块，" },
            { type: "content", content: "零基础也完全没关系。" },
            {
              type: "options",
              quick_options: ["先讲基础概念", "先带我跑通示例", "请你先帮我推荐"],
            },
            { type: "content", content: " 为了帮你把起点定得更稳，你更希望先从哪种方式进入 Python 学习？" },
            {
              type: "done",
              session: {
                session_id: "session-1",
                user_id: "user-1",
                subject_key: "python",
                status: "awaiting_user",
                current_turn_index: 1,
                messages: [
                  {
                    role: "assistant",
                    message_type: "question",
                    content: "先别急着选模块，零基础也完全没关系。为了帮你把起点定得更稳，你更希望先从哪种方式进入 Python 学习？",
                    structured_payload: {
                      quick_options: ["先讲基础概念", "先带我跑通示例", "请你先帮我推荐"],
                    },
                  },
                ],
              },
              ready_check: {
                session_id: "session-1",
                ready: false,
                missing_items: ["goal", "confirmation"],
                summary: "学习目标：待补充；当前水平：待补充",
              },
              source: "llm",
            },
          ],
        )
      }

      if (url.includes("/reply/stream")) {
        return createSseResponse([])
      }

      return Promise.reject(new Error(`Unhandled fetch ${url}`))
    })

    render(
      <MemoryRouter initialEntries={["/app/ai-learning-path"]}>
        <AILearningPath />
      </MemoryRouter>
    )

    const user = userEvent.setup()
    expect(await screen.findByTestId("learning-path-agent-panel")).toBeInTheDocument()

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/session/start/stream"),
        expect.objectContaining({ method: "POST" }),
      )
    })
    expect(await screen.findByText(/先别急着选模块，零基础也完全没关系/)).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "先讲基础概念" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "先带我跑通示例" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "请你先帮我推荐" })).toBeInTheDocument()
  })
})
