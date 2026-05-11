import { useEffect, useState, useRef } from "react"
import { Brain, Sparkles, Zap } from "lucide-react"

interface QuestionGeneratingOverlayProps {
  title: string
  description?: string
}

const STATUS_MESSAGES = [
  "正在分析学习内容...",
  "AI 正在理解知识要点...",
  "正在生成针对性练习题...",
  "优化题目难度与质量...",
  "即将开始练习...",
]

export function QuestionGeneratingOverlay({
  title,
  description,
}: QuestionGeneratingOverlayProps) {
  const [msgIndex, setMsgIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const progressRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % STATUS_MESSAGES.length)
    }, 2400)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    progressRef.current = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 8 + 2, 92))
    }, 600)
    return () => clearInterval(progressRef.current)
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />

      {/* Animated glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-indigo-600/15 blur-[100px] animate-pulse" />
      <div
        className="absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full bg-purple-600/15 blur-[80px]"
        style={{ animation: "pulse 3s ease-in-out infinite 1s" }}
      />
      <div
        className="absolute top-1/2 left-1/2 w-40 h-40 rounded-full bg-emerald-500/10 blur-[60px]"
        style={{ animation: "pulse 4s ease-in-out infinite 0.5s" }}
      />

      {/* Floating particles */}
      <style>{`
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
        }
        @keyframes orbit {
          0% { transform: rotate(0deg) translateX(60px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(60px) rotate(-360deg); }
        }
        @keyframes msg-enter {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-indigo-400/40"
          style={{
            left: `${10 + Math.random() * 80}%`,
            bottom: "-5%",
            animation: `float-up ${6 + Math.random() * 8}s linear infinite ${Math.random() * 6}s`,
          }}
        />
      ))}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg">
        {/* Animated icon cluster */}
        <div className="relative w-28 h-28 mb-8">
          {/* Central brain icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 backdrop-blur-sm border border-white/10 flex items-center justify-center">
              <Brain className="h-10 w-10 text-indigo-400" />
            </div>
          </div>
          {/* Orbiting sparkle */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ animation: "orbit 4s linear infinite" }}
          >
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
          {/* Orbiting zap */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ animation: "orbit 5s linear infinite reverse" }}
          >
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          {/* Pulse ring */}
          <div className="absolute inset-0 rounded-2xl border-2 border-indigo-500/20 animate-ping" style={{ animationDuration: "2s" }} />
        </div>

        {/* Task title */}
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-slate-400 mb-6 line-clamp-2">
            {description}
          </p>
        )}

        {/* Progress bar */}
        <div className="w-full max-w-xs mb-5">
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 rounded-full transition-all duration-700 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>

        {/* Cycling status message */}
        <p
          key={msgIndex}
          className="text-sm text-slate-300 font-medium"
          style={{ animation: "msg-enter 0.4s ease-out" }}
        >
          {STATUS_MESSAGES[msgIndex]}
        </p>
      </div>
    </div>
  )
}
