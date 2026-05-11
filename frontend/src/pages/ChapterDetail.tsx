import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { Icon } from "@/components/ui/Icon"
import { useRef } from "react"
import { useSubjectStore } from "@/stores/subject"

/**
 * 章节内容映射表：
 * key: `${subjectKey}-${chapterId}`
 * value: 对应 public/ 下 shifting.html 文件名（不含 .html）
 */
const CONTENT_MAP: Record<string, string> = {
  "machine_learning-ch1": "machine-learning-ch1",
  "machine_learning-ch2": "machine-learning-ch2",
  "machine_learning-ch3": "machine-learning-ch3",
  "machine_learning-ch4": "machine-learning-ch4",
  "machine_learning-ch5": "machine-learning-ch5",
  "python-ch1": "python-ch1",
  "python-ch2": "python-ch2",
  "python-ch3": "python-ch3",
  "python-ch4": "python-ch4",
  "python-ch5": "python-ch5",
}

export default function ChapterDetail() {
  const { courseId, chapterId } = useParams<{ courseId: string; chapterId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  const subjects = useSubjectStore((s) => s.subjects)
  const subject = subjects.find((sub) => sub.id === courseId)

  const contentKey = subject ? `${subject.key}-${chapterId}` : null
  const htmlFile = contentKey ? CONTENT_MAP[contentKey] : null

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
    } else {
      document.exitFullscreen()
    }
  }

  if (!htmlFile) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Icon icon="solar:sad-circle-bold-duotone" className="h-16 w-16 text-slate-300" />
        <p className="text-slate-500">本章内容正在建设中...</p>
        <button
          onClick={() => navigate(`/app/interactive-learning/${courseId}`)}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          返回课程详情
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50/50">
      {/* Header bar - 极简模式 */}
      <div className="flex items-center justify-between flex-shrink-0 p-3 bg-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/app/interactive-learning/${courseId}`)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 active:scale-95"
            title="返回课程目录"
          >
            <Icon icon="solar:arrow-left-linear" className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-sm font-black text-slate-900 font-display leading-tight">
              {subject?.name}
            </h1>
            <p className="text-[10px] font-medium text-slate-400">{chapterId?.toUpperCase()} · 交互式实验室</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/app/interactive-learning")}
            className="hidden sm:flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-500 transition-all hover:bg-slate-100"
          >
            <Icon icon="solar:clapperboard-edit-bold-duotone" className="h-3.5 w-3.5" />
            切换模块
          </button>
          <button
            onClick={toggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:text-slate-900"
            title="全屏模式"
          >
            <Icon icon="solar:full-screen-linear" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Frame container - 尽量全屏 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-white"
      >
        <iframe
          src={`/${htmlFile}.html${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
          className="h-full w-full border-0"
          title="Interactive Chapter Content"
          sandbox="allow-scripts allow-same-origin"
          allowFullScreen
        />
      </div>
    </div>
  )
}
