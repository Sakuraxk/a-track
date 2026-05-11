import { beforeEach, describe, expect, it, vi } from "vitest"
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

vi.mock("@/components/navigation/ThemeSwitcher", () => ({
  ThemeSwitcher: () => <div>ThemeSwitcher</div>,
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
      subjects: [],
    })
  ),
}))

describe("MainLayout 工作台侧栏折叠", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows a collapse toggle on ai-learning-path, can collapse sidebar, and opens immersive content width", async () => {
    render(
      <MemoryRouter initialEntries={["/app/ai-learning-path"]}>
        <Routes>
          <Route path="/app" element={<MainLayout />}>
            <Route path="ai-learning-path" element={<div>Workbench</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    const user = userEvent.setup()
    const toggleButton = screen.getByRole("button", { name: /折叠主菜单/i })

    await user.click(toggleButton)

    expect(screen.getByTestId("main-sidebar")).toHaveAttribute("data-collapsed", "true")
    expect(screen.getByTestId("main-content-shell")).toHaveAttribute("data-immersive", "true")
  })
})
