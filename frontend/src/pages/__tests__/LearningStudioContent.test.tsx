import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import LearningStudio from "../LearningStudio"

const { mockApiGet, mockGetPathForSubject, mockSetPathForSubject, mockNavigate, subjectStoreState } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockGetPathForSubject: vi.fn(),
  mockSetPathForSubject: vi.fn(),
  mockNavigate: vi.fn(),
  subjectStoreState: {
    currentSubjectId: "python",
    subjects: [
      {
        id: "python",
        key: "python",
        name: "Python 编程",
        icon: "🐍",
        description: "Python 编程",
        onboarding_status: "completed",
        progress_percent: 40,
        mastered_nodes: 4,
        total_nodes: 10,
      },
    ],
  },
}))

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
  },
}))

vi.mock("@/stores/auth", () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      profile: { user_id: "user-1" },
    })
  ),
}))

vi.mock("@/stores/subject", () => ({
  useSubjectStore: vi.fn((selector) =>
    selector(subjectStoreState)
  ),
}))

vi.mock("@/stores/learning-path", () => ({
  useLearningPathStore: vi.fn((selector) =>
    selector({
      getPathForSubject: mockGetPathForSubject,
      setPathForSubject: mockSetPathForSubject,
    })
  ),
}))

describe("LearningStudio 内容展示", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes("/api/subjects/")) {
        return Promise.resolve({
          data: {
            goal: "career,basics",
            level: "intermediate",
          },
        })
      }

      return Promise.resolve({ data: null })
    })
    subjectStoreState.currentSubjectId = "python"
    subjectStoreState.subjects = [
      {
        id: "python",
        key: "python",
        name: "Python 编程",
        icon: "🐍",
        description: "Python 编程",
        onboarding_status: "completed",
        progress_percent: 40,
        mastered_nodes: 4,
        total_nodes: 10,
      },
    ]
    mockGetPathForSubject.mockReturnValue({
      id: "path-1",
      user_id: "user-1",
      goal: "掌握 Python",
      total_days: 14,
      daily_minutes: 60,
      created_at: "2026-01-01T00:00:00Z",
      progress_percent: 35,
      current_day: 1,
      days: [
        {
          day: 1,
          date: "2026-01-01",
          theme: "函数入门",
          total_minutes: 40,
          tasks: [
            {
              id: "task_1_1",
              title: "认识函数",
              description: "理解函数定义与调用",
              type: "concept",
              duration_minutes: 20,
              resources: ["函数", "参数"],
              completed: false,
            },
          ],
        },
      ],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("应展示可执行学习内容而不是占位文案", async () => {
    render(
      <MemoryRouter initialEntries={["/app/studio/python"]}>
        <Routes>
          <Route path="/app/studio/:subjectId" element={<LearningStudio />} />
        </Routes>
      </MemoryRouter>
    )

    const progressHero = await screen.findByTestId("progress-hero")
    expect(within(progressHero).getByText("推进剧本")).toBeInTheDocument()
    expect(within(progressHero).getByRole("button", { name: "进入概念学习" })).toBeInTheDocument()
    expect(screen.getByText("主线双步")).toBeInTheDocument()
    expect(screen.getByText("策略星图")).toBeInTheDocument()
    
    // Check for standard text instead of buttons since MicroStrip implementation changed
    expect(screen.getByText("行动面板")).toBeInTheDocument()
    expect(screen.getAllByText("完成进度").length).toBeGreaterThan(0)
    expect(screen.queryByText(/后续将在此/)).not.toBeInTheDocument()
  })

  it("Micro-strip 应原地展开非主焦点幕", async () => {
    render(
      <MemoryRouter initialEntries={["/app/studio/python"]}>
        <Routes>
          <Route path="/app/studio/:subjectId" element={<LearningStudio />} />
        </Routes>
      </MemoryRouter>
    )

    const user = userEvent.setup()
    // Find the button inside the MicroStrip by finding the container first or matching the text
    const actionPanels = await screen.findAllByText("行动面板")
    // The button contains the text "行动面板"
    const actionStrip = actionPanels[0].closest('button')!

    expect(actionStrip).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("动态题库")).not.toBeInTheDocument()
    await act(async () => {
      await user.click(actionStrip)
    })

    expect(actionStrip).toHaveAttribute("aria-expanded", "true")
    expect(
      within(screen.getByRole("region", { name: "行动面板" })).getByText("动态题库"),
    ).toBeInTheDocument()
    expect(within(await screen.findByTestId("progress-hero")).getByText("推进剧本")).toBeInTheDocument()
  })

  it("当前任务进入练习态时，应展示 Unified Focus Stage 的开始练习锚点", async () => {
    mockGetPathForSubject.mockReturnValue({
      id: "path-1",
      user_id: "user-1",
      goal: "掌握 Python",
      total_days: 14,
      daily_minutes: 60,
      created_at: "2026-01-01T00:00:00Z",
      progress_percent: 35,
      current_day: 1,
      days: [
        {
          day: 1,
          date: "2026-01-01",
          theme: "函数入门",
          total_minutes: 40,
          tasks: [
            {
              id: "task_1_1",
              title: "函数专项练习",
              description: "通过题目验证函数理解",
              type: "exercise",
              duration_minutes: 20,
              resources: ["函数", "参数"],
              completed: false,
            },
          ],
        },
      ],
    })

    render(
      <MemoryRouter initialEntries={["/app/studio/python"]}>
        <Routes>
          <Route path="/app/studio/:subjectId" element={<LearningStudio />} />
        </Routes>
      </MemoryRouter>
    )

    const user = userEvent.setup()
    const practiceHero = await screen.findByTestId("practice-hero")
    expect(within(practiceHero).getByText("Unified Focus Stage")).toBeInTheDocument()

    await user.click(within(practiceHero).getByRole("button", { name: "开始练习" }))
    expect(mockNavigate).toHaveBeenLastCalledWith("/app/problems")
  })

  it("兼容旧任务类型 practice 时，也应进入练习态", async () => {
    mockGetPathForSubject.mockReturnValue({
      id: "path-1",
      user_id: "user-1",
      goal: "掌握 Python",
      total_days: 14,
      daily_minutes: 60,
      created_at: "2026-01-01T00:00:00Z",
      progress_percent: 35,
      current_day: 1,
      days: [
        {
          day: 1,
          date: "2026-01-01",
          theme: "函数入门",
          total_minutes: 40,
          tasks: [
            {
              id: "task_1_1",
              title: "函数专项练习",
              description: "通过题目验证函数理解",
              type: "practice",
              duration_minutes: 20,
              resources: ["函数", "参数"],
              completed: false,
            },
          ],
        },
      ],
    })

    render(
      <MemoryRouter initialEntries={["/app/studio/python"]}>
        <Routes>
          <Route path="/app/studio/:subjectId" element={<LearningStudio />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByTestId("practice-hero")).toBeInTheDocument()
  })

  it("通过灵动岛切换到复盘态时，应真实切换 Hero，而不是停留在系统态", async () => {
    render(
      <MemoryRouter initialEntries={["/app/studio/python"]}>
        <Routes>
          <Route path="/app/studio/:subjectId" element={<LearningStudio />} />
        </Routes>
      </MemoryRouter>
    )

    const user = userEvent.setup()
    await act(async () => {
      await user.click(screen.getByRole("button", { name: /推进中/ }))
    })
    await act(async () => {
      await user.click(await screen.findByRole("button", { name: "复盘态" }))
    })

    expect(await screen.findByTestId("review-hero")).toBeInTheDocument()
    expect(screen.queryByTestId("progress-hero")).not.toBeInTheDocument()
  })

  it("通过灵动岛手动切换推进→练习→复盘时，应同步更新 Hero、Act 1 和滚动锚点", async () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    render(
      <MemoryRouter initialEntries={["/app/studio/python"]}>
        <Routes>
          <Route path="/app/studio/:subjectId" element={<LearningStudio />} />
        </Routes>
      </MemoryRouter>
    )

    const user = userEvent.setup()

    expect(await screen.findByTestId("progress-hero")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "查看路线图" })).toBeInTheDocument()

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /推进中/ }))
    })
    await act(async () => {
      await user.click(await screen.findByRole("button", { name: "练习态" }))
    })

    expect(await screen.findByTestId("practice-hero")).toBeInTheDocument()
    expect(screen.getByTestId("learning-workstation")).toHaveAttribute(
      "data-render-state",
      "practice",
    )
    expect(screen.getByRole("button", { name: "设为当前状态" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "查看路线图" })).toBeInTheDocument()

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "设为当前状态" }))
    })

    expect(screen.getByRole("button", { name: "恢复自动状态" })).toBeInTheDocument()

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "复盘态" }))
    })

    expect(await screen.findByTestId("review-hero")).toBeInTheDocument()
    expect(screen.getByTestId("learning-workstation")).toHaveAttribute(
      "data-render-state",
      "review",
    )
    expect(screen.queryByRole("button", { name: "继续当前任务" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "查看路线图" })).not.toBeInTheDocument()
    expect(scrollIntoView.mock.calls.length).toBeGreaterThanOrEqual(2)

    Element.prototype.scrollIntoView = originalScrollIntoView
  })

  it("今日任务完成后，应展示总结提示词、明日任务和学习数据", async () => {
    mockGetPathForSubject.mockReturnValue({
      id: "path-1",
      user_id: "user-1",
      goal: "掌握 Python",
      total_days: 14,
      daily_minutes: 60,
      created_at: "2026-01-01T00:00:00Z",
      progress_percent: 35,
      current_day: 1,
      days: [
        {
          day: 1,
          date: "2026-01-01",
          theme: "函数入门",
          total_minutes: 40,
          tasks: [
            {
              id: "task_1_1",
              title: "认识函数",
              description: "理解函数定义与调用",
              type: "concept",
              duration_minutes: 20,
              resources: ["函数", "参数"],
              completed: true,
            },
          ],
        },
        {
          day: 2,
          date: "2026-01-02",
          theme: "参数与返回值",
          total_minutes: 45,
          tasks: [
            {
              id: "task_2_1",
              title: "理解参数传递",
              description: "理解位置参数和关键字参数",
              type: "concept",
              duration_minutes: 25,
              resources: ["参数", "返回值"],
              completed: false,
            },
          ],
        },
      ],
    })

    render(
      <MemoryRouter initialEntries={["/app/studio/python"]}>
        <Routes>
          <Route path="/app/studio/:subjectId" element={<LearningStudio />} />
        </Routes>
      </MemoryRouter>
    )

    const user = userEvent.setup()
    const reviewHero = await screen.findByTestId("review-hero")
    expect(within(reviewHero).getByText("收束摘要")).toBeInTheDocument()

    await user.click(within(reviewHero).getByRole("button", { name: "查看复盘详情" }))
    expect(mockNavigate).toHaveBeenLastCalledWith("/app/stats")

    vi.useFakeTimers()
    fireEvent.click(within(reviewHero).getByRole("button", { name: "继续下一步" }))

    expect(screen.getByTestId("learning-workstation")).toHaveAttribute(
      "data-transition-intent",
      "inherit-hero",
    )
    expect(mockNavigate).toHaveBeenLastCalledWith("/app/stats")

    await act(async () => {
      vi.advanceTimersByTime(280)
    })

    expect(mockNavigate).toHaveBeenLastCalledWith("/app/ai-learning-path/plan/path-1?day=2")
  })

  it("无学习路线时，应进入预备态并展示生成路线引导", async () => {
    mockGetPathForSubject.mockReturnValue(null)

    render(
      <MemoryRouter initialEntries={["/app/studio/python"]}>
        <Routes>
          <Route path="/app/studio/:subjectId" element={<LearningStudio />} />
        </Routes>
      </MemoryRouter>,
    )

    const progressHero = await screen.findByTestId("progress-hero")
    expect(
      within(progressHero).getByRole("button", { name: "生成学习路线" }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/完成进度/)).not.toBeInTheDocument()
    expect(screen.queryByText(/明日衔接/)).not.toBeInTheDocument()
  })

  it("拉取学习路线期间，应展示加载态而不是预备态 CTA", async () => {
    mockGetPathForSubject.mockReturnValue(null)
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes("/api/ai-learning-path/user/")) {
        return new Promise(() => {})
      }

      if (url.includes("/api/subjects/")) {
        return Promise.resolve({
          data: {
            goal: "career,basics",
            level: "intermediate",
          },
        })
      }

      return Promise.resolve({ data: null })
    })

    render(
      <MemoryRouter initialEntries={["/app/studio/python"]}>
        <Routes>
          <Route path="/app/studio/:subjectId" element={<LearningStudio />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(
      (await screen.findAllByText("正在载入学习工作台")).length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByRole("button", { name: "生成学习路线" }),
    ).not.toBeInTheDocument()
  })


  it("有已生成计划时，学习路线和继续今日学习都应直达计划页", async () => {
    render(
      <MemoryRouter initialEntries={["/app/studio/python"]}>
        <Routes>
          <Route path="/app/studio/:subjectId" element={<LearningStudio />} />
        </Routes>
      </MemoryRouter>
    )

    const user = userEvent.setup()
    const learningPathButton = await screen.findByRole("button", { name: "查看路线图" })
    const continueButton = screen.getByRole("button", { name: /继续当前任务/ })

    await user.click(learningPathButton)
    expect(mockNavigate).toHaveBeenLastCalledWith("/app/ai-learning-path/plan/path-1?day=1")

    await user.click(continueButton)
    expect(mockNavigate).toHaveBeenLastCalledWith("/app/ai-learning-path/plan/path-1?day=1")
  })

  it("当前学科与路由学科不一致时，应同步到当前学科并拉取对应计划", async () => {
    subjectStoreState.currentSubjectId = "machine_learning"
    subjectStoreState.subjects = [
      {
        id: "python",
        key: "python",
        name: "Python 编程",
        icon: "🐍",
        description: "Python 编程",
        onboarding_status: "completed",
        progress_percent: 40,
        mastered_nodes: 4,
        total_nodes: 10,
      },
      {
        id: "machine_learning",
        key: "machine_learning",
        name: "机器学习",
        icon: "🤖",
        description: "机器学习",
        onboarding_status: "completed",
        progress_percent: 10,
        mastered_nodes: 2,
        total_nodes: 20,
      },
    ]
    mockGetPathForSubject.mockReturnValue(null)
    mockApiGet.mockResolvedValue({
      data: {
        id: "ml-path-1",
        user_id: "user-1",
        goal: "掌握机器学习基础",
        total_days: 21,
        daily_minutes: 60,
        created_at: "2026-03-16T00:00:00Z",
        progress_percent: 10,
        current_day: 1,
        days: [],
      },
    })

    render(
      <MemoryRouter initialEntries={["/app/studio/python"]}>
        <Routes>
          <Route path="/app/studio/:subjectId" element={<LearningStudio />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/app/studio/machine_learning", { replace: true })
    })
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/api/ai-learning-path/user/user-1/active", {
        params: { subject_key: "machine_learning" },
      })
    })
    await waitFor(() => {
      expect(mockSetPathForSubject).toHaveBeenCalledWith(
        "machine_learning",
        expect.objectContaining({ id: "ml-path-1" }),
      )
    })
  })
})
