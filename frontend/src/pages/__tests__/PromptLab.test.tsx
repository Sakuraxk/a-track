import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import PromptLab from "@/pages/PromptLab"

const listPrompts = vi.fn()
const getPromptDetail = vi.fn()
const analyzePrompt = vi.fn()
const optimizePrompt = vi.fn()
const applyPromptIssue = vi.fn()
const renderPromptPreview = vi.fn()
const runPrompt = vi.fn()
const savePrompt = vi.fn()
const diffPromptVersions = vi.fn()
const restorePromptVersion = vi.fn()

vi.mock("@/lib/promptLabApi", () => ({
  listPrompts: (...args: unknown[]) => listPrompts(...args),
  getPromptDetail: (...args: unknown[]) => getPromptDetail(...args),
  analyzePrompt: (...args: unknown[]) => analyzePrompt(...args),
  optimizePrompt: (...args: unknown[]) => optimizePrompt(...args),
  applyPromptIssue: (...args: unknown[]) => applyPromptIssue(...args),
  renderPromptPreview: (...args: unknown[]) => renderPromptPreview(...args),
  runPrompt: (...args: unknown[]) => runPrompt(...args),
  savePrompt: (...args: unknown[]) => savePrompt(...args),
  diffPromptVersions: (...args: unknown[]) => diffPromptVersions(...args),
  restorePromptVersion: (...args: unknown[]) => restorePromptVersion(...args),
}))

