import { create } from "zustand"
import { persist } from "zustand/middleware"
import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"

export type OnboardingStatus = "not_started" | "in_progress" | "completed"

export interface Subject {
  id: string
  key: string
  name: string
  icon: string
  description: string
  onboarding_status: OnboardingStatus
  progress_percent: number
  mastered_nodes: number
  total_nodes: number
}

interface SwitchResponse {
  success: boolean
  subject: Subject
  profile: unknown
  needs_onboarding: boolean
}

interface SubjectState {
  currentSubjectId: string | null
  subjects: Subject[]
  isLoading: boolean
  needsOnboarding: boolean
  /** Tracks subject IDs whose onboarding was completed/skipped in this session */
  completedSubjectIds: Set<string>
  fetchSubjects: () => Promise<void>
  switchSubject: (subjectId: string) => Promise<boolean>
  getCurrentSubject: () => Subject | undefined
  hasValidSubject: () => boolean
  getCurrentOnboardingStatus: () => OnboardingStatus | null
  /** Mark a subject as onboarding-completed for this session (prevents SubjectGate from re-gating) */
  markOnboardingComplete: (subjectId: string) => void
  reset: () => void
}

export const useSubjectStore = create<SubjectState>()(
  persist(
    (set, get) => ({
      currentSubjectId: null,
      subjects: [],
      isLoading: false,
      needsOnboarding: false,
      completedSubjectIds: new Set<string>(),

      fetchSubjects: async () => {
        const profile = useAuthStore.getState().profile
        if (!profile?.user_id) return

        set({ isLoading: true })
        try {
          const response = await api.get<{ subjects: Subject[]; current_subject_id: string | null }>(
            `/api/subjects`,
            { params: { user_id: profile.user_id } }
          )

          set((state) => ({
            subjects: response.data.subjects,
            // Fallback: if backend returns null, use existing or first subject
            currentSubjectId:
              response.data.current_subject_id ??
              state.currentSubjectId ??
              response.data.subjects?.[0]?.id ??
              null,
          }))
        } catch (error) {
          console.error("Failed to fetch subjects:", error)
        } finally {
          set({ isLoading: false })
        }
      },

      switchSubject: async (subjectId: string) => {
        const profile = useAuthStore.getState().profile
        if (!profile?.user_id) return false

        set({ isLoading: true })
        try {
          const response = await api.post<SwitchResponse>(
            "/api/subjects/switch",
            { subject_id: subjectId },
            { params: { user_id: profile.user_id } }
          )

          if (response.data.success) {
            // Update current subject ID and needsOnboarding immediately
            set({
              currentSubjectId: subjectId,
              needsOnboarding: response.data.needs_onboarding,
            })

            // Fetch fresh subject list to get accurate progress data for all subjects
            // This ensures we have the latest onboarding_status and progress from backend
            try {
              const subjectsResponse = await api.get<{ subjects: Subject[]; current_subject_id: string | null }>(
                `/api/subjects`,
                { params: { user_id: profile.user_id } }
              )
              set({
                subjects: subjectsResponse.data.subjects,
              })
            } catch (fetchError) {
              console.error("Failed to refresh subjects after switch:", fetchError)
              // Still return true since switch succeeded
            }

            return true
          }
          return false
        } catch (error) {
          console.error("Failed to switch subject:", error)
          return false
        } finally {
          set({ isLoading: false })
        }
      },

      getCurrentSubject: () => {
        const { subjects, currentSubjectId } = get()
        return subjects.find((s) => s.id === currentSubjectId)
      },

      hasValidSubject: () => {
        const subject = get().subjects.find((s) => s.id === get().currentSubjectId)
        return !!subject && subject.onboarding_status === "completed"
      },

      getCurrentOnboardingStatus: () => {
        const subject = get().subjects.find((s) => s.id === get().currentSubjectId)
        return subject?.onboarding_status ?? null
      },

      markOnboardingComplete: (subjectId: string) => {
        set((state) => {
          const next = new Set(state.completedSubjectIds)
          next.add(subjectId)
          return { completedSubjectIds: next }
        })
      },

      reset: () => {
        set({
          currentSubjectId: null,
          subjects: [],
          isLoading: false,
          needsOnboarding: false,
          completedSubjectIds: new Set<string>(),
        })
      },
    }),
    {
      name: "subject-store",
      partialize: (state) => ({
        currentSubjectId: state.currentSubjectId,
      }),
    }
  )
)
