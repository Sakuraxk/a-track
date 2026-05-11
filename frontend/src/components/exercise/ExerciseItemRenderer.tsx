import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Lightbulb, Send, Code, FileText, List, PenLine, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import InlineLatex from "@/components/ui/InlineLatex"
import { XMarkdown } from "@ant-design/x-markdown"
import Latex from "@ant-design/x-markdown/plugins/Latex"
import "@ant-design/x-markdown/es/XMarkdown/index.css"

export type QuestionType = "mcq" | "fill_blank" | "short_answer" | "essay" | "coding"

export interface QuestionOption {
  label: string
  text: string
  is_correct?: boolean
}

export interface ExerciseQuestion {
  id: string
  question_type: QuestionType
  stem: string
  options?: QuestionOption[]
  answer_key?: unknown
  rubric?: string
  difficulty: number
  source_annotation: string
  hints?: string[]
}

export interface ScoringDimension {
  name: string
  score: number
  feedback: string
}

export interface ScoringResult {
  total_score: number
  dimensions: ScoringDimension[]
  overall_feedback: string
  strengths: string[]
  improvements: string[]
}

interface ExerciseItemRendererProps {
  question: ExerciseQuestion
  onSubmit: (answer: string) => Promise<{ correct?: boolean; score?: number; result?: ScoringResult }>
  showHints?: boolean
  disabled?: boolean
}

const TYPE_ICONS: Record<QuestionType, React.ReactNode> = {
  mcq: <List className="h-4 w-4" />,
  fill_blank: <PenLine className="h-4 w-4" />,
  short_answer: <FileText className="h-4 w-4" />,
  essay: <FileText className="h-4 w-4" />,
  coding: <Code className="h-4 w-4" />,
}

const TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "选择题",
  fill_blank: "填空题",
  short_answer: "简答题",
  essay: "论述题",
  coding: "编程题",
}

const DIFFICULTY_LABELS = ["入门", "基础", "中等", "进阶", "挑战"]

