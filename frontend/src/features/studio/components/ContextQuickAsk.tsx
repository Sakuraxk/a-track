import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"

import { Sparkles } from "lucide-react"

export const CONTEXT_QUICK_ASK_EVENT = "studio:context-quick-ask"

export type ContextQuickAskPayload = {
  selectedText: string
  sectionTitle: string
  taskId: string
  prompt: string
  /** 章节内容摘要（从 concept map + TOC 提炼） */
  chapterSummary?: string
  /** 当前章节标题 */
  chapterTitle?: string
  /** 当前学习学科 */
  subject?: string
}

type ContextQuickAskProps = {
  visible: boolean
  x: number
  y: number
  onAsk: () => void
  onDismiss: () => void
}

export default function ContextQuickAsk({
  visible,
  x,
  y,
  onAsk,
  onDismiss,
}: ContextQuickAskProps) {
  const popupRef = useRef<HTMLDivElement>(null)

  // 点击弹窗外部时关闭
  useEffect(() => {
    if (!visible) return
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onDismiss()
      }
    }
    // 延迟绑定，避免触发选中的 mouseup 立即关闭
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handler)
    }
  }, [visible, onDismiss])

  if (!visible) {
    return null
  }

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-[9999] animate-[slide-up_0.2s_ease-out] drop-shadow-xl"
      style={{ left: x, top: y, transform: "translate(-50%, 0)" }}
    >
      <button
        type="button"
        aria-label="快捷提问"
        className="flex items-center justify-center rounded-full border border-teal-200 bg-white/95 px-4 py-2 text-sm font-semibold text-teal-600 shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:bg-teal-50 active:scale-95"
        onClick={onAsk}
      >
        就这段提问
      </button>
    </div>,
    document.body
  )
}

