/**
 * 智能记忆闪卡 — 人文记忆类核心特色
 * 知识点正反面卡片 + 遗忘曲线复习
 */
import { useState, useMemo, useCallback, useEffect } from 'react'
import { Icon } from '@/components/ui/Icon'
import {
  type FlashCard,
  type MasteryLevel,
  getReview,
  saveReview,
  calculateNextReview,
  getStats,
  getDueCards,
  MASTERY_CONFIG,
} from '@/lib/spacedRepetition'
import { getFlashcardGroups } from '@/lib/flashcardData'
import { Button } from '@/components/ui/button'
import '@/styles/subject-tools.css'

interface FlashcardLabProps {
  subjectKey?: string
  className?: string
}

export default function FlashcardLab({
  subjectKey = 'default',
  className = '',
}: FlashcardLabProps) {
  const groups = useMemo(() => getFlashcardGroups(subjectKey), [subjectKey])
  const [activeGroupIndex, setActiveGroupIndex] = useState(0)
  const activeGroup = groups[activeGroupIndex] || groups[0]
  const allCards = activeGroup?.cards ?? []
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [mode, setMode] = useState<'study' | 'review'>('study')
  const [reviewQueue, setReviewQueue] = useState<string[]>([])
  const [reviewIndex, setReviewIndex] = useState(0)
  const [animKey, setAnimKey] = useState(0) // for re-trigger animations
  const [statsRefresh, setStatsRefresh] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const [showSummaryContent, setShowSummaryContent] = useState(false)
  // 本轮学习中每张卡的自评记录: cardId -> MasteryLevel
  const [sessionRatings, setSessionRatings] = useState<Record<string, MasteryLevel>>({})

  // 当前展示的卡片
  const activeCards = useMemo(() => {
    if (mode === 'review' && reviewQueue.length > 0) {
      return reviewQueue
        .map((id) => allCards.find((c) => c.id === id))
        .filter(Boolean) as FlashCard[]
    }
    return allCards
  }, [mode, reviewQueue, allCards])

  const currentCard =
    mode === 'review'
      ? activeCards[reviewIndex] || null
      : activeCards[currentIndex] || null

  const stats = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    statsRefresh // dependency
    return getStats(allCards.map((c) => c.id))
  }, [allCards, statsRefresh])

  const dueCount = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    statsRefresh
    return getDueCards(allCards.map((c) => c.id)).length
  }, [allCards, statsRefresh])

  // ── 操作 ─────────────────────────────────────────────────────

  const flipCard = useCallback(() => {
    setIsFlipped((prev) => !prev)
  }, [])

  const nextCard = useCallback(() => {
    setIsFlipped(false)
    setAnimKey((k) => k + 1)
    if (mode === 'review') {
      if (reviewIndex < activeCards.length - 1) {
        setReviewIndex((i) => i + 1)
      } else {
        // Review complete
        setShowSummary(true)
        setShowSummaryContent(false)
      }
    } else {
      if (currentIndex < allCards.length - 1) {
        setCurrentIndex((i) => i + 1)
      } else {
        // Study complete
        setShowSummary(true)
        setShowSummaryContent(false)
      }
    }
  }, [mode, reviewIndex, activeCards.length, allCards.length, currentIndex])

  const prevCard = useCallback(() => {
    setIsFlipped(false)
    setAnimKey((k) => k + 1)
    if (mode === 'review') {
      setReviewIndex((i) => Math.max(0, i - 1))
    } else {
      setCurrentIndex((i) => (i - 1 + allCards.length) % allCards.length)
    }
  }, [mode, allCards.length])

  const markMastery = useCallback(
    (level: MasteryLevel) => {
      if (!currentCard) return
      const review = getReview(currentCard.id)
      const updated = calculateNextReview(review, level)
      saveReview(updated)
      setStatsRefresh((n) => n + 1)
      // 记录本轮自评
      setSessionRatings((prev) => ({ ...prev, [currentCard.id]: level }))
      // Auto advance
      setTimeout(() => nextCard(), 300)
    },
    [currentCard, nextCard]
  )

  const startReview = useCallback(() => {
    const due = getDueCards(allCards.map((c) => c.id))
    if (due.length === 0) return
    setReviewQueue(due)
    setReviewIndex(0)
    setIsFlipped(false)
    setMode('review')
    setShowSummary(false)
    setSessionRatings({})
  }, [allCards])

  // 本轮自评统计
  const sessionStats = useMemo(() => {
    const counts = { forgot: 0, fuzzy: 0, good: 0, perfect: 0, unrated: 0 }
    const cards = mode === 'review' ? activeCards : allCards
    for (const card of cards) {
      const rating = sessionRatings[card.id]
      if (rating === undefined) counts.unrated++
      else if (rating === 0) counts.forgot++
      else if (rating === 1) counts.fuzzy++
      else if (rating === 2) counts.good++
      else if (rating === 3) counts.perfect++
    }
    return counts
  }, [sessionRatings, mode, activeCards, allCards])

  // 结算面入场动画
  useEffect(() => {
    if (showSummary) {
      const timer = setTimeout(() => setShowSummaryContent(true), 100)
      return () => clearTimeout(timer)
    }
  }, [showSummary])

  const shuffleCards = useCallback(() => {
    const shuffled = [...allCards].sort(() => Math.random() - 0.5)
    // We can't directly shuffle the source array, so we'll just randomize currentIndex
    setCurrentIndex(Math.floor(Math.random() * shuffled.length))
    setIsFlipped(false)
    setAnimKey((k) => k + 1)
  }, [allCards])

  // Keyboard shortcuts
  // useEffect(() => {
  //   const handler = (e: KeyboardEvent) => {
  //     if (e.key === ' ' || e.key === 'Enter') flipCard()
  //     else if (e.key === 'ArrowRight') nextCard()
  //     else if (e.key === 'ArrowLeft') prevCard()
  //     else if (e.key >= '1' && e.key <= '4') markMastery((parseInt(e.key) - 1) as MasteryLevel)
  //   }
  //   window.addEventListener('keydown', handler)
  //   return () => window.removeEventListener('keydown', handler)
  // }, [flipCard, nextCard, prevCard, markMastery])

  const displayIndex = mode === 'review' ? reviewIndex : currentIndex
  const displayTotal = mode === 'review' ? activeCards.length : allCards.length

  if (!currentCard) {
    return (
      <div className={`flex items-center justify-center py-20 ${className}`}>
        <div className="text-center text-slate-400">
          <Icon icon="ph:cards-three-bold" className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无闪卡数据</p>
        </div>
      </div>
    )
  }

  // ── 结算视图辅助数据 ─────────────────────────────────────────────
  const summaryCards = mode === 'review' ? activeCards : allCards
  const summaryTotal = summaryCards.length
  const masteryRate = summaryTotal > 0
    ? Math.round(((sessionStats.perfect + sessionStats.good) / summaryTotal) * 100)
    : 0
  const isHighPerformance = masteryRate >= 80

  // ── 如果处于结算状态，渲染全屏结算页 ───────────────────────────
  if (showSummary) {
    return (
      <div className={`${className}`}>
        <div className="w-full max-w-2xl mx-auto space-y-6 py-4">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className={`inline-flex items-center justify-center p-4 rounded-full bg-white dark:bg-slate-800 shadow-lg mb-2 transition-all duration-700 transform ${
              showSummaryContent ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
            }`}>
              {isHighPerformance ? (
                <Icon icon="ph:trophy-bold" className="w-14 h-14 text-yellow-500 animate-pulse" />
              ) : (
                <Icon icon="ph:target-bold" className="w-14 h-14 text-indigo-600" />
              )}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isHighPerformance ? '太棒了！' : '学习完成！'}
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              {isHighPerformance
                ? '你已经掌握了大部分知识点，继续保持！'
                : `已完成 ${summaryTotal} 张闪卡的${mode === 'review' ? '复习' : '学习'}。`}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { emoji: '🎯', label: '完全掌握', count: sessionStats.perfect, borderColor: 'border-l-green-500', textColor: 'text-green-600', delay: 'delay-100' },
              { emoji: '😊', label: '基本掌握', count: sessionStats.good, borderColor: 'border-l-blue-500', textColor: 'text-blue-600', delay: 'delay-200' },
              { emoji: '🤔', label: '模糊', count: sessionStats.fuzzy, borderColor: 'border-l-orange-500', textColor: 'text-orange-600', delay: 'delay-300' },
              { emoji: '😕', label: '不会', count: sessionStats.forgot, borderColor: 'border-l-red-500', textColor: 'text-red-600', delay: 'transition-delay-[400ms]' },
            ].map((item) => (
              <div
                key={item.label}
                className={`bg-white dark:bg-slate-800 rounded-xl p-4 border-l-4 ${item.borderColor} shadow-sm transition-all duration-500 ${item.delay} ${
                  showSummaryContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <span>{item.emoji}</span> {item.label}
                </p>
                <span className={`text-2xl font-bold ${item.textColor}`}>{item.count}</span>
                <span className="text-xs text-slate-400 ml-1">张</span>
              </div>
            ))}
          </div>

          {/* Mastery Rate */}
          <div className={`bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm transition-all duration-500 transition-delay-[500ms] ${
            showSummaryContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">掌握率</p>
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{masteryRate}%</span>
            </div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  masteryRate >= 80 ? 'bg-green-500' : masteryRate >= 50 ? 'bg-blue-500' : 'bg-orange-500'
                }`}
                style={{ width: showSummaryContent ? `${masteryRate}%` : '0%' }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">基本掌握 + 完全掌握 = 掌握</p>
          </div>

          {/* Card Overview Grid */}
          <div className={`bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm transition-all duration-500 transition-delay-[600ms] ${
            showSummaryContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}>
            <h3 className="text-sm font-semibold mb-3 text-slate-900 dark:text-white">卡片概览</h3>
            <div className="grid grid-cols-8 gap-2 mb-4">
              {summaryCards.map((card, index) => {
                const rating = sessionRatings[card.id]
                const ratingStyle =
                  rating === 3
                    ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
                    : rating === 2
                      ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                      : rating === 1
                        ? 'bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400'
                        : rating === 0
                          ? 'bg-red-100 border-red-300 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                          : 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-500'
                const ratingLabel =
                  rating === 3 ? '完全掌握' : rating === 2 ? '基本掌握' : rating === 1 ? '模糊' : rating === 0 ? '不会' : '未评价'
                return (
                  <div
                    key={card.id}
                    className={`aspect-square rounded-md flex items-center justify-center text-xs font-medium border transition-colors ${ratingStyle}`}
                    title={`第 ${index + 1} 张: ${ratingLabel}`}
                  >
                    {index + 1}
                  </div>
                )
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowSummary(false)
                  setShowSummaryContent(false)
                  setSessionRatings({})
                  setMode('study')
                  setCurrentIndex(0)
                  setReviewIndex(0)
                  setIsFlipped(false)
                }}
              >
                <Icon icon="ph:arrow-counter-clockwise-bold" className="w-4 h-4 mr-2" />
                再来一遍
              </Button>
              {groups.length > 1 && (
                <Button
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white"
                  onClick={() => {
                    setShowSummary(false)
                    setShowSummaryContent(false)
                    setSessionRatings({})
                    setActiveGroupIndex((i) => (i + 1) % groups.length)
                    setCurrentIndex(0)
                    setIsFlipped(false)
                    setMode('study')
                    setReviewIndex(0)
                    setAnimKey((k) => k + 1)
                  }}
                >
                  <Icon icon="ph:swap-bold" className="w-4 h-4 mr-2" />
                  换一组
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      {/* Group selector tabs */}
      {groups.length > 1 && (
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-thin">
          {groups.map((group, idx) => (
            <button
              key={group.id}
              onClick={() => {
                if (idx === activeGroupIndex) return
                setActiveGroupIndex(idx)
                setCurrentIndex(0)
                setIsFlipped(false)
                setMode('study')
                setReviewIndex(0)
                setReviewQueue([])
                setSessionRatings({})
                setShowSummary(false)
                setAnimKey((k) => k + 1)
                setStatsRefresh((n) => n + 1)
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                idx === activeGroupIndex
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 scale-105'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20'
              }`}
            >
              <span className="text-base">{group.icon}</span>
              <span>{group.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                idx === activeGroupIndex
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}>{group.cardCount}</span>
            </button>
          ))}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6 text-sm">
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              已掌握 <strong className="text-slate-700 dark:text-white">{stats.mastered}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              学习中 <strong className="text-slate-700 dark:text-white">{stats.learning}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              新卡片 <strong className="text-slate-700 dark:text-white">{stats.new}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={shuffleCards}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all"
            title="随机打乱"
          >
            <Icon icon="ph:shuffle-bold" className="w-5 h-5" />
          </button>

          {dueCount > 0 && (
            <button
              onClick={startReview}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-bold shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2"
            >
              <Icon icon="ph:clock-countdown-bold" className="w-4 h-4" />
              复习 ({dueCount})
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
          style={{ width: `${((displayIndex + 1) / displayTotal) * 100}%` }}
        />
      </div>

      {/* Mode indicator */}
      {mode === 'review' && (
        <div className="mb-4 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm font-medium flex items-center gap-2">
          <Icon icon="ph:clock-countdown-bold" className="w-4 h-4" />
          复习模式 — 共 {activeCards.length} 张待复习
          <button
            onClick={() => {
              setMode('study')
              setReviewIndex(0)
            }}
            className="ml-auto text-xs underline hover:no-underline"
          >
            退出复习
          </button>
        </div>
      )}

      {/* Flashcard area */}
      <div className="flashcard-perspective mb-6 w-full h-[320px]" key={animKey}>
        <div
          className="flashcard-enter cursor-pointer select-none w-full h-full"
          onClick={flipCard}
        >
          <div className={`flashcard-inner w-full h-full ${isFlipped ? 'flipped' : ''}`}>
            {/* Front */}
            <div className="flashcard-front">
              <div className="absolute top-4 left-4">
                {currentCard.category && (
                  <span className="px-2 py-1 rounded-full bg-amber-200/50 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                    {currentCard.category}
                  </span>
                )}
              </div>
              <div className="absolute top-4 right-4 text-amber-400/50 dark:text-amber-500/50">
                <Icon icon="ph:cards-three-bold" className="w-6 h-6" />
              </div>

              <div className="text-center">
                <p className="text-xl md:text-2xl font-bold text-amber-900 dark:text-amber-100 leading-relaxed">
                  {currentCard.front}
                </p>
              </div>

              <div className="absolute bottom-4 text-xs text-amber-500/60 dark:text-amber-400/40 flex items-center gap-1">
                <Icon icon="ph:hand-tap-bold" className="w-4 h-4" />
                点击翻转
              </div>
            </div>

            {/* Back */}
            <div className="flashcard-back">
              <div className="absolute top-4 left-4">
                <span className="px-2 py-1 rounded-full bg-emerald-200/50 dark:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  答案
                </span>
              </div>

              <div className="text-center max-w-md">
                <p className="text-lg md:text-xl text-emerald-900 dark:text-emerald-100 leading-relaxed whitespace-pre-line">
                  {currentCard.back}
                </p>
              </div>

              <div className="absolute bottom-4 text-xs text-emerald-500/60 dark:text-emerald-400/40 flex items-center gap-1">
                <Icon icon="ph:hand-tap-bold" className="w-4 h-4" />
                点击翻回
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Nav buttons */}
        <button
          onClick={prevCard}
          className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all"
        >
          <Icon icon="ph:caret-left-bold" className="w-5 h-5" />
        </button>

        {/* Mastery buttons */}
        <div className="flex items-center gap-2">
          {([0, 1, 2, 3] as MasteryLevel[]).map((level) => {
            const config = MASTERY_CONFIG[level]
            return (
              <button
                key={level}
                onClick={() => markMastery(level)}
                className={`mastery-btn px-3 py-2 rounded-xl ${config.bg} ${config.color} text-sm font-bold flex items-center gap-1.5 border-2 border-transparent hover:border-current/20 shadow-sm`}
                title={config.label}
              >
                <span className="text-lg">{config.emoji}</span>
                <span className="hidden sm:inline text-xs">{config.label}</span>
              </button>
            )
          })}
        </div>

        {/* Nav button */}
        <button
          onClick={nextCard}
          className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all"
        >
          <Icon icon="ph:caret-right-bold" className="w-5 h-5" />
        </button>
      </div>

      {/* Card counter */}
      <div className="text-center mt-4 text-sm text-slate-400">
        {displayIndex + 1} / {displayTotal}
        {currentCard.tags && currentCard.tags.length > 0 && (
          <span className="ml-3 text-xs">
            {currentCard.tags.map((tag) => (
              <span
                key={tag}
                className="inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 mr-1"
              >
                #{tag}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  )
}
