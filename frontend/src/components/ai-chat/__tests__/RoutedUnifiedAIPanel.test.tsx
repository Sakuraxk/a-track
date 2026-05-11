import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { RoutedUnifiedAIPanel } from "@/App"
import { useChatStore } from "@/stores/chat"

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: { profile: { user_id: string; ability_tags: Record<string, number> } }) => unknown) =>
    selector({
      profile: {
        user_id: "user-1",
        ability_tags: {},
      },
    }),
}))

describe("RoutedUnifiedAIPanel", () => {
  it("hides the panel on landing, login, and learning-path workbench pages and applies header-aware offsets elsewhere", () => {
    document.documentElement.style.setProperty("--ai-panel-top-offset", "128px")
    useChatStore.setState({
      isOpen: true,
      panelCollapsed: true,
      panelWidth: 420,
      panelDock: "right",
      panelActiveTab: "chat",
    })

    const hiddenView = render(
      <MemoryRouter initialEntries={["/app/ai-learning-path"]}>
        <RoutedUnifiedAIPanel />
      </MemoryRouter>
    )

    expect(screen.queryByTestId("unified-ai-panel")).not.toBeInTheDocument()
    hiddenView.unmount()

    const landingView = render(
      <MemoryRouter initialEntries={["/"]}>
        <RoutedUnifiedAIPanel />
      </MemoryRouter>
    )

    expect(screen.queryByTestId("unified-ai-panel")).not.toBeInTheDocument()
    landingView.unmount()

    const loginView = render(
      <MemoryRouter initialEntries={["/login"]}>
        <RoutedUnifiedAIPanel />
      </MemoryRouter>
    )

    expect(screen.queryByTestId("unified-ai-panel")).not.toBeInTheDocument()
    loginView.unmount()

    render(
      <MemoryRouter initialEntries={["/app/dashboard"]}>
        <RoutedUnifiedAIPanel />
      </MemoryRouter>
    )

    expect(screen.getByTestId("unified-ai-panel")).toHaveAttribute("data-top-offset", "128")
  })
})
