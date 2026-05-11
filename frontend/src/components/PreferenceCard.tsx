import { Brain } from "lucide-react"
import type { UserPreference } from "@/lib/api/userMemoryApi"

interface PreferenceCardProps {
    preference: UserPreference
}

export function PreferenceCard({ preference }: PreferenceCardProps) {
    const getPreferenceLabel = (key: string): string => {
        const labels: Record<string, string> = {
            learning_time_slot: "学习时段偏好",
            ai_tutor_role: "AI导师角色",
            difficulty_preference: "题目难度",
            exercise_type_preference: "题型偏好",
            pace_preference: "学习节奏"
        }
        return labels[key] || key
    }

    const getPreferenceValueLabel = (key: string, value: string): string => {
        const valueLabels: Record<string, Record<string, string>> = {
            learning_time_slot: {
                morning: "早上",
                afternoon: "下午",
                evening: "晚上",
                night: "深夜"
            },
            ai_tutor_role: {
                explainer: "讲解者",
                code_reviewer: "代码审查员",
                coder: "编程助手"
            },
            difficulty_preference: {
                easy: "简单",
                medium: "中等",
                hard: "困难"
            },
            pace_preference: {
                light: "轻量",
                medium: "中等",
                intense: "强化"
            }
        }
        return valueLabels[key]?.[value] || value
    }

    const confidencePercentage = Math.round(preference.confidence_score * 100)

    return (
        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-100 rounded-xl hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                        <div className="font-medium text-slate-900 text-sm">
                            {getPreferenceLabel(preference.preference_key)}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                            观察 {preference.evidence_count} 次
                        </div>
                    </div>
                </div>
                <div className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded-md">
                    {confidencePercentage}%
                </div>
            </div>

            <div className="mb-2">
                <div className="text-base font-semibold text-blue-700">
                    {getPreferenceValueLabel(preference.preference_key, preference.preference_value)}
                </div>
            </div>

            {/* Confidence bar */}
            <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                    style={{ width: `${confidencePercentage}%` }}
                />
            </div>
        </div>
    )
}
