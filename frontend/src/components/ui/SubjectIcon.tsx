import { Icon } from "@/components/ui/Icon"
import { Subject } from "@/stores/subject"

/**
 * Enhanced subject icon map with technology-specific logos and
 * carefully curated icons from multiple Iconify icon sets.
 *
 * Each entry defines:
 *  - icon:  Iconify icon name (logos, devicon, carbon, ph, tabler, etc.)
 *  - color: Tailwind text-color for the icon
 *  - bg:    Tailwind gradient stops for the background container
 */
export const SUBJECT_ICON_MAP: Record<string, { icon: string; color: string; bg: string; gradient: string }> = {
  // ── Technology / Programming ──────────────────────────────────
  python:           { icon: "logos:python",                     color: "text-[#3776AB]",    bg: "bg-blue-50 dark:bg-blue-950/40",      gradient: "from-blue-400/20 to-sky-400/20" },
  programming:      { icon: "ph:code-bold",                      color: "text-violet-500",   bg: "bg-violet-50 dark:bg-violet-950/40",  gradient: "from-violet-400/20 to-purple-400/20" },
  cs:               { icon: "ph:monitor-bold",                   color: "text-indigo-500",   bg: "bg-indigo-50 dark:bg-indigo-950/40",  gradient: "from-indigo-400/20 to-blue-400/20" },
  machine_learning: { icon: "custom-robot",                     color: "text-purple-500",   bg: "bg-purple-50 dark:bg-purple-950/40",  gradient: "from-purple-400/20 to-indigo-400/20" },
  ai:               { icon: "carbon:machine-learning-model",     color: "text-violet-500",   bg: "bg-violet-50 dark:bg-violet-950/40",  gradient: "from-violet-400/20 to-indigo-400/20" },
  database:         { icon: "ph:database-bold",                  color: "text-teal-500",     bg: "bg-teal-50 dark:bg-teal-950/40",      gradient: "from-teal-400/20 to-emerald-400/20" },
  cloud:            { icon: "ph:cloud-bold",                     color: "text-sky-500",      bg: "bg-sky-50 dark:bg-sky-950/40",        gradient: "from-sky-400/20 to-blue-400/20" },

  // ── Sciences ──────────────────────────────────────────────────
  math:         { icon: "tabler:math-integral-x",            color: "text-blue-600",     bg: "bg-blue-50 dark:bg-blue-950/40",      gradient: "from-blue-400/20 to-indigo-400/20" },
  physics:      { icon: "ph:atom-bold",                      color: "text-cyan-500",     bg: "bg-cyan-50 dark:bg-cyan-950/40",      gradient: "from-cyan-400/20 to-sky-400/20" },
  chemistry:    { icon: "ph:flask-bold",                     color: "text-emerald-500",  bg: "bg-emerald-50 dark:bg-emerald-950/40", gradient: "from-emerald-400/20 to-green-400/20" },
  biology:      { icon: "ph:dna-bold",                       color: "text-lime-500",     bg: "bg-lime-50 dark:bg-lime-950/40",      gradient: "from-lime-400/20 to-green-400/20" },
  logic:        { icon: "ph:brain-bold",                     color: "text-yellow-500",   bg: "bg-yellow-50 dark:bg-yellow-950/40",  gradient: "from-yellow-400/20 to-amber-400/20" },

  // ── Humanities / Languages ────────────────────────────────────
  english:          { icon: "ph:translate-bold",                 color: "text-rose-500",     bg: "bg-rose-50 dark:bg-rose-950/40",      gradient: "from-rose-400/20 to-pink-400/20" },
  literature:       { icon: "ph:pen-nib-bold",                   color: "text-orange-500",   bg: "bg-orange-50 dark:bg-orange-950/40",  gradient: "from-orange-400/20 to-amber-400/20" },
  history:          { icon: "ph:scroll-bold",                    color: "text-amber-500",    bg: "bg-amber-50 dark:bg-amber-950/40",    gradient: "from-amber-400/20 to-yellow-400/20" },

  // ── Aliases for seeded subject keys ────────────────────────────
  advanced_math:    { icon: "tabler:math-integral-x",            color: "text-blue-600",     bg: "bg-blue-50 dark:bg-blue-950/40",      gradient: "from-blue-400/20 to-indigo-400/20" },
  probability:      { icon: "ph:chart-line-bold",                 color: "text-violet-600",   bg: "bg-violet-50 dark:bg-violet-950/40",  gradient: "from-violet-400/20 to-purple-400/20" },
  linear_algebra:   { icon: "custom-matrix",            color: "text-indigo-600",   bg: "bg-indigo-50 dark:bg-indigo-950/40",  gradient: "from-indigo-400/20 to-blue-400/20" },
  statistics:       { icon: "custom-bell-curve",                 color: "text-teal-600",     bg: "bg-teal-50 dark:bg-teal-950/40",      gradient: "from-teal-400/20 to-cyan-400/20" },
  ai_literacy:      { icon: "custom-watson",                     color: "text-cyan-600",     bg: "bg-cyan-50 dark:bg-cyan-950/40",      gradient: "from-cyan-400/20 to-violet-400/20" },
}

