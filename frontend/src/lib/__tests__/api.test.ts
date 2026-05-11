import { describe, expect, it } from "vitest"

import { getApiErrorMessage } from "@/lib/api"

describe("getApiErrorMessage", () => {
  it("优先透传 5xx 响应中的后端 detail", () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 503,
        data: {
          detail:
            "技术树发散调用失败：source=user；config_id=cfg-1；model=user-model；base_url=https://api.example.com/v1；timeout=60；max_tokens=512；json_mode=True；原因=APITimeoutError: timeout",
        },
      },
    }

    expect(getApiErrorMessage(error)).toContain("技术树发散调用失败")
    expect(getApiErrorMessage(error)).toContain("config_id=cfg-1")
  })

  it("5xx 没有 detail 时才回退通用服务不可用文案", () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 503,
        data: {},
      },
    }

    expect(getApiErrorMessage(error)).toBe("服务暂时不可用，请稍后再试")
  })

  it("普通 Error 中的请求失败包裹文案也会尽量提取后端正文", () => {
    const error = new Error("请求失败: 503 - 技术树发散调用失败：config_id=cfg-1；原因=timeout")

    expect(getApiErrorMessage(error)).toBe("技术树发散调用失败：config_id=cfg-1；原因=timeout")
  })

  it("5xx 返回纯文本正文时也会优先展示正文", () => {
    const error = {
      isAxiosError: true,
      response: {
        status: 503,
        data: "技术树发散调用失败：source=user；原因=timeout",
      },
    }

    expect(getApiErrorMessage(error)).toBe("技术树发散调用失败：source=user；原因=timeout")
  })
})
