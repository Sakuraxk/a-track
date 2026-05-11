import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LearningWorkstation } from "@/features/studio/components/workstation/LearningWorkstation"
import {
  resolveRenderState,
  useLearningWorkstationState,
} from "@/features/studio/components/workstation/useLearningWorkstationState"

import type { LearningWorkstationState } from "@/features/studio/components/workstation/workstationTypes"

const WORKSTATION_OVERRIDE_STORAGE_KEY = "learning-workstation-override-state"

function getScopedOverrideKey(storageScope?: string) {
  return storageScope
    ? `${WORKSTATION_OVERRIDE_STORAGE_KEY}:${storageScope}`
    : WORKSTATION_OVERRIDE_STORAGE_KEY
}

beforeEach(() => {
  window.sessionStorage.clear()
})

describe("LearningWorkstation state priority", () => {
  it("prefers overrideState over previewState and systemState", () => {
    expect(
      resolveRenderState({
        systemState: "progress",
        previewState: "review",
        overrideState: "practice",
      }),
    ).toBe("practice")
  })

  it("falls back to previewState when overrideState is null", () => {
    expect(
      resolveRenderState({
        systemState: "progress",
        previewState: "review",
        overrideState: null,
      }),
    ).toBe("review")
  })

  it("falls back to systemState when preview and override are null", () => {
    expect(
      resolveRenderState({
        systemState: "progress",
        previewState: null,
        overrideState: null,
      }),
    ).toBe("progress")
  })
})

describe("LearningWorkstation state integration", () => {
  function WorkstationWithState({
    systemState,
    storageScope = "python",
  }: {
    systemState: LearningWorkstationState
    storageScope?: string
  }) {
    return (
      <LearningWorkstation
        systemState={systemState}
        subjectName="Python 编程"
        storageScope={storageScope}
        stageTitle="认识函数"
        stageMeta="Python 编程 · Day 1"
        hero={<div>Hero</div>}
        acts={{
          act1: { title: "主线双步", summary: "认识函数", content: <div>act1</div> },
          act2: { title: "策略星图", summary: "路线 v1", content: <div>act2</div> },
          act3: { title: "行动面板", summary: "动作入口", content: <div>act3</div> },
          act4: { title: "完成进度", summary: "0/1", content: <div>act4</div> },
          act5: { title: "明日衔接", summary: "等待生成", content: <div>act5</div> },
        }}
      />
    )
  }

  it("applies preview/override correction rules inside workstation", () => {
    render(<WorkstationWithState systemState="progress" />)

    fireEvent.click(screen.getByRole("button", { name: /推进中/ }))
    fireEvent.click(screen.getByRole("button", { name: "复盘态" }))

    expect(
      within(screen.getByTestId("island-panel")).getByText(
        (_, node) =>
          node?.tagName === "P" &&
          (node.textContent?.includes("当前渲染态：复盘态") ?? false),
      ),
    ).toHaveTextContent("当前渲染态：复盘态")
    expect(
      screen.getByRole("button", { name: "设为当前状态" }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "练习态" }))
    expect(
      within(screen.getByTestId("island-panel")).getByText(
        (_, node) =>
          node?.tagName === "P" &&
          (node.textContent?.includes("当前渲染态：练习态") ?? false),
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "设为当前状态" }))
    expect(
      within(screen.getByTestId("island-panel")).getByText(
        (_, node) =>
          node?.tagName === "P" &&
          (node.textContent?.includes("当前渲染态：练习态") ?? false),
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "设为当前状态" }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "恢复自动状态" }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "复盘态" }))
    expect(
      within(screen.getByTestId("island-panel")).getByText(
        (_, node) =>
          node?.tagName === "P" &&
          (node.textContent?.includes("当前渲染态：复盘态") ?? false),
      ),
    ).toBeInTheDocument()
  })

  it("renders island within workstation flow instead of fixed viewport overlay", () => {
    render(<WorkstationWithState systemState="progress" />)

    const trigger = screen.getByRole("button", { name: /推进中/ })

    expect(trigger.className).not.toContain("fixed")
    fireEvent.click(trigger)
    expect(screen.getByTestId("island-panel")).toHaveClass("absolute")
    expect(screen.getByTestId("learning-workstation-hero-progress")).toHaveClass(
      "scroll-mt-32",
    )
  })

  it("scrolls to practice hero when switching into practice", () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    render(<WorkstationWithState systemState="progress" />)

    fireEvent.click(screen.getByRole("button", { name: /推进中/ }))
    fireEvent.click(screen.getByRole("button", { name: "练习态" }))
    fireEvent.click(screen.getByRole("button", { name: "设为当前状态" }))

    expect(scrollIntoView).toHaveBeenCalled()
    expect(screen.getByTestId("learning-workstation-hero-practice")).toBeInTheDocument()
    Element.prototype.scrollIntoView = originalScrollIntoView
  })

  it("scrolls to review hero when switching into review", () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    render(<WorkstationWithState systemState="progress" />)

    fireEvent.click(screen.getByRole("button", { name: /推进中/ }))
    fireEvent.click(screen.getByRole("button", { name: "复盘态" }))
    fireEvent.click(screen.getByRole("button", { name: "设为当前状态" }))

    expect(scrollIntoView).toHaveBeenCalled()
    expect(screen.getByTestId("learning-workstation-hero-review")).toBeInTheDocument()
    Element.prototype.scrollIntoView = originalScrollIntoView
  })

  it("marks daybreak transition when moving from review back to progress", () => {
    const { rerender } = render(<WorkstationWithState systemState="review" />)

    rerender(<WorkstationWithState systemState="progress" />)

    expect(screen.getByTestId("learning-workstation")).toHaveAttribute(
      "data-transition-intent",
      "daybreak",
    )
  })
})

