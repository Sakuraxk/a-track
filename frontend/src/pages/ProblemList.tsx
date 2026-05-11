import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Search,
  Play,
  Circle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Shuffle,
  BarChart2,
  Zap,
  Check,
  X
} from "lucide-react"

import { api } from "@/lib/api"
import type { Exercise, ExerciseRecommendationResponse } from "@/lib/backendTypes"
import { useAuthStore } from "@/stores/auth"
import { useSubjectStore } from "@/stores/subject"
import { SubjectGate } from "@/components/navigation/SubjectGate"
import { SubPageHeader } from "@/components/navigation/SubPageHeader"

const DIFFICULTY_OPTIONS = [
  { value: "all", label: "全部难度" },
  { value: "easy", label: "简单", range: [1, 2] },
  { value: "medium", label: "中等", range: [3, 3] },
  { value: "hard", label: "困难", range: [4, 5] },
]

const STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "unsolved", label: "未解决" },
  { value: "solved", label: "已解决" },
  { value: "attempted", label: "尝试中" },
]

const TAG_OPTIONS = [
  { en: "Array", zh: "数组" },
  { en: "DP", zh: "动态规划" },
  { en: "String", zh: "字符串" },
  { en: "Hash Table", zh: "哈希表" },
  { en: "Tree", zh: "树" },
  { en: "DFS", zh: "深度优先" },
  { en: "Binary Search", zh: "二分查找" },
  { en: "Greedy", zh: "贪心" },
]

