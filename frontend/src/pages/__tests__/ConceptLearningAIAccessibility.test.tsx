import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import ConceptLearning from "@/pages/ConceptLearning"
import UnifiedAIPanel from "@/components/ai-chat/UnifiedAIPanel"
import { useChatStore } from "@/stores/chat"

vi.mock("@/components/concept/ConceptMarkmap", () => ({
  default: ({ markdown }: { markdown: string }) => <div data-testid="concept-markmap">{markdown}</div>,
}))

vi.mock("@ant-design/x-markdown", () => ({
  XMarkdown: ({
    content,
    components = {},
  }: {
    content: string
    components?: Record<string, React.ComponentType<{ children?: React.ReactNode }>>
  }) => {
    const H2 = components.h2 ?? ((props: { children?: React.ReactNode }) => <h2 {...props} />)
    const H3 = components.h3 ?? ((props: { children?: React.ReactNode }) => <h3 {...props} />)
    const Paragraph = components.p ?? ((props: { children?: React.ReactNode }) => <p {...props} />)

    return (
      <div className="x-markdown">
        {content.split("\n").map((line, index) => {
          if (line.startsWith("### ")) {
            return <H3 key={index}>{line.replace(/^###\s*/, "")}</H3>
          }
          if (line.startsWith("## ")) {
            return <H2 key={index}>{line.replace(/^##\s*/, "")}</H2>
          }
          if (!line.trim()) {
            return null
          }
          return <Paragraph key={index}>{line}</Paragraph>
        })}
      </div>
    )
  },
  useStreaming: (content: string) => content,
}))

vi.mock("@/lib/streamConceptContent", () => ({
  streamConceptContent: vi.fn(),
  generateConceptExercises: vi.fn(async () => ({ success: true, exercises_count: 2 })),
  getCachedContent: vi.fn(async () => ({
    exists: true,
    markmap_markdown: "# 示例章节\n## 子标题示例",
    concept_map: { root: "示例章节", nodes: [], edges: [], chapter_order: [] },
    content: "## 示例章节\n### 子标题示例\n用于测试 AI 入口可发现性。",
    reasoning: "",
  })),
  deleteConceptContent: vi.fn(),
}))

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: { profile: { user_id: string; ability_tags: Record<string, number> } }) => unknown) =>
    selector({
      profile: { user_id: "user-1", ability_tags: { python: 0.8 } },
    }),
}))

vi.mock("@/stores/learning-path", () => ({
  useLearningPathStore: (selector: (state: { updateTaskCompletion: (...args: unknown[]) => void }) => unknown) =>
    selector({ updateTaskCompletion: vi.fn() }),
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(async () => ({
      data: {
        success: true,
        groups: [],
        days: [],
      },
    })),
    put: vi.fn(),
  },
}))

