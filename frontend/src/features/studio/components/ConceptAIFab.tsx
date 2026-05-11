import { Sparkles } from "lucide-react"

type ConceptAIFabProps = {
  onOpen: () => void
}

export default function ConceptAIFab({ onOpen }: ConceptAIFabProps) {
  return (
    <button
      type="button"
      data-testid="concept-ai-fab"
      aria-label="AI 助手"
      onClick={onOpen}
      className="fixed bottom-6 right-6 z-50 flex h-14 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-transform hover:bg-slate-800 active:scale-95"
      title="打开 AI 助手"
    >
      <Sparkles className="h-4 w-4 text-teal-300" />
      <span>AI 助手</span>
    </button>
  )
}