describe("PromptLab", () => {
  beforeEach(() => {
    vi.resetAllMocks()

    listPrompts.mockResolvedValue({
      prompts: [
        {
          name: "question_bank.generate",
          description: "生成题库题目",
          has_system_template: true,
          temperature: 0.7,
          max_tokens: 2000,
          output_format: "json",
        },
      ],
    })

    getPromptDetail.mockResolvedValue({
      prompt: {
        name: "question_bank.generate",
        description: "生成题库题目",
        system_template: "你是一位题目生成助手。",
        user_template: "请为 {subject_name} 生成题目。",
        temperature: 0.7,
        max_tokens: 2000,
        output_format: "json",
        required_variables: ["subject_name"],
        suggested_variables: { subject_name: "Python" },
        fixtures: ["question_bank_generate.json"],
        fixture_examples: [
          {
            name: "question_bank_generate.json",
            data: { subject_name: "Python" },
          },
        ],
        versions: [
          {
            version_id: "v1",
            created_at: "2026-03-13T20:00:00",
            note: "initial",
            restored_from: null,
          },
        ],
      },
    })

    renderPromptPreview.mockResolvedValue({
      messages: [
        { role: "system", content: "你是一位题目生成助手。" },
        { role: "user", content: "请为 Python 生成题目。" },
      ],
    })

    analyzePrompt.mockResolvedValue({
      report: {
        score: 76,
        grade: "合格",
        summary: "当前 Prompt 结构清晰，但约束表达仍可增强。",
        improvement_suggestions: ["补充 JSON-only 约束", "强化输出结构"],
        dimensions: [
          { name: "结构清晰度", score: 85, reason: "结构较清楚" },
          { name: "意图表达", score: 80, reason: "目标表达较明确" },
          { name: "约束完整性", score: 75, reason: "JSON 约束可加强" },
          { name: "变量健壮性", score: 78, reason: "变量样例存在" },
          { name: "可执行性", score: 72, reason: "仍可增强执行约束" },
        ],
        issues: [
          {
            id: "json-only",
            severity: "high",
            title: "输出约束不完整",
            problem: "缺少只能输出 JSON 的硬约束。",
            suggestion: "补充“只输出 JSON，不要其他内容”。",
            target_section: "user",
            matched_text: "请返回 JSON 格式。",
            replacement_text: "只输出 JSON，不要其他内容。",
          },
        ],
      },
    })

    optimizePrompt.mockResolvedValue({
      result: {
        optimized_system_template: "你是一位题目生成助手。你必须只输出 JSON，不要输出任何额外说明。",
        optimized_user_template: "## 任务目标\n请为 {subject_name} 生成题目。\n\n## 输出格式\n只输出 JSON，不要其他内容。",
        change_summary: "增强了 JSON-only 约束并补充结构标题。",
        optimization_notes: "根据规则分析自动强化。",
        optimization_mode: "llm",
        quality_report: {
          score: 88,
          grade: "良好",
          summary: "优化后约束更清晰，结构更稳定。",
          improvement_suggestions: [],
          dimensions: [
            { name: "结构清晰度", score: 90, reason: "结构清晰" },
            { name: "意图表达", score: 86, reason: "意图明确" },
            { name: "约束完整性", score: 89, reason: "约束增强" },
            { name: "变量健壮性", score: 82, reason: "变量稳定" },
            { name: "可执行性", score: 86, reason: "更可执行" },
          ],
          issues: [],
        },
      },
    })

    applyPromptIssue.mockResolvedValue({
      issue: {
        id: "json-only",
        severity: "high",
        title: "输出约束不完整",
        problem: "缺少只能输出 JSON 的硬约束。",
        suggestion: "补充“只输出 JSON，不要其他内容”。",
        target_section: "user",
        matched_text: "请为 {subject_name} 生成题目。",
        replacement_text: "请为 {subject_name} 生成题目。\n\n只输出 JSON，不要其他内容。",
      },
      draft: {
        name: "question_bank.generate",
        description: "生成题库题目",
        system_template: "你是一位题目生成助手。",
        user_template: "请为 {subject_name} 生成题目。\n\n只输出 JSON，不要其他内容。",
        temperature: 0.7,
        max_tokens: 2000,
        output_format: "json",
        required_variables: ["subject_name"],
        suggested_variables: { subject_name: "Python" },
        fixtures: ["question_bank_generate.json"],
        fixture_examples: [
          {
            name: "question_bank_generate.json",
            data: { subject_name: "Python" },
          },
        ],
        versions: [
          {
            version_id: "v1",
            created_at: "2026-03-13T20:00:00",
            note: "initial",
            restored_from: null,
          },
        ],
      },
      diff: {
        target_section: "user",
        before: "请为 {subject_name} 生成题目。",
        after: "请为 {subject_name} 生成题目。\n\n只输出 JSON，不要其他内容。",
      },
    })

    savePrompt.mockResolvedValue({
      prompt: {
        name: "question_bank.generate",
        description: "生成题库题目",
        system_template: "你是一位题目生成助手。",
        user_template: "请为 {subject_name} 生成题目。",
        temperature: 0.3,
        max_tokens: 1500,
        output_format: "json",
        required_variables: ["subject_name"],
        suggested_variables: { subject_name: "Python" },
        fixtures: ["question_bank_generate.json"],
        fixture_examples: [
          {
            name: "question_bank_generate.json",
            data: { subject_name: "Python" },
          },
        ],
        versions: [
          {
            version_id: "v2",
            created_at: "2026-03-13T20:10:00",
            note: "refine",
            restored_from: null,
          },
        ],
      },
      version: {
        version_id: "v2",
        created_at: "2026-03-13T20:10:00",
        note: "refine",
        restored_from: null,
      },
    })

    diffPromptVersions.mockResolvedValue({
      diff: {
        system_template: "--- old\n+++ new\n@@\n-旧\n+新",
        user_template: "--- old\n+++ new\n@@\n-旧用户\n+新用户",
        catalog: "--- old\n+++ new\n@@\n-0.7\n+0.3",
      },
    })

    restorePromptVersion.mockResolvedValue({
      prompt: {
        name: "question_bank.generate",
        description: "生成题库题目",
        system_template: "你是一位题目生成助手。",
        user_template: "请为 {subject_name} 生成题目。",
        temperature: 0.7,
        max_tokens: 2000,
        output_format: "json",
        required_variables: ["subject_name"],
        suggested_variables: { subject_name: "Python" },
        fixtures: ["question_bank_generate.json"],
        fixture_examples: [
          {
            name: "question_bank_generate.json",
            data: { subject_name: "Python" },
          },
        ],
        versions: [
          {
            version_id: "v3",
            created_at: "2026-03-13T20:20:00",
            note: "restore v1",
            restored_from: "v1",
          },
        ],
      },
      version: {
        version_id: "v3",
        created_at: "2026-03-13T20:20:00",
        note: "restore v1",
        restored_from: "v1",
      },
    })
  })

  it("loads prompts and shows the selected prompt editor", async () => {
    render(<PromptLab />)

    expect(await screen.findByRole("heading", { name: "提示词实验室" })).toBeInTheDocument()
    expect(await screen.findByDisplayValue("生成题库题目")).toBeInTheDocument()
    expect(await screen.findByText("question_bank_generate.json")).toBeInTheDocument()
  })

  it("renders prompt preview from the current editor values", async () => {
    const user = userEvent.setup()
    render(<PromptLab />)

    await screen.findByDisplayValue("请为 {subject_name} 生成题目。")
    await user.click(screen.getByRole("button", { name: "渲染提示词" }))

    expect(renderPromptPreview).toHaveBeenCalled()
    expect((await screen.findByTestId("prompt-preview-output")).textContent).toContain("请为 Python 生成题目。")
  })

  it("saves prompt changes and refreshes version state", async () => {
    const user = userEvent.setup()
    render(<PromptLab />)

    await user.click(screen.getByRole("button", { name: "参数设置" }))
    const temperatureInput = await screen.findByTestId("prompt-temperature-input")
    await user.clear(temperatureInput)
    await user.type(temperatureInput, "0.3")
    await user.click(screen.getByRole("button", { name: "保存并创建版本" }))

    await waitFor(() => expect(savePrompt).toHaveBeenCalled())
    expect(await screen.findByText("最新版本：v2")).toBeInTheDocument()
  })

  it("shows diff and can restore a version", async () => {
    const user = userEvent.setup()
    render(<PromptLab />)

    await user.click(screen.getByRole("button", { name: "版本" }))
    await screen.findByTestId("version-entry-v1")
    await user.click(screen.getByRole("button", { name: "对比选中版本" }))
    expect((await screen.findByTestId("version-diff-primary")).textContent).toContain("--- old")

    await user.click(screen.getByRole("button", { name: "恢复选中版本" }))
    await waitFor(() => expect(restorePromptVersion).toHaveBeenCalled())
    expect(await screen.findByText("最新版本：v3")).toBeInTheDocument()
  })

  it("toggles the sidebar and opens the analysis drawer", async () => {
    const user = userEvent.setup()
    render(<PromptLab />)

    await user.click(await screen.findByRole("button", { name: "折叠菜单" }))
    expect(await screen.findByTestId("prompt-lab-sidebar")).toHaveAttribute("data-collapsed", "true")

    await user.click(screen.getByRole("button", { name: "提示词质量分析" }))
    expect(await screen.findByTestId("prompt-analysis-drawer")).toBeInTheDocument()
    expect(await screen.findByTestId("prompt-analysis-title")).toBeInTheDocument()
    expect(analyzePrompt).toHaveBeenCalled()
    expect(await screen.findByText("输出约束不完整")).toBeInTheDocument()
    expect(await screen.findByText("当前 Prompt 结构清晰，但约束表达仍可增强。")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "立即替换" }))
    expect(applyPromptIssue).toHaveBeenCalled()
    expect(await screen.findByText("只输出 JSON，不要其他内容。")).toBeInTheDocument()

    await user.click(screen.getByTestId("optimize-button"))
    expect(optimizePrompt).toHaveBeenCalled()
    expect(await screen.findByDisplayValue("你是一位题目生成助手。你必须只输出 JSON，不要输出任何额外说明。")).toBeInTheDocument()
    expect(await screen.findByText("优化前后评分对比")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "关闭分析抽屉" }))
    await waitFor(() => {
      expect(screen.queryByTestId("prompt-analysis-drawer")).not.toBeInTheDocument()
    })
  })
})
