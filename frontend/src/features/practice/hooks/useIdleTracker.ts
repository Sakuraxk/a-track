import { useState, useEffect, useCallback, useRef } from "react"

interface UseIdleTrackerOptions {
  timeoutMs?: number
  onIdle?: () => void
}

export function useIdleTracker(options: UseIdleTrackerOptions = {}) {
  const { timeoutMs = 10000, onIdle } = options
  const [isIdle, setIsIdle] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsIdle(true)
      onIdle?.()
    }, timeoutMs)
  }, [timeoutMs, onIdle])

  const handleActivity = useCallback(() => {
    setIsIdle(false)
    startTimer()
  }, [startTimer])

  const resetTimer = useCallback(() => {
    setIsIdle(false)
    startTimer()
  }, [startTimer])

  useEffect(() => {
    startTimer()

    window.addEventListener("mousemove", handleActivity)
    window.addEventListener("keydown", handleActivity)
    window.addEventListener("click", handleActivity)
    window.addEventListener("scroll", handleActivity)
    window.addEventListener("touchstart", handleActivity)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      window.removeEventListener("mousemove", handleActivity)
      window.removeEventListener("keydown", handleActivity)
      window.removeEventListener("click", handleActivity)
      window.removeEventListener("scroll", handleActivity)
      window.removeEventListener("touchstart", handleActivity)
    }
  }, [handleActivity, startTimer])

  return { isIdle, resetTimer }
}
