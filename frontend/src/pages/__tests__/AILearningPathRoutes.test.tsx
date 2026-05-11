import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter, Outlet } from "react-router-dom"
import userEvent from "@testing-library/user-event"

const { mockInitialEntries, learningPathStoreState, subjectStoreState, mockApiGet, mockApiPost, mockApiPut, mockNavigate } = vi.hoisted(() => {
  return {
    mockInitialEntries: ["/app/ai-learning-path"],
    learningPathStoreState: {
      pathsBySubject: {} as Record<string, unknown>,
      versionsBySubject: {} as Record<string, unknown>,
      setPathForSubject: vi.fn(),
      updateTaskCompletion: vi.fn(),
      clearPathForSubject: vi.fn(),
      clearAllPaths: vi.fn(),
      startGenerating: vi.fn(),
      setGeneratingStep: vi.fn(),
      stopGenerating: vi.fn(),
      setVersionsForSubject: vi.fn(),
      getPathForSubject: vi.fn((subjectKey: string) => learningPathStoreState.pathsBySubject[subjectKey] ?? null),
      getVersionsForSubject: vi.fn((subjectKey: string) => learningPathStoreState.versionsBySubject[subjectKey] ?? []),
    },
    subjectStoreState: {
      currentSubjectId: "python",
      subjects: [
        {
          id: "python",
          key: "python",
          name: "Python 编程",
          description: "Python",
          icon: "🐍",
          onboarding_status: "completed",
          progress_percent: 40,
          mastered_nodes: 4,
          total_nodes: 10,
        },
      ],
    },
    mockApiGet: vi.fn(),
    mockApiPost: vi.fn(),
    mockApiPut: vi.fn(),
    mockNavigate: vi.fn(),
  }
})

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")

  return {
    ...actual,
    BrowserRouter: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={mockInitialEntries}>{children}</MemoryRouter>
    ),
    useNavigate: () => mockNavigate,
  }
})

vi.mock("sonner", () => ({
  Toaster: () => null,
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: mockApiGet,
    post: mockApiPost,
    put: mockApiPut,
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getApiErrorMessage: () => "error",
}))

vi.mock("@/components/layout/MainLayout", () => ({
  default: () => (
    <div data-testid="main-layout">
      <Outlet />
    </div>
  ),
}))

vi.mock("@/components/auth/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ai-chat/UnifiedAIPanel", () => ({
  default: () => null,
}))

vi.mock("@/components/navigation/SubjectGate", () => ({
  SubjectGate: ({ children }: { children: ReactNode }) => <>{children}</>,
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
    selector(subjectStoreState)
  ),
}))

