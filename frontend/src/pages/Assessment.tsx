import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, XCircle, ArrowRight, Trophy, BookOpen, Target } from "lucide-react"

import { api, getApiErrorMessage } from "@/lib/api"
import type { AssessmentStartResponse, AssessmentResultResponse, AssessmentQuestion } from "@/lib/backendTypes"
import { useAuthStore } from "@/stores/auth"

type AssessmentPhase = "intro" | "questions" | "result"

export default function Assessment() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const setProfile = useAuthStore((s) => s.setProfile)

  const [phase, setPhase] = useState<AssessmentPhase>("intro")
  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [result, setResult] = useState<AssessmentResultResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentQuestion = questions[currentIndex]
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0

  const startAssessment = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<AssessmentStartResponse>("/api/diagnostics/assessment")
      setAssessmentId(res.data.assessment_id)
      setQuestions(res.data.questions)
      setPhase("questions")
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSelectOption = (optionIndex: number) => {
    if (showExplanation) return
    setSelectedOption(optionIndex)
  }

  const handleConfirmAnswer = () => {
    if (selectedOption === null || !currentQuestion) return

    // Save answer
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: selectedOption }))
    setShowExplanation(true)
  }

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setSelectedOption(null)
      setShowExplanation(false)
    } else {
      submitAssessment()
    }
  }

  const submitAssessment = async () => {
    if (!assessmentId || !profile?.user_id) return

    setLoading(true)
    setError(null)
    try {
      const finalAnswers = { ...answers }
      if (currentQuestion && selectedOption !== null) {
        finalAnswers[currentQuestion.id] = selectedOption
      }

      const res = await api.post<AssessmentResultResponse>(
        `/api/diagnostics/${profile.user_id}/submit`,
        {
          assessment_id: assessmentId,
          answers: finalAnswers
        }
      )
      setResult(res.data)

      // Update user profile with new ability tags
      if (res.data.ability_tags && Object.keys(res.data.ability_tags).length > 0) {
        const updatedProfile = {
          ...profile,
          ability_tags: { ...profile.ability_tags, ...res.data.ability_tags }
        }
        setProfile(updatedProfile)
      }

      setPhase("result")
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const getDifficultyLabel = (difficulty: number) => {
    switch (difficulty) {
      case 1: return "基础"
      case 2: return "入门"
      case 3: return "中级"
      case 4: return "进阶"
      case 5: return "高级"
      default: return "未知"
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case "入门": return "text-blue-600"
      case "初级": return "text-green-600"
      case "中级": return "text-yellow-600"
      case "进阶": return "text-orange-600"
      default: return "text-gray-600"
    }
  }

  // Intro Phase
  if (phase === "intro") {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-lg w-full shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-4">
              <Target className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Python 水平评估</CardTitle>
            <CardDescription className="text-base mt-2">
              完成一个简短的测试，帮助我们了解你的编程基础，
              <br />为你定制个性化的学习计划
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="text-2xl font-bold text-emerald-600">10</div>
                <div className="text-sm text-slate-500">道题目</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="text-2xl font-bold text-emerald-600">15</div>
                <div className="text-sm text-slate-500">分钟左右</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="text-2xl font-bold text-emerald-600">4</div>
                <div className="text-sm text-slate-500">大类别</div>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-600">
              <p>评估内容包括：</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500">
                <li>Python 基础语法</li>
                <li>条件判断与循环</li>
                <li>列表、字典等数据结构</li>
                <li>函数定义与使用</li>
              </ul>
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            <Button
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white py-6 text-lg"
              onClick={startAssessment}
              disabled={loading}
            >
              {loading ? "准备中..." : "开始评估"}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/app/dashboard")}
            >
              跳过，稍后评估
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Questions Phase
  if (phase === "questions" && currentQuestion) {
    const isCorrect = selectedOption === currentQuestion.correct_answer

    return (
      <div className="py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Progress Header */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              第 {currentIndex + 1} / {questions.length} 题
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
                {currentQuestion.category} · {getDifficultyLabel(currentQuestion.difficulty)}
              </span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />

          {/* Question Card */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-lg font-medium leading-relaxed">
                {currentQuestion.question}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                let optionStyle = "border-2 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"

                if (showExplanation) {
                  if (index === currentQuestion.correct_answer) {
                    optionStyle = "border-2 border-green-500 bg-green-50"
                  } else if (index === selectedOption && index !== currentQuestion.correct_answer) {
                    optionStyle = "border-2 border-red-500 bg-red-50"
                  } else {
                    optionStyle = "border-2 border-slate-100 bg-slate-50 opacity-60"
                  }
                } else if (selectedOption === index) {
                  optionStyle = "border-2 border-emerald-500 bg-emerald-50"
                }

                return (
                  <button
                    key={index}
                    className={`w-full text-left p-4 rounded-xl transition-all ${optionStyle}`}
                    onClick={() => handleSelectOption(index)}
                    disabled={showExplanation}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="flex-1">{option}</span>
                      {showExplanation && index === currentQuestion.correct_answer && (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      )}
                      {showExplanation && index === selectedOption && index !== currentQuestion.correct_answer && (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  </button>
                )
              })}

              {/* Explanation */}
              {showExplanation && (
                <div className={`mt-4 p-4 rounded-xl ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <BookOpen className="w-5 h-5 text-amber-600" />
                    )}
                    <span className={`font-medium ${isCorrect ? 'text-green-700' : 'text-amber-700'}`}>
                      {isCorrect ? "回答正确！" : "答案解析"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{currentQuestion.explanation}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            {!showExplanation ? (
              <Button
                onClick={handleConfirmAnswer}
                disabled={selectedOption === null}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                确认答案
              </Button>
            ) : (
              <Button
                onClick={handleNextQuestion}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? "提交中..." : currentIndex < questions.length - 1 ? (
                  <>下一题 <ArrowRight className="w-4 h-4 ml-1" /></>
                ) : (
                  "查看结果"
                )}
              </Button>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Result Phase
  if (phase === "result" && result) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-lg w-full shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mb-4">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-2xl">评估完成！</CardTitle>
            <CardDescription className="text-lg mt-2">
              {result.result.summary}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {/* Score Display */}
            <div className="text-center py-6 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl">
              <div className="text-5xl font-bold text-emerald-600">{result.result.total_score}</div>
              <div className="text-slate-500 mt-1">总分</div>
              <div className={`text-2xl font-semibold mt-2 ${getLevelColor(result.result.level)}`}>
                {result.result.level}水平
              </div>
            </div>

            {/* Ability Tags */}
            <div className="space-y-3">
              <h3 className="font-medium text-slate-700">能力分析</h3>
              <div className="space-y-2">
                {Object.entries(result.ability_tags).map(([tag, score]) => (
                  <div key={tag} className="flex items-center gap-3">
                    <span className="w-20 text-sm text-slate-600">{tag}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-700 w-10 text-right">{score}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-3">
              <h3 className="font-medium text-slate-700">学习建议</h3>
              <ul className="space-y-2">
                {result.result.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            {/* Next Steps */}
            <div className="space-y-3">
              <h3 className="font-medium text-slate-700">下一步</h3>
              <div className="space-y-2">
                {result.next_steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg text-sm">
                    <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </span>
                    {step}
                  </div>
                ))}
              </div>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white py-6 text-lg"
              onClick={() => navigate("/app/dashboard")}
            >
              开始学习
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
