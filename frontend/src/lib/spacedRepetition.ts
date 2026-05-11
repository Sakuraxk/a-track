/**
 * SM-2 间隔重复算法
 * 基于 SuperMemo 2 算法实现遗忘曲线智能复习
 */

export type MasteryLevel = 0 | 1 | 2 | 3  // 0=不会, 1=模糊, 2=基本掌握, 3=完全掌握

export interface FlashCard {
  id: string
  front: string         // 正面（问题/术语）
  back: string          // 反面（答案/解释）
  category?: string     // 分类标签
  tags?: string[]
}

export interface CardReviewData {
  cardId: string
  easeFactor: number    // 难度系数 (≥1.3)
  interval: number      // 当前间隔天数
  repetitions: number   // 连续正确次数
  nextReview: number    // 下次复习时间戳
  lastReview: number    // 上次复习时间戳
  mastery: MasteryLevel
}

const STORAGE_KEY = 'atrack-flashcard-reviews'
const DEFAULT_EASE = 2.5
const MIN_EASE = 1.3

/** SM-2 quality 映射：MasteryLevel → SM-2 quality (0-5) */
function masteryToQuality(mastery: MasteryLevel): number {
  const map: Record<MasteryLevel, number> = {
    0: 1,  // 不会 → 完全忘记
    1: 2,  // 模糊 → 记错
    2: 4,  // 基本掌握 → 正确但犹豫
    3: 5,  // 完全掌握 → 轻松记住
  }
  return map[mastery]
}

/** 计算下次复习的间隔和难度 */
export function calculateNextReview(
  current: CardReviewData,
  mastery: MasteryLevel
): CardReviewData {
  const quality = masteryToQuality(mastery)
  const now = Date.now()

  let { easeFactor, interval, repetitions } = current

  if (quality < 3) {
    // 记错了，重置
    repetitions = 0
    interval = 1
  } else {
    // 记对了
    repetitions += 1
    if (repetitions === 1) {
      interval = 1
    } else if (repetitions === 2) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
  }

  // 更新难度系数
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (easeFactor < MIN_EASE) easeFactor = MIN_EASE

  return {
    cardId: current.cardId,
    easeFactor,
    interval,
    repetitions,
    nextReview: now + interval * 24 * 60 * 60 * 1000,
    lastReview: now,
    mastery,
  }
}

/** 创建新卡片的初始复习数据 */
export function createInitialReview(cardId: string): CardReviewData {
  return {
    cardId,
    easeFactor: DEFAULT_EASE,
    interval: 0,
    repetitions: 0,
    nextReview: 0,
    lastReview: 0,
    mastery: 0,
  }
}

// ─── localStorage 持久化 ─────────────────────────────────────────

export function loadAllReviews(): Record<string, CardReviewData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveReview(data: CardReviewData): void {
  const all = loadAllReviews()
  all[data.cardId] = data
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function getReview(cardId: string): CardReviewData {
  const all = loadAllReviews()
  return all[cardId] || createInitialReview(cardId)
}

/** 获取今日需要复习的卡片 ID 列表 */
export function getDueCards(allCardIds: string[]): string[] {
  const now = Date.now()
  const reviews = loadAllReviews()

  return allCardIds.filter((id) => {
    const r = reviews[id]
    if (!r) return true // 新卡片
    return r.nextReview <= now
  })
}

/** 获取卡片组的学习统计 */
export function getStats(cardIds: string[]): {
  total: number
  mastered: number
  learning: number
  new: number
  dueToday: number
} {
  const reviews = loadAllReviews()
  const now = Date.now()

  let mastered = 0
  let learning = 0
  let newCount = 0
  let dueToday = 0

  for (const id of cardIds) {
    const r = reviews[id]
    if (!r || r.repetitions === 0) {
      newCount++
      dueToday++
    } else if (r.mastery >= 2 && r.interval >= 21) {
      mastered++
      if (r.nextReview <= now) dueToday++
    } else {
      learning++
      if (r.nextReview <= now) dueToday++
    }
  }

  return { total: cardIds.length, mastered, learning, new: newCount, dueToday }
}

/** MasteryLevel 的显示配置 */
export const MASTERY_CONFIG: Record<MasteryLevel, { emoji: string; label: string; color: string; bg: string }> = {
  0: { emoji: '😕', label: '不会', color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
  1: { emoji: '🤔', label: '模糊', color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  2: { emoji: '😊', label: '基本掌握', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  3: { emoji: '🎯', label: '完全掌握', color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
}
