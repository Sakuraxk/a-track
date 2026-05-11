import { Send, StopCircle } from "lucide-react"

type ChatComposerProps = {
  value: string
  isStreaming: boolean
  disabled?: boolean
  placeholder?: string
  quickPrompts?: string[]
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
}

export default function ChatComposer({
  value,
  isStreaming,
  disabled = false,
  placeholder = "在此输入您的问题...",
  quickPrompts = [],
  onChange,
  onSend,
  onStop,
}: ChatComposerProps) {
  const isSendDisabled = disabled || isStreaming || !value.trim()

  return (
    <div className="space-y-3">
      {quickPrompts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={disabled || isStreaming}
              onClick={() => onChange(prompt)}
              className="whitespace-nowrap rounded-full border border-slate-200/80 bg-slate-50 px-3.5 py-1.5 text-[11px] font-medium text-slate-600 transition-all hover:border-emerald-200 hover:bg-emerald-50/70 hover:text-emerald-700 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,white,oklch(99%_0.004_220))]">
        <textarea
          rows={1}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              if (!isSendDisabled) {
                onSend()
              }
            }
          }}
          className="w-full resize-none bg-transparent py-3.5 pl-4 pr-14 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="absolute bottom-2.5 right-2.5">
          {isStreaming ? (
            <button
              type="button"
              aria-label="停止生成"
              onClick={onStop}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-500 transition-all hover:bg-rose-100"
            >
              <StopCircle className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="发送消息"
              disabled={isSendDisabled}
              onClick={onSend}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,oklch(31%_0.035_215),oklch(38%_0.05_165))] text-white transition-all hover:brightness-105 disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
