import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CheckCheck,
  Clock3,
  ListChecks,
  Route,
  Sparkles,
  TrendingUp,
} from "lucide-react"

import { Button } from "@/components/ui/button"

interface SummaryMetric {
  label: string
  value: string
}

interface SummaryInsight {
  title: string
  items: string[]
}

interface LearningCanvasProps {
  stage: "active" | "completed"
  dayTheme: string | null
  taskTypeLabel: string
  taskTitle: string
  taskDescription: string
  taskDuration: number | null
  taskResources: string[]
  completedTaskCount: number
  totalTaskCount: number
  onContinue: () => void
  onOpenPlan: () => void
  onOpenPractice: () => void
  tomorrowTaskTitle: string | null
  tomorrowTaskDescription: string | null
  llmPromptPreview: string[]
  summaryTakeaways: string[]
  summaryMistakes: string[]
  summaryRecommendation: string
  summaryBridge: string
  summaryMetrics: SummaryMetric[]
  isDegraded?: boolean
  degradedNotice?: string
}

export default function LearningCanvas({
  stage,
  dayTheme,
  taskTypeLabel,
  taskTitle,
  taskDescription,
  taskDuration,
  taskResources,
  completedTaskCount,
  totalTaskCount,
  onContinue,
  onOpenPlan,
  onOpenPractice,
  tomorrowTaskTitle,
  tomorrowTaskDescription,
  llmPromptPreview,
  summaryTakeaways,
  summaryMistakes,
  summaryRecommendation,
  summaryBridge,
  summaryMetrics,
  isDegraded = false,
  degradedNotice,
}: LearningCanvasProps) {
  const progressLabel =
    totalTaskCount > 0 ? `已完成 ${completedTaskCount} / ${totalTaskCount}` : "等待系统生成今日任务"

  const summaryBlocks: SummaryInsight[] = [
    {
      title: "今日收获",
      items: summaryTakeaways,
    },
    {
      title: "易错提醒",
      items: summaryMistakes,
    },
  ]

  if (stage === "completed" && isDegraded) {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,0.98))] p-6 shadow-[0_24px_60px_-36px_rgba(245,158,11,0.28)] lg:p-7">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              <CheckCheck className="h-3.5 w-3.5" />
              复盘降级
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 lg:text-[2rem]">
                复盘数据正在补齐
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 lg:text-base">
                {degradedNotice ||
                  "系统正在补齐练习与复盘信号，完整总结与趋势将稍后生成。"}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200/80 bg-white/90 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-amber-600">
                当前建议
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {summaryRecommendation}
              </p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (stage === "completed") {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,253,245,0.9))] p-6 shadow-[0_24px_60px_-36px_rgba(16,185,129,0.28)] lg:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                <CheckCheck className="h-3.5 w-3.5" />
                完成态
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">今日知识点总结</div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 lg:text-[2rem]">
                  今天的主线任务已经收束
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 lg:text-base">
                  现在的重点不再是找入口，而是把今天的知识点抽出来，把练习中的信号压缩成可延续到明天的结论。
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[340px] lg:grid-cols-1">
              {summaryMetrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-emerald-200/70 bg-white/85 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{metric.label}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{metric.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200/70 bg-white/90 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  总结内容
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {summaryBlocks.map((block) => (
                    <div key={block.title} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{block.title}</div>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                        {block.items.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-emerald-700">一句话建议</div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{summaryRecommendation}</p>
                </div>

                <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">明日衔接说明</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{summaryBridge}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <BrainCircuit className="h-4 w-4 text-emerald-500" />
                  AI 总结提示词
                </div>
                <div className="mt-4 space-y-3">
                  {llmPromptPreview.map((line, index) => (
                    <div key={`${line}-${index}`} className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Prompt Signal {index + 1}
                      </div>
                      <div className="mt-1 text-sm leading-6 text-slate-600">{line}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ArrowRight className="h-4 w-4 text-teal-600" />
                  明日任务预告
                </div>
                <div className="mt-4 rounded-2xl border border-teal-200/70 bg-[linear-gradient(180deg,rgba(240,253,250,0.95),rgba(255,255,255,0.98))] p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-teal-600">{dayTheme || "下一阶段"}</div>
                  <div className="mt-2 text-xl font-black tracking-tight text-slate-900">
                    {tomorrowTaskTitle || "明日任务等待生成"}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {tomorrowTaskDescription || "系统会在下一轮学习安排中，自动衔接下一条概念与练习主线。"}
                  </p>
                  <div className="mt-5 flex flex-col gap-3">
                    <Button
                      variant="outline"
                      onClick={onOpenPlan}
                      className="h-11 rounded-2xl border-slate-200 bg-white/90 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Route className="mr-2 h-4 w-4" />
                      查看完整路线
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  今日学习数据
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  {summaryMetrics.map((metric) => (
                    <div key={`data-${metric.label}`} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{metric.label}</div>
                      <div className="mt-2 text-lg font-bold text-slate-900">{metric.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] lg:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
              <BookOpenCheck className="h-3.5 w-3.5" />
              今日主线任务
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{taskTypeLabel}</div>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 lg:text-[2rem]">{taskTitle}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 lg:text-base">{taskDescription}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[320px] lg:grid-cols-1">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">今日主题</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{dayTheme || "等待主题生成"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
                <Clock3 className="h-3.5 w-3.5" />
                预计投入
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {taskDuration ? `${taskDuration} 分钟` : "系统会根据路线安排时长"}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">任务进度</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{progressLabel}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-5">
              <div className="text-sm font-semibold text-slate-900">主线步骤</div>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-teal-200/70 bg-white/90 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                      1
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">概念学习</div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{taskTypeLabel}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{taskDescription}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(taskResources.length > 0 ? taskResources : ["进入学习路线确认今日任务", "梳理核心概念", "形成可复述的理解"]).map(
                      (resource) => (
                        <span
                          key={resource}
                          className="inline-flex items-center rounded-full border border-teal-200/80 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700"
                        >
                          {resource}
                        </span>
                      ),
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(255,255,255,0.96))] p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                      2
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">课后习题</div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">闭环验证</div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    概念学习完成后，立刻进入练习区验证是否已经能独立运用。不要把它当成附加动作，它是今天主线的第二步。
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-5">
              <div className="text-sm font-semibold text-slate-900">执行提醒</div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                先完成概念学习，再立刻切到练习。保持同一主题下的执行链路，记忆和迁移都会更稳定。
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-[linear-gradient(180deg,rgba(240,253,250,0.9),rgba(255,255,255,0.95))] p-5">
            <div className="text-sm font-semibold text-slate-900">开始执行</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              主线任务已经排好，接下来只做两件事：先进入概念学习，再完成课后习题。
            </p>
            <div className="mt-5 space-y-3">
              <Button
                onClick={onContinue}
                className="h-12 w-full rounded-2xl bg-teal-600 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 hover:bg-teal-500"
              >
                进入概念学习
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={onOpenPractice}
                className="h-11 w-full rounded-2xl border-amber-200 bg-amber-50/80 text-sm font-semibold text-amber-700 hover:bg-amber-100"
              >
                <ListChecks className="mr-2 h-4 w-4" />
                进入课后习题
              </Button>
              <Button
                variant="outline"
                onClick={onOpenPlan}
                className="h-11 w-full rounded-2xl border-slate-200 bg-white/90 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Route className="mr-2 h-4 w-4" />
                查看完整路线
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