export function ExerciseItemRenderer({
  question,
  onSubmit,
  showHints = false,
  disabled = false,
}: ExerciseItemRendererProps) {
  const [answer, setAnswer] = useState("")
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ correct?: boolean; score?: number; result?: ScoringResult } | null>(null)
  const [showHintPanel, setShowHintPanel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when question changes
  useEffect(() => {
    setAnswer("")
    setSelectedOption(null)
    setResult(null)
    setShowHintPanel(false)
    setError(null)
  }, [question.id])

  const handleSubmit = async () => {
    if (isSubmitting || disabled) return

    const submitAnswer = question.question_type === "mcq" ? selectedOption || "" : answer
    if (!submitAnswer.trim()) return

    setIsSubmitting(true)
    setError(null)
    try {
      const res = await onSubmit(submitAnswer)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败，请重试")
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderMCQ = () => (
    <RadioGroup
      value={selectedOption || ""}
      onValueChange={setSelectedOption}
      disabled={disabled || !!result}
      className="space-y-3"
    >
      {question.options?.map((opt, idx) => (
        <div
          key={idx}
          className={cn(
            "flex items-center space-x-3 rounded-lg border p-4 transition-all cursor-pointer",
            selectedOption === opt.label && "border-primary bg-primary/5",
            result && opt.is_correct && "border-green-500 bg-green-50",
            result && selectedOption === opt.label && !opt.is_correct && "border-red-500 bg-red-50"
          )}
          onClick={() => !disabled && !result && setSelectedOption(opt.label)}
        >
          <RadioGroupItem value={opt.label} id={`opt-${idx}`} />
          <Label htmlFor={`opt-${idx}`} className="flex-1 cursor-pointer">
            <span className="font-medium mr-2">{opt.label}.</span>
            <InlineLatex text={opt.text} />
          </Label>
          {result && opt.is_correct && <CheckCircle className="h-5 w-5 text-green-500" />}
          {result && selectedOption === opt.label && !opt.is_correct && <XCircle className="h-5 w-5 text-red-500" />}
        </div>
      ))}
    </RadioGroup>
  )

  const renderFillBlank = () => (
    <div className="space-y-4">
      <div className="text-lg leading-relaxed prose prose-slate max-w-none">
        <XMarkdown content={question.stem} config={{ extensions: Latex() }} dompurifyConfig={{ ADD_ATTR: ['style'] }} />
      </div>
      <Input
        placeholder="请填写答案..."
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={disabled || !!result}
        className="text-lg"
      />
    </div>
  )

  const renderTextAnswer = () => (
    <div className="space-y-4">
      <Textarea
        placeholder={question.question_type === "essay" ? "请展开论述..." : "请简要回答..."}
        value={answer}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnswer(e.target.value)}
        disabled={disabled || !!result}
        rows={question.question_type === "essay" ? 10 : 5}
        className="resize-none"
      />
      {question.rubric && (
        <div className="text-sm text-muted-foreground bg-slate-50 p-3 rounded-lg">
          <span className="font-medium">评分标准: </span>
          {question.rubric}
        </div>
      )}
    </div>
  )

  const renderCoding = () => (
    <div className="space-y-4">
      <Textarea
        placeholder="# 在此编写代码..."
        value={answer}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnswer(e.target.value)}
        disabled={disabled || !!result}
        rows={12}
        className="font-mono text-sm resize-none bg-slate-900 text-slate-100"
      />
    </div>
  )

  const renderScoringResult = () => {
    if (!result?.result) return null
    const sr = result.result

    return (
      <div className="mt-4 space-y-4 border-t pt-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold">得分</span>
          <span className={cn(
            "text-2xl font-bold",
            sr.total_score >= 80 ? "text-green-600" : sr.total_score >= 60 ? "text-yellow-600" : "text-red-600"
          )}>
            {sr.total_score}分
          </span>
        </div>

        <div className="space-y-2">
          {sr.dimensions.map((dim, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span>{dim.name}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      dim.score >= 80 ? "bg-green-500" : dim.score >= 60 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
                <span className="w-8 text-right">{dim.score}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-sm text-muted-foreground">{sr.overall_feedback}</div>

        {sr.strengths.length > 0 && (
          <div className="text-sm">
            <span className="font-medium text-green-600">优点: </span>
            {sr.strengths.join("; ")}
          </div>
        )}

        {sr.improvements.length > 0 && (
          <div className="text-sm">
            <span className="font-medium text-yellow-600">改进建议: </span>
            {sr.improvements.join("; ")}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              {TYPE_ICONS[question.question_type]}
              {TYPE_LABELS[question.question_type]}
            </Badge>
            <Badge variant="secondary">
              {DIFFICULTY_LABELS[Math.min(question.difficulty - 1, 4)]}
            </Badge>
          </div>
          {question.source_annotation && (
            <span className="text-xs text-muted-foreground">{question.source_annotation}</span>
          )}
        </div>
        <CardTitle className="text-lg mt-3">
          {question.question_type !== "fill_blank" && (
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <XMarkdown content={question.stem} config={{ extensions: Latex() }} dompurifyConfig={{ ADD_ATTR: ['style'] }} />
            </div>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {question.question_type === "mcq" && renderMCQ()}
        {question.question_type === "fill_blank" && renderFillBlank()}
        {(question.question_type === "short_answer" || question.question_type === "essay") && renderTextAnswer()}
        {question.question_type === "coding" && renderCoding()}

        {result && question.question_type === "mcq" && (
          <div className={cn(
            "mt-4 p-3 rounded-lg",
            result.correct ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          )}>
            {result.correct ? "回答正确！" : "回答错误，请查看正确答案。"}
          </div>
        )}

        {renderScoringResult()}

        {result && question.answer_key !== undefined && (
          <div className="mt-4 p-3 rounded-lg bg-indigo-50 border border-indigo-200">
            <div className="flex items-center gap-1.5 text-sm font-medium text-indigo-700 mb-1">
              <Lightbulb className="h-4 w-4" />
              参考答案
            </div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap">
              {typeof question.answer_key === "object" && question.answer_key !== null && !Array.isArray(question.answer_key) && "code" in (question.answer_key as Record<string, unknown>)
                ? <pre className="font-mono bg-slate-900 text-slate-100 p-2 rounded text-xs overflow-x-auto">{(question.answer_key as Record<string, string>).code}</pre>
                : Array.isArray(question.answer_key)
                  ? (question.answer_key as string[]).join("、")
                  : String(question.answer_key)
              }
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {showHints && question.hints && question.hints.length > 0 && (
          <div className="mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHintPanel(!showHintPanel)}
              className="gap-1 text-muted-foreground"
            >
              <Lightbulb className="h-4 w-4" />
              {showHintPanel ? "隐藏提示" : "查看提示"}
            </Button>
            {showHintPanel && (
              <div className="mt-2 p-3 bg-yellow-50 rounded-lg text-sm">
                {question.hints.map((hint, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-yellow-600">•</span>
                    <span>{hint}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button
          onClick={handleSubmit}
          disabled={
            disabled ||
            isSubmitting ||
            !!result ||
            (question.question_type === "mcq" ? !selectedOption : !answer.trim())
          }
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {isSubmitting ? "提交中..." : "提交答案"}
        </Button>
      </CardFooter>
    </Card>
  )
}
