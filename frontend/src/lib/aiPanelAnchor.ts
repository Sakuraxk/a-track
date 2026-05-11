import { useEffect, useRef, useState } from "react"

export const AI_PANEL_TOP_OFFSET_CSS_VAR = "--ai-panel-top-offset"
export const AI_PANEL_OFFSET_CHANGE_EVENT = "ai-panel-offset-change"

function dispatchAIPanelOffsetChange() {
  window.dispatchEvent(new Event(AI_PANEL_OFFSET_CHANGE_EVENT))
}

export function readAIPanelTopOffset() {
  if (typeof document === "undefined") return 16
  const raw = document.documentElement.style.getPropertyValue(AI_PANEL_TOP_OFFSET_CSS_VAR).trim()
  const parsed = Number.parseInt(raw.replace("px", ""), 10)
  return Number.isFinite(parsed) ? parsed : 16
}

export function publishAIPanelTopOffset(offset: number) {
  if (typeof document === "undefined" || typeof window === "undefined") return
  document.documentElement.style.setProperty(AI_PANEL_TOP_OFFSET_CSS_VAR, `${offset}px`)
  dispatchAIPanelOffsetChange()
}

export function clearAIPanelTopOffset() {
  if (typeof document === "undefined" || typeof window === "undefined") return
  document.documentElement.style.removeProperty(AI_PANEL_TOP_OFFSET_CSS_VAR)
  dispatchAIPanelOffsetChange()
}

export function useAIPanelAnchor<T extends HTMLElement>(active = true) {
  const anchorRef = useRef<T | null>(null)

  useEffect(() => {
    if (!active) return

    const updatePanelOffset = () => {
      const bottom = anchorRef.current?.getBoundingClientRect().bottom ?? 0
      const nextOffset = Math.max(16, Math.ceil(bottom) + 8)
      publishAIPanelTopOffset(nextOffset)
    }

    updatePanelOffset()
    const observer = typeof ResizeObserver !== "undefined" && anchorRef.current
      ? new ResizeObserver(() => updatePanelOffset())
      : null

    if (anchorRef.current) {
      observer?.observe(anchorRef.current)
    }
    window.addEventListener("resize", updatePanelOffset)

    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", updatePanelOffset)
      clearAIPanelTopOffset()
    }
  }, [active])

  return anchorRef
}

export function useAIPanelTopOffset(watchKey?: string) {
  const [topOffset, setTopOffset] = useState(16)

  useEffect(() => {
    const syncTopOffset = () => {
      setTopOffset(readAIPanelTopOffset())
    }

    syncTopOffset()
    const rafId = window.requestAnimationFrame(syncTopOffset)
    window.addEventListener(AI_PANEL_OFFSET_CHANGE_EVENT, syncTopOffset)
    window.addEventListener("resize", syncTopOffset)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener(AI_PANEL_OFFSET_CHANGE_EVENT, syncTopOffset)
      window.removeEventListener("resize", syncTopOffset)
    }
  }, [watchKey])

  return topOffset
}