/**
 * Extended keyword → map-key resolver for current seeded subjects +
 * any future subjects that could be added.
 */
const NAME_KEYWORD_MAP: [string[], string][] = [
  // Python
  [["python"],                                                                          "python"],

  // ML
  [["machine", "learning", "ml", "neural"],                                             "machine_learning"],
  // Math
  [["math"],                                                                            "math"],

  // Generic programming
  [["编程", "代码", "开发", "java", "c++", "框架", "coding"],                             "programming"],
  // CS / Web
  [["前端", "后端", "web", "服务器", "架构"],                                             "cs"],
  // Physics
  [["物理", "physics", "力学", "电磁"],                                                  "physics"],
  // Chemistry
  [["化学", "chemistry"],                                                                "chemistry"],
  // History
  [["历史", "history"],                                                                  "history"],
  // Logic
  [["逻辑", "logic"],                                                                    "logic"],
  // AI / ML (secondary)
  [["ai"],                                                                               "ai"],
  // AI Literacy
  [["通识", "素养", "literacy"],                                                           "ai_literacy"],
  // Probability
  [["概率", "probability", "随机", "贝叶斯"],                                               "probability"],
  // Linear Algebra
  [["线性代数", "矩阵", "向量空间", "行列式"],                                               "linear_algebra"],
  // Statistics
  [["统计", "statistics", "回归", "假设检验"],                                               "statistics"],
  // Database
  [["数据", "sql", "分析", "database"],                                                  "database"],
  // Cloud
  [["云", "网络", "cloud"],                                                              "cloud"],
  // Biology
  [["生物", "biology"],                                                                  "biology"],
]

const FALLBACK_STYLES = [
  { icon: "ph:notebook-bold",      color: "text-slate-500",   gradient: "from-slate-400/20 to-gray-400/20" },
  { icon: "ph:folder-open-bold",   color: "text-indigo-500",  gradient: "from-indigo-400/20 to-blue-400/20" },
  { icon: "ph:cube-bold",          color: "text-emerald-500", gradient: "from-emerald-400/20 to-teal-400/20" },
  { icon: "ph:certificate-bold",   color: "text-rose-500",    gradient: "from-rose-400/20 to-pink-400/20" },
  { icon: "ph:stack-bold",         color: "text-sky-500",     gradient: "from-sky-400/20 to-blue-400/20" },
  { icon: "ph:archive-bold",       color: "text-amber-500",   gradient: "from-amber-400/20 to-yellow-400/20" },
  { icon: "ph:clipboard-text-bold",color: "text-violet-500",  gradient: "from-violet-400/20 to-purple-400/20" },
  { icon: "ph:books-bold",         color: "text-emerald-500", gradient: "from-emerald-400/20 to-teal-400/20" },
]

