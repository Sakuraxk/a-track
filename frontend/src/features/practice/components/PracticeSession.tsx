import { useState, useCallback, useMemo, useEffect, useRef, type Dispatch, type SetStateAction } from "react"
import {
  CheckCircle2, Loader2, XCircle, Play, Terminal,
  ArrowLeft, Settings, BookOpen, Sparkles,
} from "lucide-react"
import Editor from "@monaco-editor/react"
import { XMarkdown } from "@ant-design/x-markdown"
import Latex from "@ant-design/x-markdown/plugins/Latex"
import "@ant-design/x-markdown/es/XMarkdown/index.css"
import "@/styles/x-markdown-overrides.css"
import InlineLatex from "@/components/ui/InlineLatex"
import { cn } from "@/lib/utils"
import { useChatStore } from "@/stores/chat"
import { PracticeHeader } from "./PracticeHeader"
import { PracticeAIPanel } from "./PracticeAIPanel"
import { DragHandle } from "./DragHandle"

interface Option { label: string; text: string; is_correct?: boolean }
type QuestionType = "mcq" | "coding" | "fill_blank" | "short_answer" | "essay"

interface Question {
  id: string; question_type: QuestionType; stem: string
  options?: Option[] | null; answer_key?: unknown; hints?: string[] | null
  difficulty: number; initial_code?: string; expected_output?: string; test_cases?: unknown
}

const QUESTION_TYPE_SET = new Set<QuestionType>([
  "mcq",
  "fill_blank",
  "short_answer",
  "essay",
  "coding",
])
const STREAMING_STATUS_MESSAGES = [
  "连接 AI 判题服务",
  "读取题干与参考答案",
  "对照你的回答",
  "整理评分依据",
  "生成陪伴式反馈",
]

function normalizeAnswerValues(answerKey: unknown): string[] {
  if (Array.isArray(answerKey)) {
    return answerKey
      .flatMap((value) => typeof value === "string" ? value.split(/[,\n，、/]+/) : [])
      .map((value) => value.trim())
      .filter(Boolean)
  }

  if (typeof answerKey === "string") {
    return answerKey
      .split(/[,\n，、/]+/)
      .map((value) => value.trim())
      .filter(Boolean)
  }

  return []
}

function extractInlineOptions(stem: string, answerKey: unknown): { stem: string; options?: Option[] } {
  const markerRegex = /(^|\s)([A-H])[\.\u3001]\s*/g
  const matches: Array<{ label: string; start: number; contentStart: number }> = []

  for (const match of stem.matchAll(markerRegex)) {
    const prefix = match[1] ?? ""
    const label = match[2]
    const start = (match.index ?? 0) + prefix.length
    const contentStart = start + label.length + 2
    matches.push({ label, start, contentStart })
  }

  if (matches.length < 2) return { stem }

  const answerValues = normalizeAnswerValues(answerKey)
  const optionTexts = matches.map((marker, index) => {
    const nextStart = matches[index + 1]?.start ?? stem.length
    const text = stem.slice(marker.contentStart, nextStart).trim()
    return {
      label: marker.label,
      text,
      is_correct: answerValues.length > 0
        ? answerValues.includes(marker.label) || answerValues.includes(text)
        : undefined,
    }
  }).filter((option) => option.text.length > 0)

  if (optionTexts.length < 2) return { stem }

  return {
    stem: stem.slice(0, matches[0].start).trim(),
    options: optionTexts,
  }
}

function normalizeOptions(rawOptions: unknown, answerKey: unknown): Option[] | undefined {
  if (!Array.isArray(rawOptions) || rawOptions.length === 0) return undefined

  const answerValues = normalizeAnswerValues(answerKey)

  return rawOptions
    .map((rawOption, index): Option | null => {
      const fallbackLabel = String.fromCharCode(65 + index)

      if (typeof rawOption === "string") {
        const isCorrect = answerValues.length > 0
            ? answerValues.includes(fallbackLabel) || answerValues.includes(rawOption)
            : undefined;
        const result: Option = { label: fallbackLabel, text: rawOption };
        if (isCorrect !== undefined) result.is_correct = isCorrect;
        return result;
      }

      if (!rawOption || typeof rawOption !== "object") return null

      const option = rawOption as Partial<Option>
      const label = typeof option.label === "string" && option.label.trim() ? option.label.trim() : fallbackLabel
      const text = typeof option.text === "string" && option.text.trim() ? option.text : label
      const isCorrect = typeof option.is_correct === "boolean"
        ? option.is_correct
        : answerValues.length > 0
          ? answerValues.includes(label) || answerValues.includes(text)
          : undefined

      const result: Option = { label, text };
      if (isCorrect !== undefined) result.is_correct = isCorrect;
      return result;
    })
    .filter((option): option is Option => option !== null && Boolean(option.text))
}

function isMultipleChoiceQuestion(question: Pick<Question, "question_type" | "answer_key" | "options" | "stem">): boolean {
  if (question.question_type !== "mcq") return false
  const answerValues = normalizeAnswerValues(question.answer_key)
  const correctCount = question.options?.filter((option) => option.is_correct).length ?? 0
  return answerValues.length > 1
    || correctCount > 1
    || /选择所有|多选|所有会导致|所有正确|所有错误/.test(question.stem)
}

function normalizeQuestion(question: Question): Question {
  const inlineOptionResult = !question.options || question.options.length === 0
    ? extractInlineOptions(question.stem, question.answer_key)
    : { stem: question.stem, options: undefined }
  const normalizedOptions = normalizeOptions(question.options ?? inlineOptionResult.options, question.answer_key)
  const answerPayload = question.answer_key && typeof question.answer_key === "object" && !Array.isArray(question.answer_key)
    ? question.answer_key as Record<string, unknown>
    : null

  const initialCode = question.initial_code
    ?? (typeof answerPayload?.initial_code === "string" ? answerPayload.initial_code : undefined)
    ?? (typeof answerPayload?.code === "string" ? answerPayload.code : undefined)
  const expectedOutput = question.expected_output
    ?? (typeof answerPayload?.expected_output === "string" ? answerPayload.expected_output : undefined)

  let normalizedType: QuestionType = QUESTION_TYPE_SET.has(question.question_type)
    ? question.question_type
    : "short_answer"

  if (normalizedOptions?.length) {
    normalizedType = "mcq"
  } else if (/_{3,}/.test(question.stem)) {
    normalizedType = "fill_blank"
  } else if (initialCode || expectedOutput || Array.isArray(question.test_cases)) {
    normalizedType = "coding"
  } else if (normalizedType === "fill_blank") {
    normalizedType = "short_answer"
  } else if (normalizedType === "mcq") {
    normalizedType = "short_answer"
  }

  return {
    ...question,
    stem: inlineOptionResult.stem,
    question_type: normalizedType,
    options: normalizedOptions,
    initial_code: initialCode,
    expected_output: expectedOutput,
  }
}

