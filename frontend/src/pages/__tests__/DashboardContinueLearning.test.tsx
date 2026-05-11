import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import Dashboard from "@/pages/Dashboard"

const { mockNavigate, mockApiGet } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockApiGet: vi.fn(),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@/stores/auth", () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      profile: {
        user_id: "test-user",
        ability_tags: {},
        portrait: {},
      },
    })
  ),
}))

vi.mock("@/stores/subject", () => ({
  useSubjectStore: vi.fn((selector) =>
    selector({
      currentSubjectId: "python",
      subjects: [
        {
          id: "python",
          key: "python",
          name: "Python 编程",
        },
      ],
    })
  ),
}))

vi.mock("@/components/dashboard/AchievementTreeCard", () => ({
  AchievementTreeCard: () => <div data-testid="achievement-tree-card" />,
}))

vi.mock("@/components/AbilityRadarChart", () => ({
  AbilityRadarChart: () => <div data-testid="ability-radar-chart" />,
}))

vi.mock("@/components/dashboard/LearningCommunity", () => ({
  default: () => <div data-testid="learning-community" />,
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: mockApiGet,
    post: vi.fn(),
  },
}))

describe("Dashboard 继续学习入口", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/reporting/dashboard/")) {
        return Promise.resolve({
          data: {
            radar: { data: [], overall_score: 0 },
            stats: {
              completed_exercises: 0,
              streak_days: 0,
              accuracy_rate: 0,
              total_study_minutes: 0,
            },
            recommendations: [],
            next_lesson: null,
            next_lesson_title: null,
          },
        })
      }
      if (url === "/api/llm-config/status") {
        return Promise.resolve({
          data: {
            connected: true,
            model: "mock-model",
            message: "ok",
            latency_ms: 10,
          },
        })
      }
      if (url === "/api/community/tags/stats") {
        return Promise.resolve({
          data: {
            tags: [],
          },
        })
      }
      return Promise.resolve({ data: {} })
    })
  })

  it("点击继续学习时应跳转到学习工作台", async () => {
    const user = userEvent.setup()
    render(<Dashboard />)

    expect(await screen.findByTestId("dashboard-focus-hero")).toBeInTheDocument()
    expect(screen.getByText(/今天先回到 Python 编程/)).toBeInTheDocument()
    expect(screen.queryByText("邀请好友")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /切换学科/ })).toBeInTheDocument()

    await user.click(await screen.findByRole("button", { name: /继续学习/ }))

    expect(mockNavigate).toHaveBeenCalledWith("/app/studio/python")
  })

  it("当系统 LLM 未启用时应展示更明确的首页提示", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/reporting/dashboard/")) {
        return Promise.resolve({
          data: {
            radar: { data: [], overall_score: 0 },
            stats: {
              completed_exercises: 0,
              streak_days: 0,
              accuracy_rate: 0,
              total_study_minutes: 0,
            },
            recommendations: [],
            next_lesson: null,
            next_lesson_title: null,
          },
        })
      }
      if (url === "/api/llm-config/status") {
        return Promise.resolve({
          data: {
            connected: false,
            model: "",
            message: "系统 LLM 未启用或未配置 API Key",
            latency_ms: 0,
          },
        })
      }
      if (url === "/api/llm-config/") {
        return Promise.resolve({ data: { configs: [], total: 0 } })
      }
      if (url === "/api/community/tags/stats") {
        return Promise.resolve({
          data: {
            tags: [],
          },
        })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Dashboard />)

    expect(await screen.findByText("未找到可用 LLM 配置")).toBeInTheDocument()
    expect(screen.getByText("系统 LLM 未启用或未配置 API Key；当前账号也没有启用中的个人 LLM 配置")).toBeInTheDocument()
  })

  it("当个人 LLM 已启用时不展示系统 LLM 首页红色提示", async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/reporting/dashboard/")) {
        return Promise.resolve({
          data: {
            radar: { data: [], overall_score: 0 },
            stats: {
              completed_exercises: 0,
              streak_days: 0,
              accuracy_rate: 0,
              total_study_minutes: 0,
            },
            recommendations: [],
            next_lesson: null,
            next_lesson_title: null,
          },
        })
      }
      if (url === "/api/llm-config/status") {
        return Promise.resolve({
          data: {
            connected: false,
            model: "",
            message: "系统 LLM 未启用或未配置 API Key",
            latency_ms: 0,
          },
        })
      }
      if (url === "/api/llm-config/") {
        return Promise.resolve({
          data: {
            total: 1,
            configs: [
              {
                id: "cfg-1",
                user_id: "user-1",
                model_role: "default",
                api_base_url: "https://api.example.com/v1",
                model_name: "user-model",
                temperature: 0.3,
                max_tokens: 512,
                timeout_seconds: 45,
                is_active: true,
                created_at: "2026-04-16T00:00:00Z",
                updated_at: "2026-04-16T00:00:00Z",
                api_key_masked: "sk-***",
              },
            ],
          },
        })
      }
      if (url === "/api/community/tags/stats") {
        return Promise.resolve({ data: { tags: [] } })
      }
      return Promise.resolve({ data: {} })
    })

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.queryByText("未找到可用 LLM 配置")).not.toBeInTheDocument()
    })
  })
})