vi.mock("@/stores/learning-path", () => ({
  useLearningPathStore: vi.fn((selector?: (state: typeof learningPathStoreState) => unknown) =>
    selector ? selector(learningPathStoreState) : learningPathStoreState
  ),
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

vi.mock("@/pages/Login", () => ({ default: () => <div>Login</div> }))
vi.mock("@/pages/Register", () => ({ default: () => <div>Register</div> }))
vi.mock("@/pages/Dashboard", () => ({ default: () => <div>Dashboard</div> }))
vi.mock("@/pages/QuestionBank", () => ({ default: () => <div>QuestionBank</div> }))
vi.mock("@/pages/Landing", () => ({ default: () => <div>Landing</div> }))
vi.mock("@/pages/Practice", () => ({ default: () => <div>Practice</div> }))
vi.mock("@/pages/Assessment", () => ({ default: () => <div>Assessment</div> }))
vi.mock("@/pages/ProblemList", () => ({ default: () => <div>ProblemList</div> }))
vi.mock("@/pages/Stats", () => ({ default: () => <div>Stats</div> }))
vi.mock("@/pages/Profile", () => ({ default: () => <div>Profile</div> }))
vi.mock("@/pages/SubjectDetail", () => ({ default: () => <div>SubjectDetail</div> }))
vi.mock("@/pages/ConceptLearning", () => ({ default: () => <div>ConceptLearning</div> }))
vi.mock("@/pages/LearningStudio", () => ({ default: () => <div>LearningStudio</div> }))
vi.mock("@/pages/PromptLab", () => ({ default: () => <div>PromptLab</div> }))

import App from "@/App"

describe("AI 学习路线路由拆分", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
    mockInitialEntries.splice(0, mockInitialEntries.length, "/app/ai-learning-path")
    learningPathStoreState.pathsBySubject = {}
    learningPathStoreState.versionsBySubject = {}
    subjectStoreState.currentSubjectId = "python"
    subjectStoreState.subjects = [
      {
        id: "python",
        key: "python",
        name: "Python 编程",
        description: "Python",
        icon: "🐍",
        onboarding_status: "completed",
        progress_percent: 40,
        mastered_nodes: 4,
        total_nodes: 10,
      },
    ]

    mockApiGet.mockImplementation((url: string, config?: { params?: { subject_key?: string } }) => {
      const subjectKey = config?.params?.subject_key ?? "python"

      if (url.includes("/api/ai-learning-path/user/user-1/active")) {
        if (subjectKey === "machine_learning") {
          return Promise.resolve({
            data: {
              id: "ml-path-1",
              user_id: "user-1",
              goal: "掌握机器学习基础",
              total_days: 21,
              daily_minutes: 60,
              created_at: "2026-03-16T00:00:00Z",
              progress_percent: 10,
              current_day: 1,
              generated_days: 7,
              phase_size: 7,
              days: [
                {
                  day: 1,
                  date: "2026-03-16",
                  theme: "机器学习概览",
                  total_minutes: 60,
                  tasks: [
                    {
                      id: "ml-task-1",
                      title: "理解监督学习与无监督学习",
                      description: "建立机器学习问题类型的整体认识",
                      type: "concept",
                      duration_minutes: 30,
                      resources: ["课程讲义"],
                      completed: false,
                    },
                  ],
                },
              ],
              version: 1,
              version_name: "机器学习计划 v1",
              is_active: true,
            },
          })
        }

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
            generated_days: 7,
            phase_size: 7,
            days: [
              {
                day: 1,
                date: "2026-03-14",
                theme: "异步基础",
                total_minutes: 45,
                tasks: [
                  {
                    id: "task-1",
                    title: "理解事件循环",
                    description: "学习 asyncio 的基本执行模型",
                    type: "concept",
                    duration_minutes: 20,
                    resources: ["官方文档"],
                    completed: false,
                  },
                ],
              },
              {
                day: 2,
                date: "2026-03-15",
                theme: "实战刷题",
                total_minutes: 50,
                tasks: [
                  {
                    id: "task-2",
                    title: "异步练习题",
                    description: "通过题目巩固 asyncio 基础",
                    type: "exercise",
                    duration_minutes: 30,
                    resources: ["题库"],
                    completed: false,
                  },
                ],
              },
            ],
            version: 2,
            version_name: "学习计划 v2",
            is_active: true,
          },
        })
      }

      if (url.includes("/api/ai-learning-path/path-1") || url.endsWith("/api/ai-learning-path/path-1")) {
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
            generated_days: 7,
            phase_size: 7,
            days: [
              {
                day: 1,
                date: "2026-03-14",
                theme: "异步基础",
                total_minutes: 45,
                tasks: [
                  {
                    id: "task-1",
                    title: "理解事件循环",
                    description: "学习 asyncio 的基本执行模型",
                    type: "concept",
                    duration_minutes: 20,
                    resources: ["官方文档"],
                    completed: false,
                  },
                ],
              },
              {
                day: 2,
                date: "2026-03-15",
                theme: "实战刷题",
                total_minutes: 50,
                tasks: [
                  {
                    id: "task-2",
                    title: "异步练习题",
                    description: "通过题目巩固 asyncio 基础",
                    type: "exercise",
                    duration_minutes: 30,
                    resources: ["题库"],
                    completed: false,
                  },
                ],
              },
            ],
            version: 2,
            version_name: "学习计划 v2",
            is_active: true,
          },
        })
      }

      if (url.includes("/api/ai-learning-path/user/user-1/versions")) {
        if (subjectKey === "machine_learning") {
          return Promise.resolve({
            data: {
              success: true,
              versions: [
                {
                  id: "ml-path-1",
                  version: 1,
                  version_name: "机器学习计划 v1",
                  is_active: true,
                  goal: "掌握机器学习基础",
                  total_days: 21,
                  daily_minutes: 60,
                  progress_percent: 10,
                  current_day: 1,
                  generated_days: 7,
                  created_at: "2026-03-16T00:00:00Z",
                  archived_at: null,
                },
              ],
              active_version: {
                id: "ml-path-1",
                version: 1,
                version_name: "机器学习计划 v1",
                is_active: true,
                goal: "掌握机器学习基础",
                total_days: 21,
                daily_minutes: 60,
                progress_percent: 10,
                current_day: 1,
                generated_days: 7,
                created_at: "2026-03-16T00:00:00Z",
                archived_at: null,
              },
            },
          })
        }

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
                  id: "python.asyncio.basics",
                  label: "asyncio 基础",
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
        return Promise.resolve({
          data: {
            session_id: "session-1",
            ready: false,
            missing_items: ["goal", "confirmation"],
            summary: "学习目标：待补充；当前水平：待补充；重点范围：待补充；时间安排：待补充；确认状态：待确认",
          },
        })
      }

      return Promise.reject(new Error(`Unhandled GET ${url}`))
    })

    mockApiPost.mockImplementation((url: string) => {
      if (url.includes("/session/start")) {
        return Promise.resolve({
          data: {
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
              },
            ],
          },
        })
      }

      return Promise.reject(new Error(`Unhandled POST ${url}`))
    })

    mockApiPut.mockResolvedValue({ data: { success: true } })
  })

  it("keeps /app/ai-learning-path focused on clarification only", async () => {
    render(<App />)

    expect(await screen.findByPlaceholderText("搜索节点...")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Navigator AI" })).toBeInTheDocument()
    expect(screen.queryByText("学习日程")).not.toBeInTheDocument()
    expect(screen.queryByText("Version Summary")).not.toBeInTheDocument()
  })

  it("renders a dedicated plan page at /app/ai-learning-path/plan/:pathId", async () => {
    mockInitialEntries.splice(0, mockInitialEntries.length, "/app/ai-learning-path/plan/path-1")

    render(<App />)

    expect(await screen.findByRole("heading", { name: "学习计划 v2" })).toBeInTheDocument()
    expect(screen.getByText("学习日程")).toBeInTheDocument()
    expect(screen.getByText("异步练习题")).toBeInTheDocument()
  })

  it("lets the user restart planning from the dedicated plan page", async () => {
    mockInitialEntries.splice(0, mockInitialEntries.length, "/app/ai-learning-path/plan/path-1")

    render(<App />)

    const user = userEvent.setup()
    expect(await screen.findByRole("heading", { name: "学习计划 v2" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "重新进行规划" }))

    expect(mockNavigate).toHaveBeenCalledWith("/app/ai-learning-path")
  })

  it("lets the user go back from the dedicated plan page", async () => {
    mockInitialEntries.splice(0, mockInitialEntries.length, "/app/ai-learning-path/plan/path-1")

    render(<App />)

    const user = userEvent.setup()
    expect(await screen.findByRole("heading", { name: "学习计划 v2" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "返回上一级" }))

    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it("keeps concept and exercise entry buttons available on their respective plan days", async () => {
    const user = userEvent.setup()

    mockInitialEntries.splice(0, mockInitialEntries.length, "/app/ai-learning-path/plan/path-1?day=2")
    const firstRender = render(<App />)

    expect(await screen.findByText("异步练习题")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "开始做题" }))
    const latestQuestionBankTarget = mockNavigate.mock.calls.at(-1)?.[0]
    expect(latestQuestionBankTarget).toEqual(expect.stringContaining("/app/question-bank?"))
    const questionBankUrl = new URL(String(latestQuestionBankTarget), "http://localhost")
    expect(questionBankUrl.searchParams.get("pathId")).toBe("path-1")
    expect(questionBankUrl.searchParams.get("taskId")).toBe("task-2")
    expect(questionBankUrl.searchParams.get("version")).toBe("2")
    expect(questionBankUrl.searchParams.get("versionName")).toBe("学习计划 v2")
    expect(questionBankUrl.searchParams.get("chapterTitle")).toBe("实战刷题")

    firstRender.unmount()

    mockInitialEntries.splice(0, mockInitialEntries.length, "/app/ai-learning-path/plan/path-1?day=1")
    render(<App />)

    const startLearningButton = await screen.findByRole("button", { name: "开始学习" })
    expect(startLearningButton).toBeInTheDocument()
    await user.click(startLearningButton)
    const latestConceptTarget = mockNavigate.mock.calls.at(-1)?.[0]
    expect(latestConceptTarget).toEqual(expect.stringContaining("/app/concept-learning/task-1?"))
    const conceptUrl = new URL(String(latestConceptTarget), "http://localhost")
    expect(conceptUrl.searchParams.get("pathId")).toBe("path-1")
    expect(conceptUrl.searchParams.get("version")).toBe("2")
    expect(conceptUrl.searchParams.get("versionName")).toBe("学习计划 v2")
    expect(conceptUrl.searchParams.get("chapterTitle")).toBe("异步基础")
  })

  it("hydrates the plan page directly from the active store cache", async () => {
    mockInitialEntries.splice(0, mockInitialEntries.length, "/app/ai-learning-path/plan/path-1")
    learningPathStoreState.pathsBySubject = {
      python: {
        id: "path-1",
        user_id: "user-1",
        goal: "掌握 Python 自动化",
        total_days: 14,
        daily_minutes: 45,
        created_at: "2026-03-14T00:00:00Z",
        progress_percent: 42,
        current_day: 2,
        generated_days: 7,
        phase_size: 7,
        days: [
              {
                day: 1,
                date: "2026-03-14",
                theme: "异步基础",
                total_minutes: 45,
            tasks: [
              {
                id: "task-1",
                title: "理解事件循环",
                description: "学习 asyncio 的基本执行模型",
                type: "concept",
                duration_minutes: 20,
                resources: ["官方文档"],
                    completed: false,
                  },
                ],
              },
              {
                day: 2,
                date: "2026-03-15",
                theme: "实战刷题",
                total_minutes: 50,
                tasks: [
                  {
                    id: "task-2",
                    title: "异步练习题",
                    description: "通过题目巩固 asyncio 基础",
                    type: "exercise",
                    duration_minutes: 30,
                    resources: ["题库"],
                    completed: false,
                  },
                ],
              },
            ],
            version: 2,
            version_name: "学习计划 v2",
            is_active: true,
      },
    }

    render(<App />)

    expect(await screen.findByRole("heading", { name: "学习计划 v2" })).toBeInTheDocument()
    await waitFor(() => {
      expect(mockApiGet).not.toHaveBeenCalledWith(expect.stringMatching(/\/api\/ai-learning-path\/path-1$/))
    })
  })

  it("redirects to the current subject plan when the route path belongs to another subject", async () => {
    mockInitialEntries.splice(0, mockInitialEntries.length, "/app/ai-learning-path/plan/path-1")
    subjectStoreState.currentSubjectId = "machine_learning"
    subjectStoreState.subjects = [
      {
        id: "python",
        key: "python",
        name: "Python 编程",
        description: "Python",
        icon: "🐍",
        onboarding_status: "completed",
        progress_percent: 40,
        mastered_nodes: 4,
        total_nodes: 10,
      },
      {
        id: "machine_learning",
        key: "machine_learning",
        name: "机器学习",
        description: "机器学习",
        icon: "🤖",
        onboarding_status: "completed",
        progress_percent: 10,
        mastered_nodes: 2,
        total_nodes: 20,
      },
    ]
    learningPathStoreState.pathsBySubject = {
      python: {
        id: "path-1",
        user_id: "user-1",
        goal: "掌握 Python 自动化",
        total_days: 14,
        daily_minutes: 45,
        created_at: "2026-03-14T00:00:00Z",
        progress_percent: 42,
        current_day: 2,
        generated_days: 7,
        phase_size: 7,
        days: [],
        version: 2,
        version_name: "学习计划 v2",
        is_active: true,
      },
    }

    render(<App />)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/app/ai-learning-path/plan/ml-path-1", { replace: true })
    })
  })
})