describe("LearningWorkstation hook state transitions", () => {
  function Harness({
    systemState,
    storageScope,
  }: {
    systemState: LearningWorkstationState
    storageScope?: string
  }) {
    const {
      previewState,
      overrideState,
      renderState,
      setPreviewState,
      setOverrideState,
      clearManualState,
    } = useLearningWorkstationState(systemState, storageScope)

    return (
      <div>
        <div data-testid="preview-state">{previewState ?? "null"}</div>
        <div data-testid="override-state">{overrideState ?? "null"}</div>
        <div data-testid="render-state">{renderState}</div>
        <button
          type="button"
          onClick={() => {
            setPreviewState("review")
          }}
        >
          set preview
        </button>
        <button
          type="button"
          onClick={() => {
            setOverrideState("practice")
          }}
        >
          set override
        </button>
        <button
          type="button"
          onClick={() => {
            clearManualState()
          }}
        >
          clear manual
        </button>
      </div>
    )
  }

  it("updates renderState based on override ?? preview ?? system", () => {
    const { rerender } = render(<Harness systemState="progress" />)

    expect(screen.getByTestId("render-state")).toHaveTextContent("progress")
    expect(screen.getByTestId("preview-state")).toHaveTextContent("null")
    expect(screen.getByTestId("override-state")).toHaveTextContent("null")

    fireEvent.click(screen.getByRole("button", { name: "set preview" }))
    expect(screen.getByTestId("render-state")).toHaveTextContent("review")
    expect(screen.getByTestId("preview-state")).toHaveTextContent("review")
    expect(screen.getByTestId("override-state")).toHaveTextContent("null")

    rerender(<Harness systemState="practice" />)
    expect(screen.getByTestId("render-state")).toHaveTextContent("review")
    expect(screen.getByTestId("preview-state")).toHaveTextContent("review")

    fireEvent.click(screen.getByRole("button", { name: "set override" }))
    expect(screen.getByTestId("render-state")).toHaveTextContent("practice")
    expect(screen.getByTestId("override-state")).toHaveTextContent("practice")

    rerender(<Harness systemState="progress" />)
    expect(screen.getByTestId("render-state")).toHaveTextContent("practice")
    expect(screen.getByTestId("override-state")).toHaveTextContent("practice")

    fireEvent.click(screen.getByRole("button", { name: "clear manual" }))
    expect(screen.getByTestId("render-state")).toHaveTextContent("progress")
    expect(screen.getByTestId("preview-state")).toHaveTextContent("null")
    expect(screen.getByTestId("override-state")).toHaveTextContent("null")
  })

  it("restores overrideState from sessionStorage on first render", () => {
    window.sessionStorage.setItem(
      getScopedOverrideKey("python"),
      "review",
    )

    render(<Harness systemState="progress" storageScope="python" />)

    expect(screen.getByTestId("override-state")).toHaveTextContent("review")
    expect(screen.getByTestId("render-state")).toHaveTextContent("review")
  })

  it("persists overrideState changes into sessionStorage", () => {
    render(<Harness systemState="progress" storageScope="python" />)

    fireEvent.click(screen.getByRole("button", { name: "set override" }))

    expect(window.sessionStorage.getItem(getScopedOverrideKey("python"))).toBe(
      "practice",
    )
  })

  it("removes persisted overrideState when clearing manual state", () => {
    window.sessionStorage.setItem(
      getScopedOverrideKey("python"),
      "practice",
    )

    render(<Harness systemState="progress" storageScope="python" />)

    fireEvent.click(screen.getByRole("button", { name: "clear manual" }))

    expect(
      window.sessionStorage.getItem(getScopedOverrideKey("python")),
    ).toBeNull()
  })

  it("isolates persisted overrideState by storageScope", () => {
    window.sessionStorage.setItem(getScopedOverrideKey("python"), "review")
    window.sessionStorage.setItem(getScopedOverrideKey("math"), "practice")

    const { rerender } = render(
      <Harness systemState="progress" storageScope="python" />,
    )

    expect(screen.getByTestId("override-state")).toHaveTextContent("review")
    expect(screen.getByTestId("render-state")).toHaveTextContent("review")

    rerender(<Harness systemState="progress" storageScope="math" />)
    expect(screen.getByTestId("override-state")).toHaveTextContent("practice")
    expect(screen.getByTestId("render-state")).toHaveTextContent("practice")

    rerender(<Harness systemState="progress" storageScope="history" />)
    expect(screen.getByTestId("override-state")).toHaveTextContent("null")
    expect(screen.getByTestId("render-state")).toHaveTextContent("progress")
  })
})
