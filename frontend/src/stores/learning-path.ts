import { create } from "zustand"
import { persist } from "zustand/middleware"

interface LearningTask {
  id: string
  title: string
  description: string
  type: "concept" | "exercise" | "project" | "review"
  duration_minutes: number
  resources: string[]
  completed: boolean
}

interface LearningDay {
  day: number
  date: string
  theme: string
  tasks: LearningTask[]
  total_minutes: number
  milestone?: string
}

export interface LearningPath {
  id: string
  user_id: string
  goal: string
  total_days: number
  daily_minutes: number
  level?: string
  created_at: string
  days: LearningDay[]
  generated_days?: number
  phase_size?: number
  progress_percent: number
  current_day: number
  source?: string
  // 版本管理字段
  version?: number
  version_name?: string
  is_active?: boolean
  archived_at?: string | null
}

// 版本列表中的简化版本信息
export interface VersionSummary {
  id: string
  version: number
  version_name: string | null
  is_active: boolean
  goal: string
  total_days: number
  daily_minutes: number
  progress_percent: number
  current_day: number
  generated_days: number
  created_at: string
  archived_at: string | null
}

type LearningPathState = {
  pathsBySubject: Record<string, LearningPath>
  generating: boolean
  generatingStep: number
  generationStartTime: number | null
  // 版本列表缓存
  versionsBySubject: Record<string, VersionSummary[]>

  getPathForSubject: (subjectKey: string) => LearningPath | null
  setPathForSubject: (subjectKey: string, path: LearningPath | null) => void
  updateTaskCompletion: (subjectKey: string, dayNum: number, taskId: string, completed: boolean) => void
  clearPathForSubject: (subjectKey: string) => void
  clearAllPaths: () => void
  startGenerating: () => void
  setGeneratingStep: (step: number) => void
  stopGenerating: () => void
  // 版本管理方法
  setVersionsForSubject: (subjectKey: string, versions: VersionSummary[]) => void
  getVersionsForSubject: (subjectKey: string) => VersionSummary[]
}

export const useLearningPathStore = create<LearningPathState>()(
  persist(
    (set, get) => ({
      pathsBySubject: {},
      generating: false,
      generatingStep: 0,
      generationStartTime: null,
      versionsBySubject: {},

      getPathForSubject: (subjectKey) => get().pathsBySubject[subjectKey] || null,

      setPathForSubject: (subjectKey, path) => set((state) => {
        const newPaths = { ...state.pathsBySubject }
        if (path) {
          newPaths[subjectKey] = path
        } else {
          delete newPaths[subjectKey]
        }
        return { pathsBySubject: newPaths }
      }),

      startGenerating: () => set({
        generating: true,
        generatingStep: 0,
        generationStartTime: Date.now()
      }),

      setGeneratingStep: (step) => set({ generatingStep: step }),

      stopGenerating: () => set({
        generating: false,
        generatingStep: 0,
        generationStartTime: null
      }),

      updateTaskCompletion: (subjectKey, dayNum, taskId, completed) => {
        const currentPath = get().pathsBySubject[subjectKey]
        if (!currentPath) return

        const newDays = currentPath.days.map(day => {
          if (day.day === dayNum) {
            return {
              ...day,
              tasks: day.tasks.map(task =>
                task.id === taskId ? { ...task, completed } : task
              )
            }
          }
          return day
        })

        const totalTasks = newDays.reduce((sum, d) => sum + d.tasks.length, 0)
        const completedTasks = newDays.reduce(
          (sum, d) => sum + d.tasks.filter(t => t.completed).length,
          0
        )

        set((state) => ({
          pathsBySubject: {
            ...state.pathsBySubject,
            [subjectKey]: {
              ...currentPath,
              days: newDays,
              progress_percent: (completedTasks / Math.max(totalTasks, 1)) * 100
            }
          }
        }))
      },

      clearPathForSubject: (subjectKey) => set((state) => {
        const newPaths = { ...state.pathsBySubject }
        delete newPaths[subjectKey]
        return { pathsBySubject: newPaths }
      }),

      clearAllPaths: () => set({ pathsBySubject: {}, versionsBySubject: {} }),

      // 版本管理方法
      setVersionsForSubject: (subjectKey, versions) => set((state) => ({
        versionsBySubject: {
          ...state.versionsBySubject,
          [subjectKey]: versions
        }
      })),

      getVersionsForSubject: (subjectKey) => {
        return get().versionsBySubject[subjectKey] || []
      }
    }),
    {
      name: "learning-path-store-v4",
      partialize: (state) => ({
        pathsBySubject: state.pathsBySubject,
        versionsBySubject: state.versionsBySubject,
      }),
    }
  )
)
