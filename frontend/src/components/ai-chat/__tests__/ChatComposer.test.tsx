import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import ChatComposer from "@/components/ai-chat/ChatComposer"

describe("ChatComposer", () => {
  it("submits on Enter and disables send while streaming", () => {
    const onChange = vi.fn()
    const onSend = vi.fn()
    const onStop = vi.fn()

    const { rerender } = render(
      <ChatComposer
        value="你好"
        isStreaming={false}
        onChange={onChange}
        onSend={onSend}
        onStop={onStop}
      />
    )

    fireEvent.keyDown(screen.getByPlaceholderText("在此输入您的问题..."), { key: "Enter" })
    expect(onSend).toHaveBeenCalledTimes(1)

    rerender(
      <ChatComposer
        value="你好"
        isStreaming
        onChange={onChange}
        onSend={onSend}
        onStop={onStop}
      />
    )

    expect(screen.queryByLabelText("发送消息")).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("停止生成"))
    expect(onStop).toHaveBeenCalledTimes(1)
  })
})

