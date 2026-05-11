import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DynamicContextIsland } from "@/features/studio/components/workstation/DynamicContextIsland"
import { buildIslandCopy } from "@/features/studio/components/workstation/workstationCopy"

afterEach(() => {
  vi.useRealTimers()
})

describe("DynamicContextIsland content", () => {
  it("locks the default copy for progress, practice, and review", () => {
    expect(buildIslandCopy("progress")).toEqual({
      statusLabel: "推进中",
      detailLine: "进入概念学习",
    })
    expect(buildIslandCopy("practice")).toEqual({
      statusLabel: "练习态",
      detailLine: "准备开始输出验证",
    })
    expect(buildIslandCopy("review")).toEqual({
      statusLabel: "复盘态",
      detailLine: "训练结束，开始复盘",
    })
  })

  it("shows only practice badge in collapsed practice mode", () => {
    const handleToggle = vi.fn()

    render(
      <DynamicContextIsland
        mode="practice"
        stageTitle="梯度下降"
        stageMeta="机器学习 · Day 3"
        statusLabel="练习态"
        detailLine="准备开始输出验证"
        expanded={false}
        controlsId="practice-panel"
        onToggle={handleToggle}
      />,
    )

    const trigger = screen.getByRole("button", { name: "练习态" })

    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).toHaveAttribute("aria-controls", "practice-panel")
    expect(screen.getByText("练习态")).toBeInTheDocument()
    expect(screen.queryByText("梯度下降")).not.toBeInTheDocument()
    expect(screen.queryByText("机器学习 · Day 3")).not.toBeInTheDocument()
    expect(screen.queryByText("准备开始输出验证")).not.toBeInTheDocument()

    fireEvent.click(trigger)
    expect(handleToggle).toHaveBeenCalledTimes(1)
  })

  it("does not duplicate result numbers in review mode", () => {
    const reviewCopy = buildIslandCopy("review")

    render(
      <DynamicContextIsland
        mode="review"
        stageTitle="梯度下降"
        stageMeta="机器学习 · Day 3"
        statusLabel="复盘态"
        detailLine="得分 78% · 训练结束，开始复盘"
        expanded
        controlsId="review-panel"
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText(reviewCopy.detailLine)).toBeInTheDocument()
    expect(screen.queryByText(/得分/)).not.toBeInTheDocument()
    expect(screen.queryByText(/78%/)).not.toBeInTheDocument()
  })

  it("keeps review detail text when it does not contain result numbers", () => {
    render(
      <DynamicContextIsland
        mode="review"
        stageTitle="梯度下降"
        stageMeta="机器学习 · Day 3"
        statusLabel="复盘态"
        detailLine="查看错题与建议"
        expanded
        controlsId="review-panel"
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText("查看错题与建议")).toBeInTheDocument()
  })
})

describe("DynamicContextIsland interactions", () => {
  it("keeps practice panel collapsed on accidental hover", () => {
    vi.useFakeTimers()

    render(
      <DynamicContextIsland
        mode="practice"
        stageTitle="梯度下降"
        stageMeta="机器学习 · Day 3"
        statusLabel="练习态"
        detailLine="准备开始输出验证"
        expanded={false}
        controlsId="practice-panel"
        onToggle={vi.fn()}
      />,
    )

    const trigger = screen.getByRole("button", { name: /练习态/ })

    act(() => {
      fireEvent.pointerEnter(trigger)
      vi.advanceTimersByTime(100)
    })

    expect(screen.queryByTestId("island-panel")).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute("aria-expanded", "false")

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByTestId("island-panel")).toBeInTheDocument()
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })

  it("updates aria-expanded and closes on Escape", () => {
    vi.useFakeTimers()

    render(
      <DynamicContextIsland
        mode="progress"
        stageTitle="梯度下降"
        stageMeta="机器学习 · Day 3"
        statusLabel="推进中"
        detailLine="进入概念学习"
        expanded={false}
        controlsId="progress-panel"
        onToggle={vi.fn()}
      />,
    )

    const trigger = screen.getByRole("button", { name: /推进中/ })
    act(() => {
      fireEvent.click(trigger)
    })

    expect(trigger).toHaveAttribute("aria-expanded", "true")
    const panel = screen.getByRole("region")
    expect(panel).toBeInTheDocument()
    expect(panel).not.toHaveAttribute("aria-modal")

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" })
      vi.advanceTimersByTime(20)
    })

    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).toHaveFocus()
  })

  it("keeps the island open when moving through the safe zone", () => {
    vi.useFakeTimers()

    render(
      <DynamicContextIsland
        mode="progress"
        stageTitle="梯度下降"
        stageMeta="机器学习 · Day 3"
        statusLabel="推进中"
        detailLine="进入概念学习"
        expanded={false}
        controlsId="progress-panel"
        onToggle={vi.fn()}
      />,
    )

    const trigger = screen.getByRole("button", { name: /推进中/ })
    act(() => {
      fireEvent.pointerEnter(trigger)
    })

    expect(screen.getByTestId("island-panel")).toBeInTheDocument()

    act(() => {
      fireEvent.pointerLeave(trigger)
      fireEvent.pointerEnter(screen.getByTestId("island-safe-zone"))
      vi.advanceTimersByTime(20)
    })

    expect(screen.getByTestId("island-panel")).toBeInTheDocument()
  })

  it("keeps the island open when pointer stays inside the safe triangle", () => {
    vi.useFakeTimers()

    render(
      <DynamicContextIsland
        mode="progress"
        stageTitle="梯度下降"
        stageMeta="机器学习 · Day 3"
        statusLabel="推进中"
        detailLine="进入概念学习"
        expanded={false}
        controlsId="progress-panel"
        onToggle={vi.fn()}
      />,
    )

    const trigger = screen.getByRole("button", { name: /推进中/ })

    act(() => {
      fireEvent.pointerEnter(trigger, { clientX: 100, clientY: 48 })
    })

    const panel = screen.getByTestId("island-panel") as HTMLDivElement
    panel.getBoundingClientRect = () =>
      ({
        left: 80,
        right: 220,
        top: 120,
        bottom: 260,
        width: 140,
        height: 140,
        x: 80,
        y: 120,
        toJSON: () => null,
      }) as DOMRect

    act(() => {
      fireEvent.pointerLeave(trigger, { clientX: 100, clientY: 48 })
      fireEvent.pointerMove(window, { clientX: 130, clientY: 96 })
      vi.advanceTimersByTime(20)
    })

    expect(screen.getByTestId("island-panel")).toBeInTheDocument()
  })
})
