import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { ProfileResponse } from "@/lib/backendTypes"
import { useSubjectStore } from "@/stores/subject"

type AuthState = {
  token: string | null
  profile: ProfileResponse | null
  onboardingCompleted: boolean
  setToken: (token: string) => void
  setProfile: (profile: ProfileResponse) => void
  setOnboardingCompleted: (completed: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      profile: null,
      onboardingCompleted: false,
      setToken: (token) => set({ token }),
      setProfile: (profile) => {
        const completed = profile?.portrait?.onboarding_completed === "true"
        set({ profile, onboardingCompleted: completed })
      },
      setOnboardingCompleted: (completed) => set({ onboardingCompleted: completed }),
      logout: () => {
        useSubjectStore.getState().reset()
        set({ token: null, profile: null, onboardingCompleted: false })
      },
    }),
    { name: "auth-store-v3" },
  ),
)
