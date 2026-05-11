import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import ConceptMarkmap from "@/components/concept/ConceptMarkmap"

const mocks = vi.hoisted(() => {
  const destroyMock = vi.fn()
  const fitMock = vi.fn()
  const setDataMock = vi.fn(() => Promise.resolve())
  const markmapCreateMock = vi.fn(() => ({
    destroy: destroyMock,
    fit: fitMock,
    setData: setDataMock,
  }))

  return {
    destroyMock,
    fitMock,
    markmapCreateMock,
    setDataMock,
  }
})

vi.mock("markmap-view", () => ({
  Markmap: {
    create: mocks.markmapCreateMock,
  },
}))

vi.mock("@/components/concept/markmap-assets", () => ({
  transformer: {
    transform: vi.fn(() => ({ root: { content: "Root", children: [] } })),
  },
}))

describe("ConceptMarkmap", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.spyOn(SVGSVGElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 360,
      height: 360,
      left: 0,
      right: 640,
      top: 0,
      width: 640,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    class ResizeObserverMock {
      observe = vi.fn()
      disconnect = vi.fn()
    }

    class IntersectionObserverMock {
      observe = vi.fn()
      disconnect = vi.fn()
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverMock)
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock)
  })

  it("sets numeric SVG dimensions before creating markmap", async () => {
    const { container } = render(<ConceptMarkmap markdown="# Root\n## Child" />)

    await waitFor(() => {
      expect(mocks.markmapCreateMock).toHaveBeenCalledTimes(1)
    })

    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute("width")).toBe("640")
    expect(svg?.getAttribute("height")).toBe("360")
  })
})
