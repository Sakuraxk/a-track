import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import SkillNode from "@/components/learning-path-workbench/SkillNode"

vi.mock("reactflow", () => ({
  Handle: ({ type, position }: { type: string; position: string }) => (
    <div data-testid={`handle-${type}`} data-position={position} />
  ),
  Position: {
    Top: "top",
    Bottom: "bottom",
    Left: "left",
    Right: "right",
  },
}))

describe("SkillNode", () => {
  it("renders top-bottom handles for vertical tree connections", () => {
    render(
      <SkillNode
        data={{
          label: "编程入门",
          preference: "target",
        }}
        id="node-1"
        type="skillNode"
        selected={false}
        xPos={0}
        yPos={0}
        zIndex={1}
        dragging={false}
        isConnectable={false}
      />,
    )

    expect(screen.getByTestId("handle-target")).toHaveAttribute("data-position", "top")
    expect(screen.getByTestId("handle-source")).toHaveAttribute("data-position", "bottom")
  })
})
