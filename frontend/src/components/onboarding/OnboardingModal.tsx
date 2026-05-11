import { useState } from "react"
import { Modal } from "@/components/ui/modal"
import { useAuthStore } from "@/stores/auth"
import { api, getApiErrorMessage } from "@/lib/api"
import { useNavigate } from "react-router-dom"
import {
  Sparkles,
  User,
  GraduationCap,
  Target,
  Zap,
  ChevronRight,
  ChevronLeft,
  Check
} from "lucide-react"

interface OnboardingModalProps {
  open: boolean
  onComplete: () => void
}

const LEARNING_STAGES = [
  { id: "beginner", label: "编程新手", desc: "刚开始接触编程，了解基础概念", icon: "🌱" },
  { id: "elementary", label: "有一定基础", desc: "掌握基础语法，能编写简单程序", icon: "🌿" },
  { id: "intermediate", label: "进阶学习者", desc: "熟悉常用数据结构与算法", icon: "🌳" },
  { id: "advanced", label: "专业开发者", desc: "有实际项目经验，追求精进", icon: "🚀" },
]

const LEARNING_GOALS = [
  { id: "job", label: "求职面试", desc: "准备技术面试，找到理想工作", icon: "💼" },
  { id: "academic", label: "学业需求", desc: "完成课程作业或学术研究", icon: "📚" },
  { id: "hobby", label: "兴趣爱好", desc: "探索编程乐趣，个人项目", icon: "🎮" },
  { id: "skill", label: "技能提升", desc: "提高工作效率，拓展技术栈", icon: "⚡" },
]

export default function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const setProfile = useAuthStore((s) => s.setProfile)

  const [step, setStep] = useState(0)
  const [nickname, setNickname] = useState("")
  const [learningStage, setLearningStage] = useState("")
  const [learningGoals, setLearningGoals] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleGoal = (goalId: string) => {
    setLearningGoals((prev) =>
      prev.includes(goalId)
        ? prev.filter((g) => g !== goalId)
        : [...prev, goalId]
    )
  }

  const handleSave = async () => {
    if (!profile?.user_id) return
    setSaving(true)
    setError(null)

    try {
      await api.put(`/api/profile`, {
        nickname,
        learning_stage: learningStage,
        learning_goals: learningGoals,
        onboarding_completed: true,
      }, { params: { user_id: profile.user_id } })

      // Update local profile
      setProfile({
        ...profile,
        portrait: {
          ...profile.portrait,
          nickname,
          learning_stage: learningStage,
          learning_goals: learningGoals.join(","),
          onboarding_completed: "true",
        },
      })

      onComplete()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleStartAssessment = () => {
    handleSave().then(() => {
      navigate("/app/assessment")
    })
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return nickname.trim().length >= 2
      case 2:
        return learningStage !== ""
      case 3:
        return learningGoals.length > 0
      default:
        return true
    }
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="text-center py-8">
            <div className="relative inline-block mb-6">
              <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-brand-green via-emerald-500 to-teal-500 flex items-center justify-center shadow-xl">
                <Sparkles className="h-12 w-12 text-white" />
              </div>
              <div className="absolute -bottom-2 -right-2 h-10 w-10 bg-brand-orange rounded-xl flex items-center justify-center shadow-lg animate-pulse">
                <Zap className="h-5 w-5 text-white" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">欢迎来到智辙 (A-Track)!</h2>
            <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
              AI 驱动的智能学习平台，为您量身定制学习路径。<br />
              让我们花一分钟了解您，开启个性化学习之旅。
            </p>
          </div>
        )

      case 1:
        return (
          <div className="py-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-blue to-indigo-500 flex items-center justify-center shadow-lg">
                <User className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">创建您的身份</h2>
                <p className="text-gray-500 text-sm">选择一个昵称，让学习更有归属感</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="输入您的昵称..."
                  maxLength={20}
                  className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-lg focus:ring-4 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  {nickname.length}/20
                </span>
              </div>
              <p className="text-xs text-gray-400 px-1">2-20个字符，可以是中英文或数字</p>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="py-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-green to-emerald-600 flex items-center justify-center shadow-lg">
                <GraduationCap className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">您的学习阶段</h2>
                <p className="text-gray-500 text-sm">帮助我们为您推荐合适难度的内容</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LEARNING_STAGES.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => setLearningStage(stage.id)}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                    learningStage === stage.id
                      ? "border-brand-green bg-brand-green-light"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-3xl">{stage.icon}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{stage.label}</div>
                    <div className="text-sm text-gray-500">{stage.desc}</div>
                  </div>
                  {learningStage === stage.id && (
                    <div className="h-6 w-6 rounded-full bg-brand-green flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )

      case 3:
        return (
          <div className="py-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-orange to-orange-600 flex items-center justify-center shadow-lg">
                <Target className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">学习目标</h2>
                <p className="text-gray-500 text-sm">可多选，让我们更好地理解您的需求</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {LEARNING_GOALS.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => toggleGoal(goal.id)}
                  className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all ${
                    learningGoals.includes(goal.id)
                      ? "border-brand-orange bg-brand-orange-light"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-3xl">{goal.icon}</span>
                  <div className="font-semibold text-gray-900 text-center">{goal.label}</div>
                  <div className="text-xs text-gray-500 text-center">{goal.desc}</div>
                  {learningGoals.includes(goal.id) && (
                    <div className="h-5 w-5 rounded-full bg-brand-orange flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )

      case 4:
        return (
          <div className="py-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Zap className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">能力测试</h2>
                <p className="text-gray-500 text-sm">快速评估您的编程水平</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 text-white mb-6">
              <h3 className="font-semibold text-lg mb-2">为什么要进行能力测试？</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-brand-green mt-0.5 flex-shrink-0" />
                  精准评估您的当前水平，避免重复学习
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-brand-green mt-0.5 flex-shrink-0" />
                  智能推荐最适合您的学习路径
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-brand-green mt-0.5 flex-shrink-0" />
                  识别薄弱环节，针对性提升
                </li>
              </ul>
              <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between">
                <span className="text-gray-400 text-sm">预计耗时</span>
                <span className="font-semibold">5-10 分钟</span>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="py-4 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50"
              >
                稍后测试
              </button>
              <button
                onClick={handleStartAssessment}
                disabled={saving}
                className="py-4 px-6 bg-gradient-to-r from-brand-green to-emerald-600 hover:from-brand-green-dark hover:to-emerald-700 text-white rounded-xl font-medium transition-all active:scale-95 shadow-lg disabled:opacity-50"
              >
                {saving ? "保存中..." : "立即测试"}
              </button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {}}
      showCloseButton={false}
      closeOnOverlayClick={false}
      className="w-full max-w-2xl mx-4"
      className="w-full max-w-lg mx-4 p-0 overflow-hidden"
    >
      <div className="flex flex-col max-h-[85vh]">
        {/* Progress indicator */}
        {step > 0 && step < 4 && (
          <div className="flex items-center justify-center gap-2 pt-6 mb-2 shrink-0">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${
                  s <= step ? "w-8 bg-brand-green" : "w-2 bg-gray-200"
                }`}
              />
            ))}
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-2 no-scrollbar">
          {renderStep()}
        </div>

        {/* Navigation - Fixed at bottom */}
        <div className="flex items-center justify-between px-6 py-6 border-t border-gray-100 shrink-0 bg-white rounded-b-2xl">
          {step > 0 && step < 4 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              上一步
            </button>
          ) : (
            <div />
          )}

          {step < 4 && (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-3 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {step === 0 ? "开始设置" : "下一步"}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
