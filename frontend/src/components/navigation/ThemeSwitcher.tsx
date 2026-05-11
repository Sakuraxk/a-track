import { Sun, Moon } from "lucide-react"
import { useThemeStore } from "@/stores/theme"

export function ThemeSwitcher() {
  const themeId = useThemeStore((s) => s.themeId)
  const setTheme = useThemeStore((s) => s.setTheme)

  const isDark = themeId === "dark"

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark")
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-primary shadow-sm hover:shadow-md transition-all flex items-center justify-center"
      title={isDark ? "切换到浅色模式" : "切换到深色模式"}
      id="theme-switcher-btn"
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-amber-500" />
      ) : (
        <Moon className="w-5 h-5 text-indigo-500" />
      )}
    </button>
  )
}
