import { expect, it, vi } from "vitest"

const { mockInitialize, mockRender } = vi.hoisted(() => ({
  mockInitialize: vi.fn(),
  mockRender: vi.fn(),
}))

vi.mock("mermaid", () => ({
  default: {
    initialize: mockInitialize,
    render: mockRender,
  },
}))

it("disables built-in mermaid error rendering during initialization", async () => {
  await import("../Mermaid")

  expect(mockInitialize).toHaveBeenCalledWith(
    expect.objectContaining({
      startOnLoad: false,
      suppressErrorRendering: true,
    })
  )
})