interface ExplanationData {
  success: boolean; explanation?: string | null; key_points?: string[] | null
  similar_examples?: string[] | null; error?: string | null
}

interface SessionResult {
  totalQuestions: number; correctCount: number; wrongCount: number
  answers: { questionId: string; isCorrect: boolean | null; response?: unknown }[]
}

interface GradingDimension {
  name: string
  score: number
  feedback: string
}

interface GradingDetail {
  total_score?: number
  strengths?: string[]
  improvements?: string[]
  dimensions?: GradingDimension[]
}

interface GradingEvent {
  type: "start" | "grading_step" | "result" | "done" | "error"
  content?: string
}

interface BackendResult {
  is_correct: boolean | null
  feedback?: string
  score?: number | null
  scoring_method?: string | null
  grading_detail?: GradingDetail | null
  grading_trace?: string[]
}

interface PracticeSessionProps {
  questions: Question[]; onExit: () => void
  onComplete: (results: SessionResult) => void
  onGetExplanation?: (questionId: string) => Promise<ExplanationData | null>
  onSubmitToBackend?: (questionId: string, answer: unknown, onGradingEvent?: (event: GradingEvent) => void) => Promise<BackendResult>
  onGetHint?: (questionId: string, hintLevel: number) => Promise<{ hint_text: string } | null>
  onRunCode?: (code: string) => Promise<{ success: boolean; output: string; error: string | null; execution_time_ms: number }>
}

const DEFAULT_CODE = "# 在这里编写你的代码\n\n"
const MIN_PANEL_WIDTH = 280

