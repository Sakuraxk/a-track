import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"

import App from "@/App"

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
vi.mock("@/pages/SubjectDetail", () => ({ default: () => <div>SubjectDetail</div> }))
vi.mock("@/pages/ConceptLearning", () => ({ default: () => <div>ConceptLearning</div> }))
vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock("@/components/auth/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock("@/components/ai-chat/UnifiedAIPanel", () => ({ default: () => null }))
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

describe("LearningStudio 路由", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/app/studio/python")
  })

  it("routes /app/studio/:subjectId to LearningStudio", async () => {
    render(<App />)

    expect(await screen.findByTestId("learning-workstation")).toBeInTheDocument()
    expect(screen.getByTestId("progress-hero")).toBeInTheDocument()
  })
})
