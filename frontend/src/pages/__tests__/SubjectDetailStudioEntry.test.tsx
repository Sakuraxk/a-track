import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import SubjectDetail from "@/pages/SubjectDetail"

const mockNavigate = vi.fn()
const mockFetchSubjects = vi.fn()
const mockSubjectState = {
  subjects: [
    {
      id: "python",
      key: "python",
      name: "Python",
      icon: "🐍",
      description: "Python 编程",
      onboarding_status: "completed",
      progress_percent: 50,
      mastered_nodes: 5,
      total_nodes: 10,
    },
  ],
  fetchSubjects: mockFetchSubjects,
}
const mockAuthState = {
  profile: { user_id: "test-user" },
}

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@/stores/auth", () => ({
  useAuthStore: vi.fn((selector) => selector(mockAuthState)),
}))

vi.mock("@/stores/subject", () => ({
  useSubjectStore: vi.fn((selector) => selector(mockSubjectState)),
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.includes("/api/ai-learning-path/user/")) {
        return Promise.resolve({
          data: {
            id: "path-1",
            user_id: "test-user",
            goal: "掌握 Python 自动化",
            total_days: 21,
            daily_minutes: 45,
            level: "intermediate",
            created_at: "2026-04-01T00:00:00Z",
            days: [],
            progress_percent: 32,
            current_day: 6,
          },
        })
      }

      return Promise.resolve({
        data: {
          goal: "career,basics",
          level: "intermediate",
        },
      })
    }),
    put: vi.fn(),
  },
}))

function renderSubjectDetail() {
  return render(
    <MemoryRouter initialEntries={["/app/subject/python"]}>
      <Routes>
        <Route path="/app/subject/:subjectId" element={<SubjectDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe("SubjectDetail 学习策略控制台", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("connects strategy, plan, execution, practice and review actions", async () => {
    renderSubjectDetail()
    const user = userEvent.setup()

    expect(await screen.findByText("学习策略控制台")).toBeInTheDocument()
    expect(screen.getByText("提升职业技能")).toBeInTheDocument()
    expect(screen.getByText("掌握基础知识")).toBeInTheDocument()
    expect(screen.getByText("有一定基础")).toBeInTheDocument()
    expect(await screen.findByText("掌握 Python 自动化")).toBeInTheDocument()
    expect(screen.getAllByText("第 6 / 21 天").length).toBeGreaterThan(0)

    await user.click(screen.getByRole("button", { name: /继续今日学习/ }))
    expect(mockNavigate).toHaveBeenCalledWith("/app/studio/python")

    await user.click(screen.getByRole("button", { name: /调整学习路线/ }))
    expect(mockNavigate).toHaveBeenCalledWith("/app/ai-learning-path")

    await user.click(screen.getByRole("button", { name: /题库练习/ }))
    expect(mockNavigate).toHaveBeenCalledWith("/app/question-bank")

    await user.click(screen.getByRole("button", { name: /查看学习复盘/ }))
    expect(mockNavigate).toHaveBeenCalledWith("/app/stats")
  })
})
