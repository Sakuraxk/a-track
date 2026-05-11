import axios from "axios"
import { useAuthStore } from "@/stores/auth"

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
})

// 请求拦截器：添加 Authorization header
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器：处理 401 错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期或无效，清除状态并跳转登录
      useAuthStore.getState().logout()
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const normalizeServerDetail = (detail: unknown): string | undefined => {
      if (typeof detail === "string") {
        const trimmed = detail.trim()
        if (!trimmed) return undefined
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            const parsed = JSON.parse(trimmed)
            return normalizeServerDetail(parsed)
          } catch {
            // ignore JSON parse errors and continue with raw text
          }
        }
        const textOnly = trimmed.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        return textOnly || trimmed
      }
      if (Array.isArray(detail)) return undefined
      if (detail && typeof detail === "object") {
        if (Object.keys(detail as Record<string, unknown>).length === 0) return undefined
        const maybeDetail = (detail as { detail?: unknown }).detail
        if (maybeDetail !== undefined) return normalizeServerDetail(maybeDetail)
        const maybeMessage = (detail as { message?: unknown }).message
        if (maybeMessage !== undefined) return normalizeServerDetail(maybeMessage)
        const maybeError = (detail as { error?: unknown }).error
        if (maybeError !== undefined) return normalizeServerDetail(maybeError)
        const maybeReason = (detail as { reason?: unknown }).reason
        if (maybeReason !== undefined) return normalizeServerDetail(maybeReason)
        try {
          return JSON.stringify(detail)
        } catch {
          return undefined
        }
      }
      return undefined
    }

    const messageFromServer = normalizeServerDetail(error.response?.data)

    const looksMostlyEnglish = (text: string) => {
      const letters = (text.match(/[A-Za-z]/g) ?? []).length
      const chinese = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
      return letters > 0 && chinese === 0
    }

    if (messageFromServer && !looksMostlyEnglish(messageFromServer)) return messageFromServer

    const status = error.response?.status
    if (status) {
      // FastAPI / Pydantic validation errors (422)
      const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
      if (status === 422 && Array.isArray(detail)) {
        const fieldNameMap: Record<string, string> = {
          email: "邮箱",
          phone: "手机号",
          password: "密码",
          confirm_password: "确认密码",
        }

        const normalizeFieldLabel = (loc: unknown) => {
          if (!Array.isArray(loc) || loc.length === 0) return "参数"
          const last = loc[loc.length - 1]
          if (typeof last !== "string") return "参数"
          return fieldNameMap[last] ?? last
        }

        const toChinese = (msg: unknown, fieldLabel: string) => {
          if (typeof msg !== "string") return `${fieldLabel}不合法`
          if (msg === "Field required") return `缺少必填字段：${fieldLabel}`
          if (msg.includes("valid email")) return "邮箱格式不正确"
          if (msg.includes("at least") && msg.includes("characters")) {
            const m = msg.match(/at least\s+(\d+)\s+characters/)
            if (m?.[1]) return `${fieldLabel}至少 ${m[1]} 位`
            return `${fieldLabel}长度过短`
          }
          if (msg.includes("at most") && msg.includes("characters")) {
            const m = msg.match(/at most\s+(\d+)\s+characters/)
            if (m?.[1]) return `${fieldLabel}最多 ${m[1]} 位`
            return `${fieldLabel}长度过长`
          }
          return `${fieldLabel}不合法`
        }

        const messages = detail
          .map((item: any) => {
            const fieldLabel = normalizeFieldLabel(item?.loc)
            return toChinese(item?.msg, fieldLabel)
          })
          .filter((v: unknown): v is string => typeof v === "string" && v.length > 0)

        const unique = Array.from(new Set(messages))
        if (unique.length > 0) return unique.join("；")
      }

      if (status === 401) return "登录已过期，请重新登录"
      if (status === 403) return "暂无权限访问该内容"
      if (status === 404) return "请求的内容不存在"
      if (status === 429) return "请求过于频繁，请稍后再试"
      if (status >= 500) {
        if (messageFromServer) return messageFromServer
        return "服务暂时不可用，请稍后再试"
      }
      return "请求失败，请检查输入或稍后重试"
    }

    if (error.code === "ECONNABORTED") return "请求超时，请稍后重试"
    if (typeof error.message === "string") {
      if (error.message.includes("Network Error")) {
        // 提供更详细的诊断信息
        const targetUrl = API_BASE_URL || window.location.origin
        console.error(`[API] 无法连接到后端服务: ${targetUrl}`)
        console.error("[API] 请检查: 1. 后端服务是否已启动 2. API地址是否正确 3. 是否存在CORS问题")
        return "无法连接到服务器，请确认后端服务已启动"
      }
      if (!looksMostlyEnglish(error.message)) return error.message
    }

    return "请求失败，请稍后重试"
  }

  if (error instanceof Error) {
    const requestFailureMatch = error.message.match(/^请求失败:\s*\d+\s*-\s*(.+)$/s)
    if (requestFailureMatch?.[1]) {
      return requestFailureMatch[1].trim()
    }
    const letters = (error.message.match(/[A-Za-z]/g) ?? []).length
    const chinese = (error.message.match(/[\u4e00-\u9fff]/g) ?? []).length
    if (letters > 0 && chinese === 0) return "发生未知错误，请稍后重试"
    return error.message
  }
  return "未知错误"
}
