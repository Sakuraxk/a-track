import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ThemeId = "light" | "dark"

function applyThemeToDOM(themeId: ThemeId) {
  const html = document.documentElement
  
  if (themeId === "dark") {
    html.classList.add("dark")
  } else {
    html.classList.remove("dark")
  }
}

type ThemeState = {
  themeId: ThemeId
  setTheme: (id: ThemeId) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeId: "light",
      setTheme: (id: ThemeId) => {
        applyThemeToDOM(id)
        set({ themeId: id })
      },
    }),
    {
      name: "theme-store-v2",
    },
  ),
)

// Apply persisted theme on page load
const unsub = useThemeStore.subscribe((state) => {
  applyThemeToDOM(state.themeId)
  unsub()
})
// Also apply immediately for the initial state
applyThemeToDOM(useThemeStore.getState().themeId)
