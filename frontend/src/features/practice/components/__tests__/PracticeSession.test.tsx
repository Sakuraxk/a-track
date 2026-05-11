import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { PracticeSession } from "../PracticeSession"

vi.mock("@ant-design/x-markdown", () => ({
  XMarkdown: ({ content }: { content: string }) => <div>{content}</div>,
}))

vi.mock("@/stores/chat", () => ({
  useChatStore: (selector?: (state: { setHideGlobalButton: (hidden: boolean) => void }) => unknown) => {
    const state = {
      setHideGlobalButton: vi.fn(),
    }
    return typeof selector === "function" ? selector(state) : state
  },
}))

vi.mock("../PracticeAIPanel", () => ({
  PracticeAIPanel: () => <div>PracticeAIPanelMock</div>,
}))

describe("PracticeSession", () => {
  it("renders the next-question action in a sticky bottom-right footer after submission", async () => {
    const user = userEvent.setup()

    render(
      <PracticeSession
        questions={[
          {
            id: "q-1",
            question_type: "mcq",
            stem: "Python 中 bool 类型有几个取值？",
            options: [
              { label: "A", text: "1 个", is_correct: false },
              { label: "B", text: "2 个", is_correct: true },
            ],
            answer_key: "B",
            difficulty: 1,
          },
          {
            id: "q-2",
            question_type: "mcq",
            stem: "第二题",
            options: [
              { label: "A", text: "选项 A", is_correct: true },
              { label: "B", text: "选项 B", is_correct: false },
            ],
            answer_key: "A",
            difficulty: 1,
          },
        ]}
        onExit={vi.fn()}
        onComplete={vi.fn()}
        onGetExplanation={vi.fn(async () => null)}
        onSubmitToBackend={vi.fn(async () => ({ is_correct: true }))}
        onGetHint={vi.fn(async () => null)}
        onRunCode={vi.fn(async () => ({ success: true, output: "", error: null, execution_time_ms: 0 }))}
      />
    )

    await user.click(screen.getByText("2 个"))
    await user.click(screen.getByRole("button", { name: "提交答案" }))

    const footer = await screen.findByTestId("practice-next-footer")
    expect(footer.className).toContain("flex-shrink-0")
    expect(footer.className).toContain("justify-between")
    expect(screen.getByRole("button", { name: "下一题" })).toBeInTheDocument()
  })

  it("renders AI grading score and feedback for subjective answers after backend submission", async () => {
    const user = userEvent.setup()
    let resolveSubmission: ((value: {
      is_correct: boolean
      score: number
      scoring_method: string
      feedback: string
      grading_trace: string[]
      grading_detail: {
        total_score: number
        strengths: string[]
        improvements: string[]
        dimensions: Array<{ name: string; score: number; feedback: string }>
      }
    }) => void) | null = null

    render(
      <PracticeSession
        questions={[
          {
            id: "q-short-1",
            question_type: "short_answer",
            stem: "请简述 Python 的主要特点。",
            answer_key: "解释型、动态类型、语法简洁",
            difficulty: 2,
          },
        ]}
        onExit={vi.fn()}
        onComplete={vi.fn()}
        onGetExplanation={vi.fn(async () => null)}
        onSubmitToBackend={vi.fn((_questionId, _answer, onGradingEvent) => {
          onGradingEvent?.({ type: "start", content: "已提交答案，准备判题。" })
          onGradingEvent?.({ type: "grading_step", content: "正在对照参考答案评估用户回答。" })
          return new Promise((resolve) => {
            resolveSubmission = resolve
          })
        })}
        onGetHint={vi.fn(async () => null)}
        onRunCode={vi.fn(async () => ({ success: true, output: "", error: null, execution_time_ms: 0 }))}
      />
    )

    await user.type(screen.getByPlaceholderText("请输入你的答案..."), "Python 语法简洁，适合快速开发。")
    await user.click(screen.getByRole("button", { name: "提交答案" }))

    expect(await screen.findByTestId("grading-stream-status")).toBeInTheDocument()
    expect(screen.getByTestId("grading-step-badge-3")).toHaveAttribute("data-active", "true")
    expect(screen.getByTestId("grading-step-badge-1")).toHaveAttribute("data-state", "completed")
    expect(screen.getByTestId("grading-step-badge-3")).toHaveAttribute("data-state", "active")
    expect(screen.getByText("正在连接 AI 判题服务，对照参考答案生成评分摘要。")).toBeInTheDocument()

    resolveSubmission?.({
      is_correct: true,
      score: 86,
      scoring_method: "llm",
      feedback: "答案覆盖了核心概念，但可以补充动态类型与丰富生态。",
      grading_trace: ["AI 评分完成，已生成可展示的评分依据摘要。"],
      grading_detail: {
        total_score: 86,
        strengths: ["主干概念准确"],
        improvements: ["补充动态类型"],
        dimensions: [
          { name: "内容准确性", score: 34, feedback: "描述准确" },
        ],
      },
    })

    expect(await screen.findByText("86/100")).toBeInTheDocument()
    expect(screen.getByText("AI 自动判题")).toBeInTheDocument()
    expect(screen.getByText("AI 评分过程摘要")).toBeInTheDocument()
    expect(screen.getByText("正在对照参考答案评估用户回答。")).toBeInTheDocument()
    expect(screen.getByText("这里展示的是可审计的评分依据摘要，不展示模型隐藏推理链。")).toBeInTheDocument()
    expect(screen.getByText("答案覆盖了核心概念，但可以补充动态类型与丰富生态。")).toBeInTheDocument()
    expect(screen.getByText("内容准确性")).toBeInTheDocument()
    expect(screen.getByText("主干概念准确")).toBeInTheDocument()
    expect(screen.getByText("补充动态类型")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByTestId("grading-stream-status")).not.toBeInTheDocument()
    })
    expect(screen.getByTestId("grading-step-badge-3")).toHaveAttribute("data-state", "completed")
  })
})
