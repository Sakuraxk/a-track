import type { LearningWorkstationState } from "@/features/studio/components/workstation/workstationTypes"

type IslandCopy = {
  statusLabel: string
  detailLine: string
}

type IslandCopyOverride = Partial<IslandCopy>

const DEFAULT_ISLAND_COPY: Record<LearningWorkstationState, IslandCopy> = {
  progress: { statusLabel: "推进中", detailLine: "进入概念学习" },
  practice: { statusLabel: "练习态", detailLine: "准备开始输出验证" },
  review: { statusLabel: "复盘态", detailLine: "训练结束，开始复盘" },
}

const REVIEW_RESULT_DETAIL_PATTERN =
  /[%％]|得分|分数|正确率|准确率|score|accuracy/iu

export function buildIslandCopy(
  state: LearningWorkstationState,
  override: IslandCopyOverride = {},
): IslandCopy {
  const base = DEFAULT_ISLAND_COPY[state]
  const detailLine = override.detailLine ?? base.detailLine

  return {
    statusLabel: override.statusLabel ?? base.statusLabel,
    detailLine:
      state === "review" && REVIEW_RESULT_DETAIL_PATTERN.test(detailLine)
      ? base.detailLine
      : detailLine,
  }
}

export function buildPreflightCopy(subjectName: string) {
  return {
    title: subjectName ? `${subjectName} 学习工作台` : "学习工作台",
    reason: "先明确目标与基础，再生成路线。系统会围绕你的学习阶段安排今天的主任务、练习和复盘。",
    ctaLabel: "生成学习路线",
    sectionTitle: "先生成可执行学习路线",
    sectionDescription:
      "完成目标与基础确认后，系统会自动安排今天的主线任务、练习与复盘。",
  }
}

export function buildFallbackPromptPreview(
  goalLabel: string,
  levelLabel: string,
) {
  return [
    "今日任务标题：待补充",
    "今日概念摘要：待补充",
    "练习结果信号：系统将补齐今日练习与复盘信号。",
    `当前学习目标 / 基础水平：${goalLabel || "当前目标"} / ${levelLabel}`,
    "明日任务：等待生成",
  ]
}

export function buildSummaryRecommendation(isTodayComplete: boolean) {
  return isTodayComplete
    ? "先看总结，再确认明日任务，不要立刻切换到新的工具或新主题。"
    : "今天还在推进态，先完成主线任务再做发散动作。"
}

export function buildSummaryBridge(tomorrowTaskTitle: string | null) {
  return tomorrowTaskTitle
    ? `明天会直接衔接到「${tomorrowTaskTitle}」，建议保留今天的术语和例子，减少上下文切换成本。`
    : "明日任务还未完全生成，系统会根据今天的结果补齐下一步主线。"
}

export function buildReviewDegradedNotice() {
  return "复盘数据正在补齐，系统稍后会生成完整的总结与趋势。"
}
