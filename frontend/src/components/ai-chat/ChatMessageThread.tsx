
import { XMarkdown } from "@ant-design/x-markdown"
import Latex from "@ant-design/x-markdown/plugins/Latex"
import "@ant-design/x-markdown/es/XMarkdown/index.css"
import "@/styles/x-markdown-overrides.css"

import type { ChatMessage } from "@/stores/chat"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth"

type ChatMessageThreadProps = {
  messages: ChatMessage[]
  emptyText?: string
}

export default function ChatMessageThread({
  messages,
  emptyText = "暂无对话，试试直接提问或选中学习内容后发起提问。",
}: ChatMessageThreadProps) {
  const profile = useAuthStore((s) => s.profile)

  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-6 text-center text-sm leading-7 text-slate-500">
        {emptyText}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <div
          key={`${message.role}-${index}`}
          className={cn("flex flex-col gap-1", message.role === "user" ? "items-end" : "items-start")}
        >
          {message.role === "ai" && (
            <div className="mb-1.5 ml-1 flex items-center gap-2">
              <div className="flex h-6 w-6 overflow-hidden items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm p-[1px]">
                <img src="/logo2.png" alt="AI Bot" className="w-full h-full object-contain" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-600/80">AI 助手</span>
            </div>
          )}

          {message.role === "user" && (
            <div className="mb-1 mr-1 flex flex-row-reverse items-center gap-2">
              <div className="flex h-6 w-6 overflow-hidden items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold border border-white/10">
                {profile?.portrait?.avatar_url ? (
                  <img
                    src={profile.portrait.avatar_url}
                    alt="User"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement
                      img.style.display = "none"
                      const fallback = img.parentElement?.querySelector(".chat-avatar-fallback") as HTMLElement | null
                      if (fallback) fallback.style.display = "flex"
                    }}
                  />
                ) : null}
                {!profile?.portrait?.avatar_url && (
                  <span className="chat-avatar-fallback flex items-center justify-center">
                    {profile?.portrait?.nickname?.charAt(0) || profile?.user_id?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                )}
                {profile?.portrait?.avatar_url && (
                  <span className="chat-avatar-fallback items-center justify-center" style={{ display: "none" }}>
                    {profile?.portrait?.nickname?.charAt(0) || profile?.user_id?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium text-slate-500">
                {profile?.portrait?.nickname || "用户"}
              </span>
            </div>
          )}

          {message.role === "ai" && message.reasoning && (
            <details className="w-full max-w-[95%] rounded-2xl border border-slate-200 bg-slate-50/80 p-2.5 text-[11px] text-slate-500">
              <summary className="cursor-pointer font-semibold text-sky-600">思考过程</summary>
              <div className="mt-2 whitespace-pre-wrap">{message.reasoning}</div>
            </details>
          )}

          {message.role === "ai" ? (
            <div
              className="max-w-[95%] rounded-2xl border border-[oklch(89%_0.018_220)] bg-[linear-gradient(180deg,white,oklch(99%_0.004_220))] px-4 py-3 text-sm text-slate-700 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)]"
            >
              {message.content ? (
                <XMarkdown
                  className="prose prose-sm max-w-none text-slate-700 x-markdown-light"
                  content={message.content}
                  config={{ extensions: Latex() }}
                  dompurifyConfig={{ ADD_ATTR: ['style'] }}
                />
              ) : (
                message.isStreaming ? "正在生成回答..." : ""
              )}
            </div>
          ) : (
            <div
              className="max-w-[90%] rounded-2xl rounded-tr-md bg-[linear-gradient(135deg,oklch(31%_0.035_215),oklch(38%_0.05_165))] px-4 py-3 text-sm font-medium text-white shadow-[0_12px_24px_-18px_rgba(15,23,42,0.5)]"
            >
              {message.content}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

