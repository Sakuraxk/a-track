/**
 * 学科分类工具
 * 根据 subject key 判断学科类型，用于展示差异化特色功能
 */

export type SubjectCategory = 'engineering' | 'math-logic' | 'humanities'

const ENGINEERING_KEYS = new Set([
  'python', 'programming', 'cs', 'machine_learning',
  'ai', 'database', 'cloud',
])

const MATH_LOGIC_KEYS = new Set([
  'math', 'advanced_math', 'physics', 'chemistry', 'logic',
  'probability', 'linear_algebra', 'statistics',
])

// humanities 为 fallback，不需要显式列出

export function getSubjectCategory(subjectKey: string): SubjectCategory {
  const key = subjectKey.toLowerCase()
  // ai_literacy is a general-education course, not an engineering subject
  if (key === 'ai_literacy') return 'humanities'
  if (ENGINEERING_KEYS.has(key)) return 'engineering'
  if (MATH_LOGIC_KEYS.has(key)) return 'math-logic'
  return 'humanities'
}

/** 获取学科类型的中文标签 */
export function getCategoryLabel(cat: SubjectCategory): string {
  const map: Record<SubjectCategory, string> = {
    'engineering': '工程实战',
    'math-logic': '数理逻辑',
    'humanities': '人文记忆',
  }
  return map[cat]
}

/** 获取学科类型的主题色 */
export function getCategoryTheme(cat: SubjectCategory) {
  const themes = {
    'engineering': {
      primary: '#10B981',
      gradient: 'from-emerald-500 to-cyan-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-800',
      icon: 'ph:code-bold',
      tagline: '学工程，就要能写能跑',
    },
    'math-logic': {
      primary: '#6366F1',
      gradient: 'from-indigo-500 to-violet-500',
      bg: 'bg-indigo-50 dark:bg-indigo-950/30',
      text: 'text-indigo-600 dark:text-indigo-400',
      border: 'border-indigo-200 dark:border-indigo-800',
      icon: 'tabler:math-integral-x',
      tagline: '学数理，就要看得见、推得动',
    },
    'humanities': {
      primary: '#F59E0B',
      gradient: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800',
      icon: 'ph:cards-three-bold',
      tagline: '学人文，就要记得牢、忘得慢',
    },
  }
  return themes[cat]
}