describe("ConceptLearning 文档站导航与基线样式", () => {
  const aiSidebarStateKey = "concept-learning-ai-sidebar-expanded"
  const renderConceptLearningPage = (
    initialEntry = "/app/concept-learning/task-001?title=二分查找基础&subject=Python&pathId=path-1&day=1",
    includeAiPanel = false,
  ) =>
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/app/concept-learning/:taskId" element={<ConceptLearning />} />
        </Routes>
        {includeAiPanel ? <UnifiedAIPanel /> : null}
      </MemoryRouter>
    )

  beforeEach(() => {
    localStorage.clear()
    useChatStore.setState({
      isOpen: false,
      panelCollapsed: true,
      panelActiveTab: "chat",
      panelDock: "right",
      panelWidth: 420,
      currentSessionId: null,
      sessionId: null,
      activeScopeKey: "global",
      sessionByScope: {},
      messages: [{ role: "ai", content: "你好！我是 AI 助手，有什么可以帮助你的？" }],
      isStreaming: false,
      sessions: [],
    })
  })

  it("renders localized dashboard top navigation and keeps the unified AI panel docked at the far right in collapsed state by default", async () => {
    renderConceptLearningPage(undefined, true)

    await screen.findAllByText("示例章节")

    expect(screen.getByRole("button", { name: "学习路线主页" })).toBeInTheDocument()
    expect(screen.getByText("学习主页")).toBeInTheDocument()
    expect(screen.getByText("我的科目")).toBeInTheDocument()
    expect(screen.getByText("学习工作台")).toBeInTheDocument()
    expect(screen.getByText("个人中心")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "AI 提问" }).length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "展开 AI 助手" })).toBeInTheDocument()
    expect(screen.queryByText(/^20 分钟$/)).not.toBeInTheDocument()
    expect(useChatStore.getState().isOpen).toBe(true)
    expect(useChatStore.getState().panelCollapsed).toBe(true)
    expect(screen.getByTestId("unified-ai-panel")).toHaveAttribute("data-collapsed", "true")

    expect(screen.getByTestId("studio-concept-page").className).toContain("studio-page-shell")
    expect(screen.getByTestId("studio-concept-header").className).toContain("studio-header-shell")
  })

  it("uses the updated desktop three-column layout shell", async () => {
    renderConceptLearningPage()

    await screen.findAllByText("示例章节")

    expect(screen.getByTestId("concept-layout-shell").className).toContain("w-full")
    expect(screen.getByTestId("concept-layout-shell").className).toContain("mx-auto")
    expect(screen.getByTestId("concept-layout-shell").className).toContain("gap-2")
    expect(screen.getByTestId("concept-layout-left").className).toContain("w-[300px]")
    expect(screen.getByTestId("concept-layout-main").className).toContain("flex-1")
    expect(screen.getByTestId("concept-layout-main").className).toContain("min-w-0")
    expect(screen.getByTestId("concept-layout-right").className).toContain("w-[300px]")
    expect(screen.getByTestId("concept-article").className).not.toContain("rounded-2xl")
  })

  it("restores the previous AI rail expanded state from local storage", async () => {
    localStorage.setItem(aiSidebarStateKey, "1")

    renderConceptLearningPage(undefined, true)

    await screen.findAllByText("示例章节")

    expect(screen.getByRole("button", { name: "折叠面板" })).toBeInTheDocument()
    expect(screen.getByTestId("concept-layout-right").className).toContain("w-[300px]")
    expect(useChatStore.getState().panelCollapsed).toBe(false)
    expect(screen.getByTestId("unified-ai-panel")).toHaveAttribute("data-collapsed", "false")
  })

  it("routes both learning-path return buttons back to the plan page", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter
        initialEntries={[
          "/app/concept-learning/task-001?title=二分查找基础&subject=Python&pathId=path-1&day=1",
        ]}
      >
        <Routes>
          <Route path="/app/concept-learning/:taskId" element={<ConceptLearning />} />
          <Route path="/app/ai-learning-path/plan/:pathId" element={<div>PlanPageMock</div>} />
        </Routes>
      </MemoryRouter>
    )

    await screen.findAllByText("示例章节")
    await user.click(screen.getByRole("button", { name: "学习路线主页" }))

    expect(await screen.findByText("PlanPageMock")).toBeInTheDocument()
  })

  it("routes the bottom return button back to the plan page", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter
        initialEntries={[
          "/app/concept-learning/task-001?title=二分查找基础&subject=Python&pathId=path-1&day=1",
        ]}
      >
        <Routes>
          <Route path="/app/concept-learning/:taskId" element={<ConceptLearning />} />
          <Route path="/app/ai-learning-path/plan/:pathId" element={<div>PlanPageMock</div>} />
        </Routes>
      </MemoryRouter>
    )

    await screen.findAllByText("示例章节")
    await user.click(screen.getByRole("button", { name: /返回路线/ }))

    expect(await screen.findByText("PlanPageMock")).toBeInTheDocument()
  })

  it("uses button semantics for the mobile breadcrumb return action", async () => {
    renderConceptLearningPage()

    await screen.findAllByText("示例章节")

    expect(screen.getByRole("button", { name: "学习路线" })).toBeInTheDocument()
  })

  it("adds accessible dialog semantics and escape support for overlays", async () => {
    const user = userEvent.setup()

    renderConceptLearningPage()

    await screen.findAllByText("示例章节")

    await user.click(screen.getAllByRole("button", { name: "打开章节菜单" })[0])
    const mobileMenuDialog = screen.getByRole("dialog", { name: /章节导航菜单/ })
    expect(mobileMenuDialog).toHaveAttribute("aria-modal", "true")

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog", { name: /章节导航菜单/ })).not.toBeInTheDocument()

    await user.click(screen.getAllByRole("button", { name: "打开代码沙箱" })[0])
    const codeSandboxDialog = screen.getByRole("dialog", { name: /代码沙箱/ })
    expect(codeSandboxDialog).toHaveAttribute("aria-modal", "true")

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog", { name: /代码沙箱/ })).not.toBeInTheDocument()
  })

  it("renders docs-style header and article intro anchors", async () => {
    renderConceptLearningPage("/app/concept-learning/task-001?title=二分查找基础&subject=Python")

    await screen.findAllByText("示例章节")

    expect(screen.getByTestId("concept-topbar").className).toContain("backdrop-blur")
    expect(screen.getByTestId("concept-docs-hero").className).toContain("border-b")
    expect(screen.getByTestId("concept-markmap-shell")).toBeInTheDocument()
  })

  it("uses a tighter 27px line-height across article and sidebars", async () => {
    renderConceptLearningPage("/app/concept-learning/task-001?title=二分查找基础&subject=Python")

    await screen.findAllByText("示例章节")

    expect(screen.getByTestId("concept-article").className).toContain("leading-[27px]")
    expect(screen.getByTestId("concept-layout-left").className).toContain("leading-[27px]")
    expect(screen.getByTestId("concept-layout-right").className).toContain("leading-[27px]")
  })

  it("uses a larger 18px base font size across article and sidebars", async () => {
    renderConceptLearningPage("/app/concept-learning/task-001?title=二分查找基础&subject=Python")

    await screen.findAllByText("示例章节")

    expect(screen.getByTestId("concept-article").className).toContain("text-[18px]")
    expect(screen.getByTestId("concept-layout-left").className).toContain("text-[18px]")
    expect(screen.getByTestId("concept-layout-right").className).toContain("text-[18px]")
  })

  it("makes markdown h2 and h3 headings more prominent", async () => {
    renderConceptLearningPage("/app/concept-learning/task-001?title=二分查找基础&subject=Python")

    const sectionHeading = await screen.findByRole("heading", { name: "示例章节" })
    const subHeading = await screen.findByRole("heading", { name: "子标题示例" })

    expect(sectionHeading.className).toContain("text-[2.4rem]")
    expect(sectionHeading.className).toContain("border-b-2")
    expect(subHeading.className).toContain("text-[1.8rem]")
  })




  it("removes deprecated left menu entries", async () => {
    renderConceptLearningPage("/app/concept-learning/task-001?title=二分查找基础&subject=Python")

    await screen.findAllByText("示例章节")
    const leftLayout = screen.getByTestId("concept-layout-left")

    expect(within(leftLayout).queryByText("学习路线主页")).not.toBeInTheDocument()
    expect(within(leftLayout).queryByText("正文阅读")).not.toBeInTheDocument()
    expect(within(leftLayout).queryByText("AI 助手")).not.toBeInTheDocument()
  })

  it("renders the large glass exercise CTA below the article", async () => {
    renderConceptLearningPage("/app/concept-learning/task-001?title=二分查找基础&subject=Python")

    const cta = await screen.findByRole("button", { name: "点我生成习题" })
    expect(cta).toHaveAttribute("data-testid", "concept-generate-exercises")
    expect(cta.className).toContain("exercise-btn-idle")
  })
})
