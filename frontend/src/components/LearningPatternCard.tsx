import { Lightbulb, TrendingUp, TrendingDown, Clock, Target } from "lucide-react"
import type { LearningPattern } from "@/lib/api/userMemoryApi"

interface LearningPatternCardProps {
    pattern: LearningPattern
}

export function LearningPatternCard({ pattern }: LearningPatternCardProps) {
    const getPatternIcon = (type: string) => {
        switch (type) {
            case "time_pattern":
                return <Clock className="w-4 h-4" />
            case "strength_area":
                return <TrendingUp className="w-4 h-4" />
            case "weakness_area":
                return <TrendingDown className="w-4 h-4" />
            case "learning_speed":
                return <Target className="w-4 h-4" />
            default:
                return <Lightbulb className="w-4 h-4" />
        }
    }

    const getPatternTypeLabel = (type: string): string => {
        const labels: Record<string, string> = {
            time_pattern: "学习时间规律",
            error_pattern: "错误模式",
            strength_area: "强项领域",
            weakness_area: "弱项领域",
            learning_speed: "学习速度"
        }
        return labels[type] || type
    }

    const getPatternColor = (type: string): string => {
        switch (type) {
            case "strength_area":
                return "from-green-50 to-emerald-50 border-green-100"
            case "weakness_area":
                return "from-orange-50 to-red-50 border-orange-100"
            case "time_pattern":
                return "from-purple-50 to-pink-50 border-purple-100"
            case "learning_speed":
                return "from-cyan-50 to-blue-50 border-cyan-100"
            default:
                return "from-slate-50 to-gray-50 border-slate-100"
        }
    }

    const getIconColor = (type: string): string => {
        switch (type) {
            case "strength_area":
                return "text-green-600 bg-green-500/10"
            case "weakness_area":
                return "text-orange-600 bg-orange-500/10"
            case "time_pattern":
                return "text-purple-600 bg-purple-500/10"
            case "learning_speed":
                return "text-cyan-600 bg-cyan-500/10"
            default:
                return "text-slate-600 bg-slate-500/10"
        }
    }

    const confidencePercentage = Math.round(pattern.confidence * 100)

    return (
        <div className={`p-4 bg-gradient-to-br border-2 rounded-xl hover:shadow-md transition-shadow ${getPatternColor(pattern.pattern_type)}`}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getIconColor(pattern.pattern_type)}`}>
                        {getPatternIcon(pattern.pattern_type)}
                    </div>
                    <div>
                        <div className="font-medium text-slate-900 text-sm">
                            {getPatternTypeLabel(pattern.pattern_type)}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                            置信度: {confidencePercentage}%
                        </div>
                    </div>
                </div>
                <div className="px-2 py-1 bg-white/80 text-slate-600 text-xs font-medium rounded-md border border-slate-200">
                    {pattern.evidence_count} 个证据
                </div>
            </div>

            <div className="text-sm text-slate-700 leading-relaxed">
                {pattern.pattern_description}
            </div>

            {/* Additional data if available */}
            {pattern.pattern_data && Object.keys(pattern.pattern_data).length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/50">
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(pattern.pattern_data).slice(0, 3).map(([key, value]) => (
                            <div key={key} className="px-2 py-1 bg-white/60 rounded text-xs text-slate-600 border border-white">
                                <span className="font-medium">{key}:</span> {JSON.stringify(value)}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