export function PracticeSession({
  questions, onExit, onComplete, onGetExplanation, onSubmitToBackend, onGetHint, onRunCode,
}: PracticeSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [isChecked, setIsChecked] = useState(false)
  const [streak, setStreak] = useState(0)
  const [results, setResults] = useState<{ questionId: string; isCorrect: boolean | null; response?: unknown }[]>([])

  // Draft answers map: saves unsubmitted answers when navigating away
  const draftAnswers = useRef<Map<string, { code?: string; text?: string; blanks?: string[]; selected?: string[] }>>(new Map())

  const [codeAnswer, setCodeAnswer] = useState(DEFAULT_CODE)
  const [blankAnswers, setBlankAnswers] = useState<string[]>([])
  const [textAnswer, setTextAnswer] = useState("")

  const [backendResult, setBackendResult] = useState<BackendResult | null>(null)
  const [gradingEvents, setGradingEvents] = useState<GradingEvent[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [codeOutput, setCodeOutput] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [isRunningCode, setIsRunningCode] = useState(false)
  const [codeExecTime, setCodeExecTime] = useState<number | null>(null)

  const [explanation, setExplanation] = useState<ExplanationData | null>(null)
  const [isExplanationLoading, setIsExplanationLoading] = useState(false)
  const explanationCache = useRef<Map<string, ExplanationData>>(new Map())
  const currentQuestionIdRef = useRef<string | null>(null)

  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const setHideGlobalButton = useChatStore((s) => s.setHideGlobalButton)

  // Panel widths for drag
  const containerRef = useRef<HTMLDivElement>(null)
  const [leftFraction, setLeftFraction] = useState(0.25)
  const [rightFraction, setRightFraction] = useState(0.25)

  useEffect(() => {
    setHideGlobalButton(true)
    return () => setHideGlobalButton(false)
  }, [setHideGlobalButton])

  const normalizedQuestions = useMemo(
    () => questions.map((question) => normalizeQuestion(question)),
    [questions],
  )

  const currentQ = normalizedQuestions[currentIndex]
  const isLastQuestion = currentIndex === normalizedQuestions.length - 1

  useEffect(() => { currentQuestionIdRef.current = currentQ?.id ?? null }, [currentQ?.id])

  const blankParts = useMemo(() => {
    if (!currentQ || currentQ.question_type !== "fill_blank") return []
    return currentQ.stem.split(/_{3,}/)
  }, [currentQ])
  const blanksCount = Math.max(0, blankParts.length - 1)

  const wordCount = useMemo(() => {
    const t = textAnswer.trim()
    return t ? t.split(/\s+/).filter(Boolean).length : 0
  }, [textAnswer])

  const canSubmit = (() => {
    switch (currentQ?.question_type) {
      case "mcq":
        return selectedOptions.length > 0
      case "coding":
        return codeAnswer.trim().length > 0
      case "fill_blank":
        return blanksCount > 0
          && blankAnswers.length === blanksCount
          && blankAnswers.every((v) => v.trim().length > 0)
      case "short_answer":
      case "essay":
        return textAnswer.trim().length > 0
      default:
        return false
    }
  })()

  useEffect(() => {
    const q = normalizedQuestions[currentIndex]
    if (!q) return

    const pastResult = results.find(r => r.questionId === q.id)
    const draft = draftAnswers.current.get(q.id)

    if (pastResult) {
      if (q.question_type === "mcq") {
        const resp = pastResult.response as string | string[] | undefined
        const restoredSelected = Array.isArray(resp) ? resp : (resp ? [resp] : [])
        setSelectedOptions(restoredSelected)
        setIsChecked(true)
        setBackendResult(null)
        setGradingEvents([])
      } else {
        setSelectedOptions([]); setIsChecked(false)
        setBackendResult({ is_correct: pastResult.isCorrect ?? null })
        setGradingEvents([])
        // Restore submitted answer content for non-MCQ questions
        const resp = pastResult.response
        if (q.question_type === "coding" && typeof resp === "string") {
          setCodeAnswer(resp)
        } else if (q.question_type === "fill_blank" && Array.isArray(resp)) {
          setBlankAnswers(resp as string[])
        } else if ((q.question_type === "short_answer" || q.question_type === "essay") && typeof resp === "string") {
          setTextAnswer(resp)
        }
      }
    } else if (draft) {
      // Restore draft (unsubmitted) answers
      setSelectedOptions(draft.selected ?? []); setIsChecked(false); setBackendResult(null); setGradingEvents([])
      if (q.question_type === "coding" && draft.code !== undefined) {
        setCodeAnswer(draft.code)
      } else {
        setCodeAnswer(q.initial_code ?? DEFAULT_CODE)
      }
      if (q.question_type === "fill_blank" && draft.blanks !== undefined) {
        setBlankAnswers(draft.blanks)
      } else {
        const count = q.question_type === "fill_blank" ? Math.max(0, q.stem.split(/_{3,}/).length - 1) : 0
        setBlankAnswers(Array.from({ length: count }, () => ""))
      }
      setTextAnswer(draft.text ?? "")
    } else {
      setSelectedOptions([]); setIsChecked(false); setBackendResult(null); setGradingEvents([])
      setCodeAnswer(q.initial_code ?? DEFAULT_CODE)
      setTextAnswer("")
      const count = q.question_type === "fill_blank" ? Math.max(0, q.stem.split(/_{3,}/).length - 1) : 0
      setBlankAnswers(Array.from({ length: count }, () => ""))
    }

    setIsSubmitting(false); setSubmitError(null)
    setExplanation(explanationCache.current.get(q.id) ?? null)
    setIsExplanationLoading(false)
    setCodeOutput(null); setCodeError(null)
    setIsRunningCode(false); setCodeExecTime(null)
  }, [currentIndex, normalizedQuestions]) // Omit results to avoid re-running on submit

  const upsertResult = useCallback((questionId: string, isCorrect: boolean | null, response?: unknown) => {
    setResults((prev) => {
      const idx = prev.findIndex((r) => r.questionId === questionId)
      const entry = { questionId, isCorrect, response }
      if (idx === -1) return [...prev, entry]
      const next = [...prev]; next[idx] = entry; return next
    })
  }, [])

  const handleMcqSubmit = useCallback(() => {
    if (!currentQ || selectedOptions.length === 0) return
    const correctLabels = currentQ.options?.filter((o) => o.is_correct).map((o) => o.label) ?? []
    const expectedLabels = correctLabels.length > 0 ? correctLabels : normalizeAnswerValues(currentQ.answer_key)
    const submittedLabels = [...selectedOptions].sort()
    const isMultiple = isMultipleChoiceQuestion(currentQ)
    const isCorrect = isMultiple
      ? expectedLabels.length > 0
        && submittedLabels.length === expectedLabels.length
        && submittedLabels.every((label, index) => label === [...expectedLabels].sort()[index])
      : expectedLabels[0] === submittedLabels[0]
    setIsChecked(true)
    upsertResult(currentQ.id, Boolean(isCorrect), isMultiple ? submittedLabels : submittedLabels[0])
    setStreak((s) => (isCorrect ? s + 1 : 0))
  }, [currentQ, selectedOptions, upsertResult])

  const handleBackendSubmit = useCallback(async () => {
    if (!currentQ || !onSubmitToBackend) { setSubmitError("暂未配置提交接口"); return }
    setSubmitError(null)
    let answer: unknown
    switch (currentQ.question_type) {
      case "coding": answer = codeAnswer; break
      case "fill_blank": answer = blankAnswers; break
      case "short_answer": case "essay": answer = textAnswer.trim(); break
      default: return
    }
    setIsSubmitting(true)
    setGradingEvents([
      { type: "start", content: "已提交答案，准备判题。" },
      { type: "grading_step", content: "正在连接 AI 判题服务，对照参考答案生成评分摘要。" },
    ])
    try {
      const resp = await onSubmitToBackend(currentQ.id, answer, (event) => {
        if (event.type === "start" || event.type === "grading_step" || event.type === "error") {
          setGradingEvents((prev) => {
            if (event.content && prev.some((item) => item.content === event.content)) return prev
            return [...prev, event]
          })
        }
      })
      if (resp.grading_trace?.length) {
        setGradingEvents((prev) => {
          const seen = new Set(prev.map((event) => event.content).filter(Boolean))
          const traceEvents = resp.grading_trace
            ?.filter((step) => !seen.has(step))
            .map((step) => ({ type: "grading_step" as const, content: step })) ?? []
          return [...prev, ...traceEvents]
        })
      }
      setBackendResult(resp)
      upsertResult(currentQ.id, resp.is_correct ?? null, answer)
      // Clear draft since the answer has been submitted
      draftAnswers.current.delete(currentQ.id)
      setStreak((s) => (resp.is_correct === true ? s + 1 : 0))
    } catch { setSubmitError("提交失败，请稍后重试") }
    finally { setIsSubmitting(false) }
  }, [currentQ, onSubmitToBackend, codeAnswer, blankAnswers, textAnswer, upsertResult])

  const handleSubmit = useCallback(() => {
    if (!currentQ) return
    if (!canSubmit) {
      setSubmitError("请先完成作答")
      return
    }
    if (currentQ.question_type === "mcq") handleMcqSubmit()
    else void handleBackendSubmit()
  }, [canSubmit, currentQ, handleMcqSubmit, handleBackendSubmit])

  // Save the current question's draft answers before navigating away
  const saveDraft = useCallback(() => {
    if (!currentQ) return
    // Don't save draft if already submitted
    const alreadySubmitted = results.some(r => r.questionId === currentQ.id)
    if (alreadySubmitted) return
    draftAnswers.current.set(currentQ.id, {
      code: codeAnswer,
      text: textAnswer,
      blanks: [...blankAnswers],
      selected: [...selectedOptions],
    })
  }, [currentQ, codeAnswer, textAnswer, blankAnswers, selectedOptions, results])

  const handleNext = useCallback(() => {
    if (!currentQ) return
    saveDraft()
    if (isLastQuestion) {
      const isCurrentCorrect: boolean | null =
        currentQ.question_type === "mcq"
          ? (() => {
              const correctLabels = currentQ.options?.filter((o) => o.is_correct).map((o) => o.label) ?? []
              const expectedLabels = correctLabels.length > 0 ? correctLabels : normalizeAnswerValues(currentQ.answer_key)
              const submittedLabels = [...selectedOptions].sort()
              const isMultiple = isMultipleChoiceQuestion(currentQ)
              return isMultiple
                ? expectedLabels.length > 0
                  && submittedLabels.length === expectedLabels.length
                  && submittedLabels.every((label, index) => label === [...expectedLabels].sort()[index])
                : expectedLabels[0] === submittedLabels[0]
            })()
          : backendResult?.is_correct ?? null
      // Build response for the current question
      let currentResponse: unknown
      if (currentQ.question_type === "mcq") {
        currentResponse = isMultipleChoiceQuestion(currentQ) ? selectedOptions : selectedOptions[0]
      } else if (currentQ.question_type === "coding") {
        currentResponse = codeAnswer
      } else if (currentQ.question_type === "fill_blank") {
        currentResponse = blankAnswers
      } else {
        currentResponse = textAnswer.trim()
      }
      const finalResults = results.some((r) => r.questionId === currentQ.id)
        ? results
        : [...results, {
            questionId: currentQ.id,
            isCorrect: isCurrentCorrect,
            response: currentResponse,
          }]
      const correctCount = finalResults.filter((r) => r.isCorrect === true).length
      const wrongCount = finalResults.filter((r) => r.isCorrect === false).length
      onComplete({ totalQuestions: normalizedQuestions.length, correctCount, wrongCount, answers: finalResults })
    } else { setCurrentIndex((i) => i + 1) }
  }, [isLastQuestion, results, normalizedQuestions.length, onComplete, currentQ, selectedOptions, backendResult, saveDraft, codeAnswer, textAnswer, blankAnswers])

  const handlePrev = useCallback(() => {
    saveDraft()
    setCurrentIndex((i) => Math.max(0, i - 1))
  }, [saveDraft])

  const handleRunCodeLocal = useCallback(async () => {
    if (!onRunCode || !codeAnswer.trim()) return
    setIsRunningCode(true); setCodeOutput(null); setCodeError(null); setCodeExecTime(null)
    try {
      const resp = await onRunCode(codeAnswer)
      setCodeOutput(resp.output || ""); setCodeError(resp.error || null); setCodeExecTime(resp.execution_time_ms)
    } catch { setCodeError("代码运行请求失败，请稍后重试") }
    finally { setIsRunningCode(false) }
  }, [onRunCode, codeAnswer])

  const handleGetExplanation = useCallback(async () => {
    if (!currentQ || !onGetExplanation) return
    const targetId = currentQ.id
    setIsExplanationLoading(true)
    try {
      const resp = await onGetExplanation(targetId)
      if (currentQuestionIdRef.current !== targetId) return
      if (resp === null) setExplanation({ success: false, error: "讲解请求失败" })
      else if (resp.success) { setExplanation(resp); explanationCache.current.set(targetId, resp) }
      else setExplanation({ success: false, error: resp.error || "讲解生成失败" })
    } catch { if (currentQuestionIdRef.current === targetId) setExplanation({ success: false, error: "讲解请求异常" }) }
    finally { if (currentQuestionIdRef.current === targetId) setIsExplanationLoading(false) }
  }, [currentQ, onGetExplanation])

  const handleDrag = useCallback((deltaX: number) => {
    if (!containerRef.current) return
    const totalW = containerRef.current.offsetWidth
    if (totalW <= 0) return
    setLeftFraction((prev) => {
      const maxLeft = 1 - rightFraction - MIN_PANEL_WIDTH / totalW
      const newPx = prev * totalW + deltaX
      const clamped = Math.max(MIN_PANEL_WIDTH / totalW, Math.min(maxLeft, newPx / totalW))
      return clamped
    })
  }, [rightFraction])

  const handleRightDrag = useCallback((deltaX: number) => {
    if (!containerRef.current) return
    const totalW = containerRef.current.offsetWidth
    if (totalW <= 0) return
    setRightFraction((prev) => {
      const maxRight = 1 - leftFraction - MIN_PANEL_WIDTH / totalW
      const newPx = prev * totalW - deltaX
      const clamped = Math.max(MIN_PANEL_WIDTH / totalW, Math.min(maxRight, newPx / totalW))
      return clamped
    })
  }, [leftFraction])

  if (!currentQ) return null

  const isSubmitted = currentQ.question_type === "mcq" ? isChecked : backendResult !== null
  const isCoding = currentQ.question_type === "coding"

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Slim icon sidebar */}
      <PracticeSidebar
        onExit={onExit}
        aiActive={!panelCollapsed}
        onToggleAI={() => setPanelCollapsed(!panelCollapsed)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <PracticeHeader
          currentIndex={currentIndex}
          totalCount={normalizedQuestions.length}
          questionType={currentQ.question_type}
          streak={streak}
        />

        <main ref={containerRef} className="flex-1 flex overflow-hidden p-1.5 gap-1.5">
          {/* Main content container (Left + Middle + Footer) */}
          <div
            className="flex-1 flex flex-col min-w-0"
            style={{ width: isCoding ? `${leftFraction * 100}%` : undefined }}
          >
            <div className="flex-1 flex overflow-hidden gap-1.5 min-h-0">
              {/* Left panel: question content */}
              <section
                style={{ width: isCoding ? `${(leftFraction / (leftFraction + rightFraction || 1)) * 100}%` : undefined }}
                className={cn(
                  "flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden",
                  !isCoding && "flex-1",
                )}
              >
            <div className="flex-1 overflow-y-auto p-6 md:p-8 min-h-0">
              <div className="pb-10 min-h-0">
                <StemRenderer
                  question={currentQ}
                  blanksCount={blanksCount}
                  blankAnswers={blankAnswers}
                  setBlankAnswers={setBlankAnswers}
                  disabled={isSubmitted || isSubmitting}
                />

                {!isCoding && (
                  <div className="mt-8">
                    <AnswerArea
                      question={currentQ} selectedOptions={selectedOptions} setSelectedOptions={setSelectedOptions}
                      isChecked={isChecked}
                      textAnswer={textAnswer} setTextAnswer={setTextAnswer} wordCount={wordCount}
                      isSubmitted={isSubmitted} isSubmitting={isSubmitting}
                    />
                    {submitError && currentQ.question_type !== "mcq" && (
                      <div className="mt-4 p-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">{submitError}</div>
                    )}
                    {currentQ.question_type !== "mcq" && gradingEvents.length > 0 && (
                      <GradingStreamPanel events={gradingEvents} isSubmitting={isSubmitting} />
                    )}
                    {backendResult && currentQ.question_type !== "mcq" && <ResultFeedback result={backendResult} answerKey={currentQ.answer_key} />}
                    {isChecked && currentQ.question_type === "mcq" && currentQ.answer_key !== undefined && (
                      <AnswerKeyDisplay answerKey={currentQ.answer_key} />
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {isCoding && <DragHandle onDrag={handleDrag} />}

          {/* Middle panel: code editor (coding only) */}
          {isCoding ? (
            <section
              style={{ width: `${(1 - leftFraction - (panelCollapsed ? 0 : rightFraction)) * 100}%` }}
              className="flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-w-0"
            >
              <CodingEditor
                codeAnswer={codeAnswer} setCodeAnswer={setCodeAnswer}
                isSubmitted={isSubmitted} isSubmitting={isSubmitting}
                onRunCode={onRunCode ? handleRunCodeLocal : undefined}
                isRunningCode={isRunningCode}
                codeOutput={codeOutput} codeError={codeError} codeExecTime={codeExecTime}
                expectedOutput={currentQ.expected_output}
              />
              {submitError && (
                <div className="mx-4 mb-4 p-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">{submitError}</div>
              )}
              {gradingEvents.length > 0 && (
                <div className="px-4 pb-4"><GradingStreamPanel events={gradingEvents} isSubmitting={isSubmitting} /></div>
              )}
              {backendResult && <div className="px-4 pb-4"><ResultFeedback result={backendResult} answerKey={currentQ.answer_key} /></div>}
            </section>
          ) : null}
            </div>

            {/* 题目导航栏 - 始终显示在内容区下方，不跨越 AI 区域 */}
            <div
              data-testid="practice-next-footer"
              className="mt-1.5 flex-shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-6 py-3 flex justify-between items-center z-20 shadow-sm"
            >
              <button
                type="button"
                onClick={handlePrev}
                disabled={isSubmitting || currentIndex === 0}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-6 py-2 text-sm font-bold transition",
                  currentIndex === 0
                    ? "opacity-0 pointer-events-none"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                )}
              >
                上一题
              </button>
              {(() => {
                const primaryDisabled = isSubmitting || (!isSubmitted && !canSubmit)
                const primaryLabel = isSubmitting
                  ? "提交中"
                  : !isSubmitted
                    ? "提交答案"
                    : isLastQuestion
                      ? "查看结果"
                      : "下一题"
                const primaryAction = isSubmitted ? handleNext : handleSubmit
                return (
                  <button
                    type="button"
                    onClick={primaryAction}
                    disabled={primaryDisabled}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-7 py-2 text-sm font-medium text-white ring-1 ring-slate-900/5 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:ring-slate-100/10 dark:hover:bg-white"
                  >
                    {isSubmitting && <Loader2 size={14} className="animate-spin" strokeWidth={2} />}
                    {primaryLabel}
                  </button>
                )
              })()}
            </div>
          </div>

          {/* Right drag handle (between code editor and AI panel) */}
          {isCoding && !panelCollapsed && <DragHandle onDrag={handleRightDrag} />}

          {/* AI Panel */}
          {!panelCollapsed && isCoding ? (
            <section style={{ width: `${rightFraction * 100}%` }} className="flex-shrink-0 h-full min-w-0">
              <PracticeAIPanel
                currentQuestion={currentQ}
                explanation={explanation}
                isExplanationLoading={isExplanationLoading}
                onGetExplanation={handleGetExplanation}
                onGetHint={onGetHint}
                collapsed={false}
                onToggleCollapse={() => setPanelCollapsed(true)}
              />
            </section>
          ) : !panelCollapsed ? (
            <section className="w-[380px] flex-shrink-0 h-full min-w-0">
              <PracticeAIPanel
                currentQuestion={currentQ}
                explanation={explanation}
                isExplanationLoading={isExplanationLoading}
                onGetExplanation={handleGetExplanation}
                onGetHint={onGetHint}
                collapsed={false}
                onToggleCollapse={() => setPanelCollapsed(true)}
              />
            </section>
          ) : null}
        </main>
      </div>
    </div>
  )
}

/* ─── Sub-components ─── */

function PracticeSidebar({ onExit, aiActive, onToggleAI }: {
  onExit: () => void; aiActive: boolean; onToggleAI: () => void
}) {
  return (
    <aside className="z-20 flex w-14 flex-shrink-0 flex-col items-center border-r border-slate-200 bg-white py-4 dark:border-slate-800 dark:bg-slate-900">
      <button
        onClick={onExit}
        title="返回题库"
        className="rounded-xl p-2.5 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <ArrowLeft size={18} strokeWidth={1.8} />
      </button>
      <div className="mt-6 flex flex-1 flex-col items-center gap-3">
        <button
          onClick={onToggleAI}
          title="AI 助教"
          aria-pressed={aiActive}
          className={cn(
            "relative rounded-xl p-2.5 transition-all",
            aiActive
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "text-slate-500 hover:bg-[oklch(97%_0.022_165)] hover:text-[oklch(36%_0.1_165)] dark:hover:bg-[oklch(22%_0.035_165)] dark:hover:text-[oklch(82%_0.08_165)]",
          )}
        >
          <Sparkles size={18} strokeWidth={1.8} />
        </button>
      </div>
      <button
        title="设置"
        className="rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <Settings size={18} strokeWidth={1.8} />
      </button>
    </aside>
  )
}

const BLANK_MARKER_PREFIX = "BLANK_PLACEHOLDER_"

function BlankInput({ idx, blankAnswersRef, setBlankAnswers, disabled }: {
  idx: number
  blankAnswersRef: React.RefObject<string[]>
  setBlankAnswers: React.Dispatch<React.SetStateAction<string[]>>
  disabled: boolean
}) {
  // Use local state to keep the input controlled without causing parent re-render via XMarkdown
  const [localValue, setLocalValue] = useState(blankAnswersRef.current?.[idx] || "")

  // Sync from parent when blankAnswersRef changes (e.g. question switch)
  useEffect(() => {
    setLocalValue(blankAnswersRef.current?.[idx] || "")
  }, [blankAnswersRef, idx])

  return (
    <input
      aria-label={`填空 ${idx + 1}`}
      value={localValue}
      onChange={(e) => {
        const val = e.target.value
        setLocalValue(val)
        setBlankAnswers((prev) => { const next = [...prev]; next[idx] = val; return next })
      }}
      disabled={disabled}
      className="mx-1 inline-block min-w-[80px] max-w-[200px] border-b-2 border-[oklch(72%_0.06_165)] bg-transparent px-2 py-1 text-center font-medium text-slate-900 transition-colors focus:border-[oklch(55%_0.11_165)] focus:outline-none dark:border-[oklch(45%_0.08_165)] dark:text-slate-100"
    />
  )
}

function StemRenderer({ question, blanksCount, blankAnswers, setBlankAnswers, disabled }: {
  question: Question; blanksCount: number
  blankAnswers: string[]; setBlankAnswers: React.Dispatch<React.SetStateAction<string[]>>; disabled: boolean
}) {
  // Keep a ref to the latest blankAnswers so the memoized components can read current values
  const blankAnswersRef = useRef(blankAnswers)
  blankAnswersRef.current = blankAnswers

  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  const stemWithMarkers = useMemo(() => {
    if (question.question_type !== "fill_blank" || blanksCount <= 0) return null
    let markerIndex = 0
    return question.stem.replace(/_{3,}/g, () => {
      return `\`${BLANK_MARKER_PREFIX}${markerIndex++}\``
    })
  }, [question.stem, question.question_type, blanksCount])

  // Memoize the components object so XMarkdown doesn't re-render on every keystroke
  const blankComponents = useMemo<Record<string, React.ComponentType<any>>>(() => ({
    code: ({ children, ...props }: React.ComponentPropsWithoutRef<"code"> & { children?: React.ReactNode }) => {
      const text = typeof children === "string" ? children : ""
      if (text.startsWith(BLANK_MARKER_PREFIX)) {
        const idx = parseInt(text.slice(BLANK_MARKER_PREFIX.length), 10)
        if (!isNaN(idx) && idx < blanksCount) {
          return (
            <BlankInput
              idx={idx}
              blankAnswersRef={blankAnswersRef}
              setBlankAnswers={setBlankAnswers}
              disabled={disabledRef.current}
            />
          )
        }
      }
      return <code {...props}>{children}</code>
    },
  }), [blanksCount, setBlankAnswers])

  if (stemWithMarkers) {
    return (
      <div className="text-base leading-relaxed text-slate-900 dark:text-slate-100 prose dark:prose-invert max-w-none">
        <XMarkdown
          content={stemWithMarkers.replace(/^\s*(练习模式|专注练习模式)\s*\n*/, "").trim()}
          components={blankComponents}
          config={{ extensions: Latex() }}
          dompurifyConfig={{ ADD_ATTR: ['style'] }}
          openLinksInNewTab
        />
      </div>
    )
  }
  return (
    <div className="text-base leading-relaxed text-slate-900 dark:text-slate-100 prose dark:prose-invert max-w-none">
      <XMarkdown
        content={question.stem.replace(/^\s*(练习模式|专注练习模式)\s*\n*/, "").trim()}
        config={{ extensions: Latex() }}
        dompurifyConfig={{ ADD_ATTR: ['style'] }}
        openLinksInNewTab
      />
    </div>
  )
}

function AnswerArea({ question, selectedOptions, setSelectedOptions, isChecked, textAnswer, setTextAnswer, wordCount, isSubmitted, isSubmitting }: {
  question: Question; selectedOptions: string[]; setSelectedOptions: Dispatch<SetStateAction<string[]>>
  isChecked: boolean
  textAnswer: string; setTextAnswer: (v: string) => void; wordCount: number
  isSubmitted: boolean; isSubmitting: boolean
}) {
  const disabled = isSubmitted || isSubmitting

  if (question.question_type === "mcq") {
    const isMultiple = isMultipleChoiceQuestion(question)
    return (
      <div className="space-y-3">
        {question.options?.map((opt) => {
          const isSelected = selectedOptions.includes(opt.label)
          const showCorrect = isChecked && opt.is_correct
          const showWrong = isChecked && isSelected && !opt.is_correct
          return (
            <button
              key={opt.label}
              onClick={() => {
                if (isChecked) return
                setSelectedOptions((prev) => {
                  if (isMultiple) {
                    return prev.includes(opt.label)
                      ? prev.filter((label) => label !== opt.label)
                      : [...prev, opt.label]
                  }
                  return [opt.label]
                })
              }}
              disabled={isChecked}
              className={cn(
                "group flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all duration-200",
                showCorrect && "border-[oklch(55%_0.11_165)] bg-[oklch(97%_0.022_165)] dark:bg-[oklch(22%_0.035_165)]",
                showWrong && "border-[oklch(63%_0.14_25)] bg-[oklch(97%_0.022_25)] dark:bg-[oklch(22%_0.035_25)]",
                !isChecked && isSelected && "border-[oklch(55%_0.11_165)] bg-[oklch(97%_0.022_165)] dark:bg-[oklch(22%_0.035_165)]",
                !isChecked && !isSelected && "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600",
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-sm font-medium",
                  isSelected ? "border-[oklch(55%_0.11_165)] text-[oklch(36%_0.1_165)] dark:text-[oklch(82%_0.08_165)]" : "border-slate-300 text-slate-500 dark:border-slate-600",
                )}>{opt.label}</div>
                <span className="text-slate-700 dark:text-slate-300"><InlineLatex text={opt.text} /></span>
              </div>
              {showCorrect && <CheckCircle2 className="text-[oklch(55%_0.11_165)]" size={20} strokeWidth={1.8} />}
              {showWrong && <XCircle className="text-[oklch(63%_0.14_25)]" size={20} strokeWidth={1.8} />}
            </button>
          )
        })}
      </div>
    )
  }

  if (question.question_type === "fill_blank") return null

  const isEssay = question.question_type === "essay"
  return (
    <div className="space-y-2">
      <textarea
        rows={isEssay ? 8 : 4}
        value={textAnswer}
        disabled={disabled}
        onChange={(e) => setTextAnswer(e.target.value)}
        placeholder={isEssay ? "请输入你的完整论述..." : "请输入你的答案..."}
        className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition-shadow focus:outline-none focus:ring-2 focus:ring-[oklch(55%_0.11_165)]/30 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100"
      />
      <div className="text-xs text-slate-400 text-right">
        {isEssay ? `${wordCount} 词 · ${textAnswer.length} 字` : `${textAnswer.length} 字`}
      </div>
    </div>
  )
}

function CodingEditor({ codeAnswer, setCodeAnswer, isSubmitted, isSubmitting, onRunCode, isRunningCode, codeOutput, codeError, codeExecTime, expectedOutput }: {
  codeAnswer: string; setCodeAnswer: (v: string) => void
  isSubmitted: boolean; isSubmitting: boolean
  onRunCode?: () => void; isRunningCode?: boolean
  codeOutput?: string | null; codeError?: string | null; codeExecTime?: number | null
  expectedOutput?: string
}) {
  const disabled = isSubmitted || isSubmitting
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <span className="font-mono font-medium">Python 3.10</span>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-[10px]">在下方编写你的答案</span>
          {onRunCode && (
            <button
              onClick={onRunCode}
              disabled={isRunningCode || !codeAnswer.trim()}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 disabled:opacity-50 text-white text-xs font-medium transition-colors"
            >
              {isRunningCode ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {isRunningCode ? "运行中..." : "运行代码"}
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="python"
          theme="vs"
          value={codeAnswer}
          onChange={(v) => setCodeAnswer(v || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "JetBrains Mono, Menlo, Monaco, Courier New, monospace",
            scrollBeyondLastLine: false,
            padding: { top: 16 },
            readOnly: disabled,
          }}
        />
      </div>

      {(codeOutput !== null && codeOutput !== undefined) || codeError ? (
        <div className="border-t border-slate-200 dark:border-slate-700">
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Terminal size={14} /> 运行结果
            </div>
            {codeExecTime !== null && codeExecTime !== undefined && (
              <span className="text-[10px] text-slate-400">{codeExecTime}ms</span>
            )}
          </div>
          {codeError ? (
            <pre className="max-h-36 overflow-auto whitespace-pre-wrap bg-red-50 p-4 font-mono text-sm text-red-700 dark:bg-red-900/20 dark:text-red-200">
              {codeError}
            </pre>
          ) : (
            <pre className="max-h-36 overflow-auto whitespace-pre-wrap bg-slate-50 p-4 font-mono text-sm text-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {codeOutput || "(无输出)"}
            </pre>
          )}
        </div>
      ) : null}

      {expectedOutput && (
        <div className="mx-4 mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <div className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">预期输出提示</div>
          <pre className="text-sm text-amber-900 dark:text-amber-200 font-mono whitespace-pre-wrap">{String(expectedOutput)}</pre>
        </div>
      )}
    </div>
  )
}

function formatAnswerKey(answerKey: unknown): string {
  if (answerKey === null || answerKey === undefined) return ""
  if (typeof answerKey === "string") return answerKey
  if (Array.isArray(answerKey)) return answerKey.map((v) => String(v)).join("、")
  if (typeof answerKey === "object") {
    const obj = answerKey as Record<string, unknown>
    if ("code" in obj && typeof obj.code === "string") return obj.code
    try { return JSON.stringify(answerKey, null, 2) } catch { return String(answerKey) }
  }
  return String(answerKey)
}

function AnswerKeyDisplay({ answerKey }: { answerKey: unknown }) {
  const formatted = formatAnswerKey(answerKey)
  if (!formatted) return null

  const isCodeBlock = typeof answerKey === "object" && answerKey !== null && !Array.isArray(answerKey) && "code" in (answerKey as Record<string, unknown>)

  return (
    <div className="mt-4 rounded-xl border border-[oklch(90%_0.03_165)] bg-[oklch(97%_0.018_165)] p-4 dark:border-[oklch(30%_0.05_165)] dark:bg-[oklch(22%_0.035_165)]">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[oklch(36%_0.08_165)] dark:text-[oklch(82%_0.08_165)]">
        <BookOpen size={16} strokeWidth={1.8} />
        <span>参考答案</span>
      </div>
      {isCodeBlock ? (
        <pre className="text-sm font-mono bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">{formatted}</pre>
      ) : (
        <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed prose prose-sm prose-slate dark:prose-invert max-w-none">
          <XMarkdown content={formatted} config={{ extensions: Latex() }} dompurifyConfig={{ ADD_ATTR: ['style'] }} />
        </div>
      )}
    </div>
  )
}

function AnimatedStreamingLabel({ active }: { active: boolean }) {
  const [frame, setFrame] = useState({
    messageIndex: 0,
    visibleCount: active ? 0 : STREAMING_STATUS_MESSAGES[0].length,
    dotCount: 0,
    holdCount: 0,
  })

  useEffect(() => {
    if (!active) {
      setFrame({
        messageIndex: STREAMING_STATUS_MESSAGES.length - 1,
        visibleCount: STREAMING_STATUS_MESSAGES[STREAMING_STATUS_MESSAGES.length - 1].length,
        dotCount: 0,
        holdCount: 0,
      })
      return
    }
    setFrame({ messageIndex: 0, visibleCount: 0, dotCount: 0, holdCount: 0 })
    const timer = window.setInterval(() => {
      setFrame((prev) => {
        const currentMessage = STREAMING_STATUS_MESSAGES[prev.messageIndex]
        if (prev.visibleCount < currentMessage.length) {
          return { ...prev, visibleCount: prev.visibleCount + 1 }
        }
        if (prev.dotCount < 3) {
          return { ...prev, dotCount: prev.dotCount + 1 }
        }
        if (prev.holdCount < 20) {
          return { ...prev, holdCount: prev.holdCount + 1 }
        }
        return {
          messageIndex: (prev.messageIndex + 1) % STREAMING_STATUS_MESSAGES.length,
          visibleCount: 0,
          dotCount: 0,
          holdCount: 0,
        }
      })
    }, 60)
    return () => window.clearInterval(timer)
  }, [active])

  return (
    <span className="inline-flex min-w-[8.5rem] items-center">
      <span>
        {STREAMING_STATUS_MESSAGES[frame.messageIndex].slice(0, frame.visibleCount)}
        {".".repeat(frame.dotCount)}
      </span>
      {active && <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse rounded-full bg-current/80" />}
    </span>
  )
}

function StreamingStepText({ text, active }: { text: string; active: boolean }) {
  const [visibleCount, setVisibleCount] = useState(active ? 0 : text.length)

  useEffect(() => {
    if (!active) {
      setVisibleCount(text.length)
      return
    }
    setVisibleCount(0)
    const timer = window.setInterval(() => {
      setVisibleCount((prev) => {
        if (prev >= text.length) {
          window.clearInterval(timer)
          return text.length
        }
        return prev + 1
      })
    }, 72)

    return () => window.clearInterval(timer)
  }, [text, active])

  const visibleText = text.slice(0, visibleCount)

  return (
    <span className="inline-flex items-center">
      <span>{visibleText}</span>
      {active && visibleCount < text.length && (
        <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse rounded-full bg-current/80" />
      )}
    </span>
  )
}

function GradingStreamPanel({ events, isSubmitting }: { events: GradingEvent[]; isSubmitting: boolean }) {
  const visibleEvents = events.filter((event) => event.content)
  if (visibleEvents.length === 0) return null
  const activeIndex = isSubmitting ? visibleEvents.length - 1 : -1

  return (
    <div className="mt-4 rounded-2xl border border-blue-200 bg-[linear-gradient(180deg,rgba(239,246,255,0.96),rgba(219,234,254,0.72))] p-4 text-sm text-blue-950 shadow-[0_16px_40px_-24px_rgba(37,99,235,0.45)] dark:border-blue-500/30 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.78),rgba(37,99,235,0.12))] dark:text-blue-50">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold tracking-[0.02em]">AI 评分过程摘要</div>
        {isSubmitting && (
          <div
            data-testid="grading-stream-status"
            className="inline-flex items-center gap-2 rounded-full border border-blue-300/70 bg-white/75 px-3 py-1 text-xs font-medium text-blue-700 shadow-sm dark:border-blue-400/20 dark:bg-slate-900/55 dark:text-blue-200"
          >
            <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500 shadow-[0_0_0_6px_rgba(59,130,246,0.14)]" />
            <AnimatedStreamingLabel active={isSubmitting} />
          </div>
        )}
      </div>
      <ol className="mt-4 space-y-2.5">
        {visibleEvents.map((event, index) => {
          const isActive = index === activeIndex
          const isCompleted = !isSubmitting || index < activeIndex
          return (
            <li
              key={`${event.type}-${event.content}-${index}`}
              className={cn(
                "flex gap-3 rounded-xl px-2 py-1.5 transition-all duration-500",
                isActive && "bg-white/70 shadow-[0_10px_30px_-24px_rgba(37,99,235,0.8)] dark:bg-white/5",
                isCompleted && "bg-emerald-50/70 dark:bg-emerald-500/5",
              )}
            >
              <span
                data-testid={`grading-step-badge-${index + 1}`}
                data-active={isActive ? "true" : "false"}
                data-state={isCompleted ? "completed" : isActive ? "active" : "pending"}
                style={isActive ? { animationDuration: "3s" } : undefined}
                className={cn(
                  "mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white transition-all duration-500",
                  isActive && "animate-pulse bg-blue-500 shadow-[0_0_0_8px_rgba(59,130,246,0.16)]",
                  isCompleted && "bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]",
                  !isActive && !isCompleted && "bg-blue-700/90 dark:bg-blue-500/90",
                )}
              >
                {isCompleted ? <CheckCircle2 size={14} strokeWidth={2.5} /> : index + 1}
              </span>
              <span className={cn(
                "min-w-0 flex-1 leading-6 transition-colors duration-500",
                isCompleted ? "text-emerald-900 dark:text-emerald-100" : "text-blue-900 dark:text-blue-50",
              )}>
                <StreamingStepText
                  text={event.content ?? ""}
                  active={isActive}
                />
              </span>
            </li>
          )
        })}
      </ol>
      <p className="mt-4 text-xs leading-5 text-blue-800/90 dark:text-blue-100/85">
        这里展示的是可审计的评分依据摘要，不展示模型隐藏推理链。
      </p>
    </div>
  )
}

function ResultFeedback({ result, answerKey }: { result: BackendResult; answerKey?: unknown }) {
  const gradingDetail = result.grading_detail
  const statusText = (() => {
    if (result.is_correct === true) return "回答正确"
    if (result.is_correct === false) return "需要修改"
    if (result.scoring_method === "fallback") return "已保存，AI 暂不可用"
    return "已提交，等待批改"
  })()

  return (
    <>
      <div className={cn(
        "mt-4 p-4 rounded-xl border",
        result.is_correct === true && "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-500/10",
        result.is_correct === false && "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-500/10",
        result.is_correct === null && "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50",
      )}>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium">
          <div className="flex items-center gap-2">
            {result.is_correct === true && <><CheckCircle2 className="text-green-500" size={18} /><span className="text-green-700 dark:text-green-300">{statusText}</span></>}
            {result.is_correct === false && <><XCircle className="text-red-500" size={18} /><span className="text-red-700 dark:text-red-300">{statusText}</span></>}
            {result.is_correct === null && <span className="text-slate-600 dark:text-slate-300">{statusText}</span>}
            {result.scoring_method && (
              <span className="rounded-full border border-slate-300/80 bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                {result.scoring_method === "llm" ? "AI 自动判题" : `判题方式: ${result.scoring_method}`}
              </span>
            )}
          </div>
          {typeof result.score === "number" && (
            <div className="rounded-2xl border border-slate-300/70 bg-white/80 px-3 py-2 text-right dark:border-slate-600 dark:bg-slate-900/70">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">评分</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{result.score}/100</div>
            </div>
          )}
        </div>
        {result.feedback && (
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 prose prose-sm prose-slate dark:prose-invert max-w-none">
            <XMarkdown content={result.feedback} config={{ extensions: Latex() }} dompurifyConfig={{ ADD_ATTR: ['style'] }} />
          </div>
        )}
        {gradingDetail?.dimensions?.length ? (
          <div className="mt-4 grid gap-2">
            {gradingDetail.dimensions.map((dimension) => (
              <div
                key={`${dimension.name}-${dimension.score}`}
                className="rounded-xl border border-slate-200/90 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{dimension.name}</span>
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{dimension.score}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{dimension.feedback}</p>
              </div>
            ))}
          </div>
        ) : null}
        {gradingDetail?.strengths?.length ? (
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">亮点</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {gradingDetail.strengths.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {gradingDetail?.improvements?.length ? (
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">改进建议</div>
            <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
              {gradingDetail.improvements.map((item) => (
                <li key={item} className="list-disc ml-5">{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {answerKey !== undefined && <AnswerKeyDisplay answerKey={answerKey} />}
    </>
  )
}
