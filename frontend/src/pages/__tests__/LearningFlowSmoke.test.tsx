import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useEffect, useState, type ReactNode } from "react"

import App from "@/App"
import {
  LEARNING_STUDIO_FLAGS_STORAGE_KEY,
  getLearningStudioFlags,
} from "@/features/studio/config/learningStudioFlags"

vi.mock("@/pages/Landing", () => ({ default: () => <div>Landing</div> }))
vi.mock("@/pages/Login", () => ({ default: () => <div>Login</div> }))
vi.mock("@/pages/Register", () => ({ default: () => <div>Register</div> }))
vi.mock("@/pages/Dashboard", () => ({ default: () => <div>Dashboard</div> }))
vi.mock("@/pages/AILearningPath", () => ({ default: () => <div>AILearningPath</div> }))
vi.mock("@/pages/QuestionBank", () => ({ default: () => <div>QuestionBank</div> }))
vi.mock("@/pages/Practice", () => ({ default: () => <div>Practice</div> }))
vi.mock("@/pages/Assessment", () => ({ default: () => <div>Assessment</div> }))
vi.mock("@/pages/ProblemList", () => ({ default: () => <div>ProblemList</div> }))
vi.mock("@/pages/Stats", () => ({ default: () => <div>Stats</div> }))
vi.mock("@/pages/Profile", () => ({ default: () => <div>Profile</div> }))
vi.mock("@/pages/ConceptLearning", () => ({ default: () => <div>ConceptLearning</div> }))
vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock("@/components/auth/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/layout/MainLayout", async () => {
  const router = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")

  return {
    default: () => (
      <div data-testid="main-layout">
        <router.Outlet />
      </div>
    ),
  }
})

vi.mock("@/pages/SubjectDetail", async () => {
  const router = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")

  return {
    default: function SubjectDetailMock() {
      const navigate = router.useNavigate()
      return (
        <button type="button" onClick={() => navigate("/app/studio/python")}>
          进入学习工作台
        </button>
      )
    },
  }
})

vi.mock("@/pages/LearningStudio", () => ({
  default: function LearningStudioMock() {
    const [stage, setStage] = useState<"concept" | "practice">("concept")

    return (
      <div>
        <h1>学习工作台</h1>
        <p>{stage === "concept" ? "概念学习阶段" : "练习阶段"}</p>
        {stage === "concept" && (
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("studio:context-quick-ask", {
                  detail: {
                    selectedText: "二分查找",
                    sectionTitle: "二分查找基础",
                    taskId: "task_1_1",
                    prompt: "请解释二分查找",
                  },
                })
              )
            }
          >
            就这段提问
          </button>
        )}
        <button type="button" onClick={() => setStage("practice")}>
          进入练习阶段
        </button>
      </div>
    )
  },
}))

vi.mock("@/components/ai-chat/UnifiedAIPanel", () => ({
  default: function UnifiedAIPanelMock() {
    const [selectedText, setSelectedText] = useState("")

    useEffect(() => {
      const handler = (event: Event) => {
        const detail = (event as CustomEvent<{ selectedText?: string }>).detail
        setSelectedText(detail?.selectedText || "")
      }
      window.addEventListener("studio:context-quick-ask", handler)
      return () => window.removeEventListener("studio:context-quick-ask", handler)
    }, [])

    return (
      <div data-testid="mock-unified-panel">
        {selectedText ? `已接收提问上下文: ${selectedText}` : "等待上下文"}
      </div>
    )
  },
}))

describe("Learning flow smoke", () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, "", "/app/subject/python")
  })

  it("completes concept -> ask -> practice flow with <=1 full-page navigation", async () => {
    const user = userEvent.setup()
    const pushSpy = vi.spyOn(window.history, "pushState")

    render(<App />)

    await user.click(await screen.findByRole("button", { name: "进入学习工作台" }))
    expect(await screen.findByRole("heading", { name: "学习工作台" })).toBeInTheDocument()
    expect(window.location.pathname).toBe("/app/studio/python")

    await user.click(screen.getByRole("button", { name: "就这段提问" }))
    expect(await screen.findByText("已接收提问上下文: 二分查找")).toBeInTheDocument()
    expect(window.location.pathname).toBe("/app/studio/python")

    await user.click(screen.getByRole("button", { name: "进入练习阶段" }))
    expect(await screen.findByText("练习阶段")).toBeInTheDocument()
    expect(window.location.pathname).toBe("/app/studio/python")

    expect(pushSpy.mock.calls.length).toBeLessThanOrEqual(1)
    pushSpy.mockRestore()
  })

  it("respects local feature flag override for auto diagram rendering", () => {
    localStorage.setItem(
      LEARNING_STUDIO_FLAGS_STORAGE_KEY,
      JSON.stringify({ conceptAutoDiagram: false })
    )

    expect(getLearningStudioFlags().conceptAutoDiagram).toBe(false)
  })
})