// ─── Component ────────────────────────────────────────────────

interface SubjectIconProps {
  subject?: Subject
  className?: string
  /** Show the gradient background container (default: true) */
  showBackground?: boolean
  fallbackIcon?: string
}

export function SubjectIcon({
  subject,
  className = "w-10 h-10",
  showBackground = true,
  fallbackIcon = "ph:notebook-bold",
}: SubjectIconProps) {
  // 1. Try exact key match
  let mapData = subject?.key ? SUBJECT_ICON_MAP[subject.key.toLowerCase()] : undefined

  // 2. Try keyword matching against subject name
  if (!mapData && subject?.name) {
    const nameStr = subject.name.toLowerCase()
    for (const [keywords, mapKey] of NAME_KEYWORD_MAP) {
      if (keywords.some(k => nameStr.includes(k))) {
        mapData = SUBJECT_ICON_MAP[mapKey]
        break
      }
    }
  }

  // 3. Deterministic fallback based on ID / name hash
  let resolvedIcon = mapData?.icon ?? fallbackIcon
  let resolvedColor = mapData?.color ?? "text-slate-600"
  let resolvedGradient = mapData?.gradient ?? "from-slate-400/20 to-gray-400/20"

  if (!mapData) {
    const seed = subject?.id || subject?.name || "default"
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash)
    }
    const idx = Math.abs(hash) % FALLBACK_STYLES.length
    const fb = FALLBACK_STYLES[idx]
    resolvedIcon = fb.icon
    resolvedColor = fb.color
    resolvedGradient = fb.gradient
  }

  if (!showBackground) {
    return (
      <div className={`flex items-center justify-center ${className} ${resolvedColor}`}>
        {resolvedIcon === "custom-robot" ? (
          <img src="/robot-icon.svg" alt="Machine Learning" className="w-full h-full object-contain" />
        ) : resolvedIcon === "custom-watson" ? (
          <img src="/watson-icon.svg" alt="AI Literacy" className="w-full h-full object-contain" />
        ) : resolvedIcon === "custom-matrix" ? (
          <img src="/research-matrix.svg" alt="Linear Algebra" className="w-full h-full object-contain" />
        ) : resolvedIcon === "custom-bell-curve" ? (
          <img src="/bell-curve.svg" alt="Statistics" className="w-full h-full object-contain" />
        ) : (
          <Icon icon={resolvedIcon} className="w-full h-full" />
        )}
      </div>
    )
  }

  // Render with premium gradient background container
  return (
    <div
      className={`relative flex items-center justify-center rounded-2xl ${className} overflow-hidden group/icon`}
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${resolvedGradient} transition-opacity group-hover/icon:opacity-80`} />
      {/* Subtle glow ring */}
      <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]" />
      {/* Icon */}
      <div className={`relative z-10 flex items-center justify-center w-[60%] h-[60%] ${resolvedColor} transition-transform duration-300 group-hover/icon:scale-110`}>
        {resolvedIcon === "custom-robot" ? (
          <img src="/robot-icon.svg" alt="Machine Learning" className="w-full h-full object-contain drop-shadow-sm" />
        ) : resolvedIcon === "custom-watson" ? (
          <img src="/watson-icon.svg" alt="AI Literacy" className="w-full h-full object-contain drop-shadow-sm" />
        ) : resolvedIcon === "custom-matrix" ? (
          <img src="/research-matrix.svg" alt="Linear Algebra" className="w-full h-full object-contain drop-shadow-sm" />
        ) : resolvedIcon === "custom-bell-curve" ? (
          <img src="/bell-curve.svg" alt="Statistics" className="w-full h-full object-contain drop-shadow-sm" />
        ) : (
          <Icon icon={resolvedIcon} className="w-full h-full" />
        )}
      </div>
    </div>
  )
}
