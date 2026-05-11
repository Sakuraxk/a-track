import { beforeEach, describe, expect, it } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"

import UnifiedAIPanel from "@/components/ai-chat/UnifiedAIPanel"
import { useChatStore } from "@/stores/chat"

describe("UnifiedAIPanel", () => {
  beforeEach(async () => {
    localStorage.clear()
    useChatStore.setState({
      isOpen: true,
      panelCollapsed: false,
      panelWidth: 420,
      panelDock: "right",
      panelActiveTab: "chat",
    })
    await act(async () => {
      await (useChatStore as unknown as { persist?: { rehydrate: () => Promise<void> } }).persist?.rehydrate?.()
    })
  })

  it("supports collapse and resize and persists panel state", async () => {
    render(<UnifiedAIPanel />)

    expect(screen.queryByRole("button", { name: "切换浮动状态" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "关闭面板" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "折叠面板" }))
    expect(useChatStore.getState().panelCollapsed).toBe(true)
    expect(screen.queryByText("展开")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "展开面板" }))
    expect(useChatStore.getState().panelCollapsed).toBe(false)

    const resizeHandle = screen.getByRole("separator", { name: "调整面板宽度" })
    fireEvent.mouseDown(resizeHandle, { clientX: 500 })
    fireEvent.mouseMove(window, { clientX: 460 })
    fireEvent.mouseUp(window)
    expect(useChatStore.getState().panelWidth).toBeGreaterThan(420)

    localStorage.setItem(
      "chat-store-v3",
      JSON.stringify({
        state: {
          isOpen: true,
          currentSessionId: null,
          panelCollapsed: true,
          panelWidth: 560,
          panelDock: "floating",
          panelActiveTab: "history",
        },
        version: 0,
      })
    )

    await act(async () => {
      await (useChatStore as unknown as { persist?: { rehydrate: () => Promise<void> } }).persist?.rehydrate?.()
    })
    expect(useChatStore.getState().panelCollapsed).toBe(true)
    expect(useChatStore.getState().panelWidth).toBe(560)
    expect(useChatStore.getState().panelDock).toBe("floating")
    expect(screen.queryByText("展开")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "展开面板" }))
    expect(screen.getByRole("button", { name: "回到聊天" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "历史" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("button", { name: "切换浮动状态" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "关闭面板" })).not.toBeInTheDocument()
  })
})
