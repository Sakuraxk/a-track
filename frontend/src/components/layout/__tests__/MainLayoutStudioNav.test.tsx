import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import MainLayout from "@/components/layout/MainLayout"

const mockNavigate = vi.fn()
const mockLogout = vi.fn()
const mockSetChatOpen = vi.fn()
const mockSetPanelCollapsed = vi.fn()
const mockSetOnboardingCompleted = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@/components/onboarding/OnboardingModal", () => ({
  default: () => null,
}))

vi.mock("@/components/navigation/SubjectSwitcher", () => ({
  SubjectSwitcher: () => <div>SubjectSwitcher</div>,
}))

vi.mock("@/stores/auth", () => ({
  useAuthStore: vi.fn((selector: (state: unknown) => unknown) =>
    selector({
      logout: mockLogout,
      profile: {
        user_id: "u-1",
        ability_tags: { logic: 80 },
        portrait: {
          nickname: "Tester",
          learning_stage: "intermediate",
          onboarding_completed: "true",
        },
      },
      onboardingCompleted: true,
      setOnboardingCompleted: mockSetOnboardingCompleted,
    })
  ),
}))

vi.mock("@/stores/chat", () => ({
  useChatStore: vi.fn((selector: (state: unknown) => unknown) =>
    selector({
      hideGlobalButton: false,
      setOpen: mockSetChatOpen,
      setPanelCollapsed: mockSetPanelCollapsed,
    })
  ),
}))

vi.mock("@/stores/subject", () => ({
  useSubjectStore: vi.fn((selector: (state: unknown) => unknown) =>
    selector({
      currentSubjectId: "python",
    })
  ),
}))

function renderMainLayout() {
  return render(
    <MemoryRouter initialEntries={["/app/dashboard"]}>
      <Routes>
        <Route path="/app" element={<MainLayout />}>
          <Route path="dashboard" element={<div>Dashboard</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe("MainLayout 学习工作台导航", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows 学习工作台 menu entry and navigates to subject studio", async () => {
    renderMainLayout()
    const user = userEvent.setup()

    expect(screen.getByTestId("main-sidebar")).toHaveAttribute("data-surface", "learning-rail")
    const studioButton = screen.getByRole("button", { name: "学习工作台" })
    expect(studioButton).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "打开 AI 助手" })).toBeInTheDocument()

    await user.click(studioButton)

    expect(mockNavigate).toHaveBeenCalledWith("/app/studio/python")
  })
})