export default function ProblemList() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const currentSubjectId = useSubjectStore((s) => s.currentSubjectId)
  const getCurrentSubject = useSubjectStore((s) => s.getCurrentSubject)

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Exercise[]>([])
  const [aiRecommendedIds, setAiRecommendedIds] = useState<Set<string>>(new Set())
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set())

  // Filter states
  const [searchQuery, setSearchQuery] = useState("")
  const [difficultyFilter, setDifficultyFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // Dropdown states
  const [showDifficultyDropdown, setShowDifficultyDropdown] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showTagDropdown, setShowTagDropdown] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    // 直接加载题目列表（主功能）
    let cancelled = false
    setLoading(true)
    setItems([])
    const subjectKey = getCurrentSubject()?.key
    api.get<Exercise[]>("/api/practice/exercises", {
      params: subjectKey ? { subject_key: subjectKey } : undefined,
    })
      .then((res) => { if (!cancelled) setItems(res.data) })
      .catch((err) => { if (!cancelled) console.error("加载题目失败:", err) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [currentSubjectId, getCurrentSubject])

  useEffect(() => {
    // 拉取用户已解决题目（用于学习进度与“已解决/未解决”筛选）
    if (!profile?.user_id) return
    let cancelled = false
    api.get<string[]>("/api/practice/solved", { params: { user_id: profile.user_id } })
      .then((res) => {
        if (cancelled) return
        setSolvedIds(new Set((res.data || []).map(String)))
      })
      .catch((err) => {
        if (cancelled) return
        console.error("加载已解决题目失败:", err)
      })
    return () => { cancelled = true }
  }, [profile?.user_id])

  useEffect(() => {
    // AI推荐（可选增强功能，后台加载，失败不影响主功能）
    if (!profile?.user_id) return
    let cancelled = false
    api.get<ExerciseRecommendationResponse>("/api/practice/recommendations", {
      params: { user_id: profile.user_id },
    })
      .then((res) => {
        if (!cancelled) {
          const ids = new Set(res.data.items.map(item => item.id))
          setAiRecommendedIds(ids)
        }
      })
      .catch(() => { /* AI推荐失败时静默处理 */ })
    return () => { cancelled = true }
  }, [profile?.user_id])

  // Filter items
  const filteredItems = useMemo(() => {
    let result = [...items]

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.linked_nodes?.some(node => node.toLowerCase().includes(query))
      )
    }

    // Difficulty filter
    if (difficultyFilter !== "all") {
      const option = DIFFICULTY_OPTIONS.find(o => o.value === difficultyFilter)
      if (option?.range) {
        result = result.filter(item =>
          item.difficulty >= option.range[0] && item.difficulty <= option.range[1]
        )
      }
    }

    // Tag filter (if any tags selected, show items that have at least one of the tags)
    if (selectedTags.length > 0) {
      result = result.filter(item =>
        item.linked_nodes?.some(node =>
          selectedTags.some(tag => node.toLowerCase().includes(tag.toLowerCase()))
        )
      )
    }

    // Status filter（基于 solvedIds）
    if (statusFilter === "solved") {
      result = result.filter((item) => solvedIds.has(String(item.id)))
    } else if (statusFilter === "unsolved") {
      result = result.filter((item) => !solvedIds.has(String(item.id)))
    }

    return result
  }, [items, searchQuery, difficultyFilter, statusFilter, selectedTags, solvedIds])

  const progressSummary = useMemo(() => {
    const total = items.length
    const solvedCount = solvedIds.size
    const percent = total > 0 ? Math.round((solvedCount / total) * 100) : 0

    const buckets = [
      { label: "简单", color: "bg-brand-green", isInBucket: (d: number) => d <= 2 },
      { label: "中等", color: "bg-brand-orange", isInBucket: (d: number) => d === 3 },
      { label: "困难", color: "bg-red-500", isInBucket: (d: number) => d >= 4 },
    ]

    const byDifficulty = buckets.map((b) => {
      const bucketItems = items.filter((item) => b.isInBucket(item.difficulty))
      const bucketSolved = bucketItems.filter((item) => solvedIds.has(String(item.id))).length
      return { label: b.label, count: bucketSolved, total: bucketItems.length, color: b.color }
    })

    return { total, solvedCount, percent, byDifficulty }
  }, [items, solvedIds])

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, currentPage])

  const totalPages = Math.ceil(filteredItems.length / pageSize)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, difficultyFilter, statusFilter, selectedTags])

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const clearFilters = () => {
    setSearchQuery("")
    setDifficultyFilter("all")
    setStatusFilter("all")
    setSelectedTags([])
  }

  const hasActiveFilters = searchQuery || difficultyFilter !== "all" || statusFilter !== "all" || selectedTags.length > 0

  const difficultyLabel = (difficulty: number) => {
    if (difficulty <= 2) return "简单"
    if (difficulty === 3) return "中等"
    return "困难"
  }

  const difficultyClass = (difficulty: number) => {
    if (difficulty <= 2) return "bg-brand-green-light text-brand-green-dark"
    if (difficulty === 3) return "bg-brand-orange-light text-brand-orange-dark"
    return "bg-red-100 text-red-600"
  }

  return (
    <SubjectGate featureName="题库练习">
      <div className="min-h-screen bg-surface p-4 md:p-6 font-sans selection:bg-brand-green selection:text-white overflow-x-hidden">
        <div className="w-full max-w-7xl mx-auto space-y-6">

          {/* Navigation Header */}
          <SubPageHeader
            title="题库练习"
            subtitle="基于 AI 智适应引擎为您推荐最合适的挑战"
          />

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button onClick={() => navigate(`/practice/${items[Math.floor(Math.random() * items.length)]?.id}`)} className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm">
              <Shuffle className="w-4 h-4" /> 随机一题
            </button>
            <button onClick={() => navigate(`/practice/${items[0]?.id}`)} className="px-5 py-2.5 bg-brand-green text-white rounded-xl text-sm font-medium hover:bg-brand-green-dark transition-all flex items-center gap-2 shadow-md">
              <Play className="w-4 h-4" /> 开始学习
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Main List Area */}
            <div className="lg:col-span-9 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col shadow-sm">
                {/* Toolbar */}
                <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 bg-gray-50">
                  <div className="relative flex-1 min-w-[250px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索题目或标签..."
                      className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    {/* Difficulty Filter */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowDifficultyDropdown(!showDifficultyDropdown)
                          setShowStatusDropdown(false)
                          setShowTagDropdown(false)
                        }}
                        className={`px-4 py-2.5 bg-white border rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${difficultyFilter !== "all" ? "border-brand-green text-brand-green" : "border-gray-200 text-gray-600 hover:bg-gray-100"
                          }`}
                      >
                        {DIFFICULTY_OPTIONS.find(o => o.value === difficultyFilter)?.label || "难度"}
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      {showDifficultyDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
                          {DIFFICULTY_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => {
                                setDifficultyFilter(opt.value)
                                setShowDifficultyDropdown(false)
                              }}
                              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${difficultyFilter === opt.value ? "text-brand-green font-medium" : "text-gray-700"
                                }`}
                            >
                              {opt.label}
                              {difficultyFilter === opt.value && <Check className="w-4 h-4" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Status Filter */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowStatusDropdown(!showStatusDropdown)
                          setShowDifficultyDropdown(false)
                          setShowTagDropdown(false)
                        }}
                        className={`px-4 py-2.5 bg-white border rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${statusFilter !== "all" ? "border-brand-green text-brand-green" : "border-gray-200 text-gray-600 hover:bg-gray-100"
                          }`}
                      >
                        {STATUS_OPTIONS.find(o => o.value === statusFilter)?.label || "状态"}
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      {showStatusDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
                          {STATUS_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => {
                                setStatusFilter(opt.value)
                                setShowStatusDropdown(false)
                              }}
                              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${statusFilter === opt.value ? "text-brand-green font-medium" : "text-gray-700"
                                }`}
                            >
                              {opt.label}
                              {statusFilter === opt.value && <Check className="w-4 h-4" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Tag Filter */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowTagDropdown(!showTagDropdown)
                          setShowDifficultyDropdown(false)
                          setShowStatusDropdown(false)
                        }}
                        className={`px-4 py-2.5 bg-white border rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${selectedTags.length > 0 ? "border-brand-green text-brand-green" : "border-gray-200 text-gray-600 hover:bg-gray-100"
                          }`}
                      >
                        标签 {selectedTags.length > 0 && `(${selectedTags.length})`}
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      {showTagDropdown && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-3">
                          <div className="flex flex-wrap gap-2">
                            {TAG_OPTIONS.map(tag => (
                              <button
                                key={tag.en}
                                onClick={() => toggleTag(tag.en)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedTags.includes(tag.en)
                                  ? "bg-brand-green text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                  }`}
                              >
                                {tag.zh}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Clear filters */}
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200 transition-all flex items-center gap-2"
                      >
                        <X className="w-3.5 h-3.5" />
                        清除
                      </button>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs font-medium text-gray-500 border-b border-gray-100 bg-gray-50/50">
                        <th className="px-6 py-4 w-20 text-center">#</th>
                        <th className="px-6 py-4">题目</th>
                        <th className="px-6 py-4 w-32">掌握状态</th>
                        <th className="px-6 py-4 w-28">难度</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loading ? (
                        <tr><td colSpan={4} className="px-6 py-16 text-center text-sm text-gray-400 animate-pulse">加载题目中...</td></tr>
                      ) : paginatedItems.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-16 text-center text-sm text-gray-400">
                          {items.length === 0 && !hasActiveFilters
                            ? "该学科暂无练习题，敬请期待"
                            : "暂无匹配的题目"}
                        </td></tr>
                      ) : (
                        paginatedItems.map((exercise, idx) => {
                          const isSolved = solvedIds.has(String(exercise.id))
                          return (
                            <tr
                              key={exercise.id}
                              onClick={() => navigate(`/practice/${exercise.id}`)}
                              className="group hover:bg-gray-50 transition-all cursor-pointer"
                            >
                              <td className="px-6 py-4 text-center">
                                <span className="text-xs text-gray-400 font-mono">{(currentPage - 1) * pageSize + idx + 1}</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <span className="text-base font-medium text-gray-900 group-hover:text-brand-green transition-colors">{exercise.title}</span>
                                  {aiRecommendedIds.has(exercise.id) && <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 text-xs font-medium">AI 推荐</span>}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {isSolved ? (
                                  <div className="flex items-center gap-1.5 text-brand-green font-medium text-sm">
                                    <Check className="w-4 h-4" /> 已通过
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                                    <Circle className="w-3.5 h-3.5" /> 待练习
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${difficultyClass(exercise.difficulty)}`}>
                                  {difficultyLabel(exercise.difficulty)}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <span className="text-sm text-gray-500">
                    显示 {filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredItems.length)}，共 {filteredItems.length} 题
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-10 w-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-medium transition-all ${currentPage === pageNum
                            ? "bg-brand-green text-white shadow-sm"
                            : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="h-10 w-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Area */}
            <div className="lg:col-span-3 space-y-6">
              {/* Progress Card */}
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-xl bg-gray-800 flex items-center justify-center text-white">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">学习进度</h3>
                </div>
                <div className="flex flex-col items-center gap-6">
                  <div className="relative h-32 w-40">
                    <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="stroke-gray-100" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="stroke-brand-green" strokeWidth="3" strokeDasharray={`${progressSummary.percent}, 100`} strokeLinecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-semibold text-gray-900">{progressSummary.solvedCount}</span>
                      <span className="text-xs text-gray-500 mt-1">已解决</span>
                    </div>
                  </div>
                  <div className="w-full space-y-3">
                    {progressSummary.byDifficulty.map(s => (
                      <div key={s.label} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600">{s.label}</span>
                          <span className="text-xs font-medium text-gray-900">{s.count}/{s.total}</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.total ? (s.count / s.total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Daily Challenge */}
              <div className="rounded-2xl p-6 bg-gray-800 text-white shadow-lg relative overflow-hidden group cursor-pointer active:scale-[0.99] transition-all">
                <div className="absolute -right-8 -top-8 h-32 w-32 bg-brand-green/20 rounded-full blur-[40px] group-hover:scale-110 transition-transform duration-500" />
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-sm font-medium text-gray-400">每日挑战</h3>
                    <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2 leading-tight">104. 二叉树的最大深度</h4>
                  <p className="text-xs text-gray-400 mb-6">奖励: +50 XP · 15 分钟</p>
                  <button onClick={() => navigate('/practice/daily')} className="w-full py-3 bg-white text-gray-900 rounded-xl text-sm font-medium shadow-md active:scale-95 transition-all hover:bg-gray-100">
                    立即挑战
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">热门标签</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { en: "Array", zh: "数组" },
                    { en: "DP", zh: "动态规划" },
                    { en: "String", zh: "字符串" },
                    { en: "Hash Table", zh: "哈希表" },
                    { en: "Tree", zh: "树" },
                    { en: "DFS", zh: "深度优先" },
                    { en: "Binary Search", zh: "二分查找" },
                    { en: "Greedy", zh: "贪心" }
                  ].map(tag => (
                    <span key={tag.en} className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-medium text-gray-700 hover:bg-gray-200 cursor-pointer transition-all">
                      {tag.zh}
                    </span>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </SubjectGate>
  )
}
