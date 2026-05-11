import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"

import { cn } from "@/lib/utils"

import { buildIslandCopy } from "@/features/studio/components/workstation/workstationCopy"
import {
  buildSafeTriangle,
  CLOSE_TRANSITION_MS,
  getHoverEnterState,
  HOVER_INTENT_MS,
  ISLAND_FOCUSABLE_SELECTOR,
  isPointInsideSafeTriangle,
  isIslandPanelOpen,
  shouldKeepIslandOpen,
} from "@/features/studio/components/workstation/workstationMotion"
import type {
  IslandHoverArea,
  IslandPanelState,
  PointerPosition,
  SafeTriangle,
} from "@/features/studio/components/workstation/workstationMotion"
import type { LearningWorkstationState } from "@/features/studio/components/workstation/workstationTypes"

type DynamicContextIslandProps = {
  mode: LearningWorkstationState
  stageTitle: string
  stageMeta: string
  statusLabel?: string
  detailLine?: string
  expanded?: boolean
  controlsId?: string
  onToggle?: () => void
  panelContent?: ReactNode
}

export function DynamicContextIsland(props: DynamicContextIslandProps) {
  const generatedControlsId = useId()
  const controlsId =
    props.controlsId ?? `dynamic-context-island-panel-${generatedControlsId}`
  const headingId = `${controlsId}-heading`
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const transitionTimerRef = useRef<number | null>(null)
  const shouldRestoreFocusRef = useRef(false)
  const pointerPositionRef = useRef<PointerPosition | null>(null)
  const safeTriangleRef = useRef<SafeTriangle | null>(null)
  const activeAreasRef = useRef<Record<IslandHoverArea, boolean>>({
    trigger: false,
    panel: false,
    "safe-zone": false,
  })
  const [panelState, setPanelState] = useState<IslandPanelState>(
    props.expanded ? "pinned" : "collapsed",
  )
  const copy = buildIslandCopy(props.mode, {
    statusLabel: props.statusLabel,
    detailLine: props.detailLine,
  })
  const isOpen = isIslandPanelOpen(panelState)
  const showCompactPractice = props.mode === "practice" && !isOpen
  const closeButtonId = `${controlsId}-close`

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const clearTransitionTimer = useCallback(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }
  }, [])

  const getFocusableElements = useCallback(() => {
    if (!panelRef.current) {
      return []
    }

    return Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(ISLAND_FOCUSABLE_SELECTOR),
    ).filter(
      (element) =>
        !element.hasAttribute("disabled") &&
        element.getAttribute("aria-hidden") !== "true" &&
        element.tabIndex >= 0,
    )
  }, [])

  const closePanel = useCallback(
    (restoreFocus: boolean) => {
      clearHoverTimer()
      clearCloseTimer()
      clearTransitionTimer()
      safeTriangleRef.current = null
      shouldRestoreFocusRef.current = restoreFocus
      setPanelState("closing")
      transitionTimerRef.current = window.setTimeout(() => {
        setPanelState("collapsed")
        if (shouldRestoreFocusRef.current) {
          triggerRef.current?.focus()
        }
        shouldRestoreFocusRef.current = false
      }, CLOSE_TRANSITION_MS)
    },
    [clearCloseTimer, clearHoverTimer, clearTransitionTimer],
  )

  const syncHoverArea = useCallback(
    (area: IslandHoverArea, active: boolean) => {
      activeAreasRef.current[area] = active

      if (active) {
        clearCloseTimer()
        return
      }

      if (panelState === "pinned") {
        return
      }

      clearCloseTimer()
      closeTimerRef.current = window.setTimeout(() => {
        const shouldStayOpen =
          shouldKeepIslandOpen(activeAreasRef.current) ||
          (pointerPositionRef.current !== null &&
            safeTriangleRef.current !== null &&
            isPointInsideSafeTriangle(
              pointerPositionRef.current,
              safeTriangleRef.current,
            ))

        if (!shouldStayOpen) {
          closePanel(false)
        }
      }, CLOSE_TRANSITION_MS)
    },
    [clearCloseTimer, closePanel, panelState],
  )

  const handlePointerEnterTrigger = useCallback(() => {
    syncHoverArea("trigger", true)
    clearHoverTimer()

    if (panelState === "pinned") {
      return
    }

    setPanelState(getHoverEnterState(props.mode))
    if (props.mode === "practice") {
      hoverTimerRef.current = window.setTimeout(() => {
        setPanelState("expanded")
      }, HOVER_INTENT_MS)
    }
  }, [clearHoverTimer, panelState, props.mode, syncHoverArea])

  const handleTriggerClick = useCallback(() => {
    props.onToggle?.()
    clearHoverTimer()
    clearCloseTimer()

    if (panelState === "pinned") {
      closePanel(true)
      return
    }

    setPanelState("pinned")
  }, [clearCloseTimer, clearHoverTimer, closePanel, panelState, props])

  const handlePanelKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Tab" || panelState !== "pinned" || !panelRef.current) {
        return
      }

      const focusableElements = getFocusableElements()

      if (focusableElements.length === 0) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement as HTMLElement | null

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    },
    [getFocusableElements, panelState],
  )

  useEffect(() => {
    return () => {
      clearHoverTimer()
      clearCloseTimer()
      clearTransitionTimer()
    }
  }, [clearCloseTimer, clearHoverTimer, clearTransitionTimer])

  useEffect(() => {
    if (panelState !== "pinned") {
      return
    }

    const focusableElements = getFocusableElements()
    if (
      panelRef.current &&
      document.activeElement &&
      !panelRef.current.contains(document.activeElement)
    ) {
      focusableElements[0]?.focus()
      return
    }

    focusableElements[0]?.focus()
  }, [getFocusableElements, panelState])

  useEffect(() => {
    if (panelState === "collapsed" || panelState === "pinned") {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      pointerPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      }
    }

    window.addEventListener("pointermove", handlePointerMove)
    return () => window.removeEventListener("pointermove", handlePointerMove)
  }, [panelState])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel(true)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [closePanel, isOpen])

  return (
    <div
      data-testid="dynamic-context-island"
      className="relative flex h-20 flex-col items-center motion-reduce:transition-none"
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        onPointerEnter={handlePointerEnterTrigger}
        onPointerLeave={(event) => {
          const pointer = { x: event.clientX, y: event.clientY }
          pointerPositionRef.current = pointer
          const buildTriangle = () => {
            if (!panelRef.current) {
              return
            }

            safeTriangleRef.current = buildSafeTriangle(
              pointer,
              panelRef.current.getBoundingClientRect(),
            )
          }

          if (panelRef.current) {
            buildTriangle()
          } else {
            window.requestAnimationFrame(buildTriangle)
          }
          syncHoverArea("trigger", false)
          clearHoverTimer()
        }}
        aria-controls={controlsId}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={cn(
          "group relative z-20 rounded-full",
          "backdrop-blur-xl transition-[transform,box-shadow,background-color,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          "[font-variant-numeric:tabular-nums]",
          props.mode === "progress" &&
            "bg-white/85 text-slate-900 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.1)] ring-1 ring-slate-900/5 supports-[backdrop-filter]:bg-white/60 hover:-translate-y-0.5 hover:bg-white",
          props.mode === "practice" &&
            "bg-slate-950/80 text-slate-300 shadow-[inset_0_1px_4px_rgba(255,255,255,0.1)] ring-1 ring-white/10 supports-[backdrop-filter]:bg-slate-950/50 hover:scale-[1.01] hover:bg-slate-900/90",
          props.mode === "review" &&
            "bg-slate-900/90 text-amber-50 shadow-[0_8px_32px_-4px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/30 supports-[backdrop-filter]:bg-slate-900/70 hover:-translate-y-0.5 hover:bg-slate-900",
        )}
      >
        {showCompactPractice ? (
          <span className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            {copy.statusLabel}
          </span>
        ) : (
          <span className="inline-flex flex-col items-start px-6 py-3">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.28em]",
                props.mode === "review" ? "text-amber-400/80" : "text-slate-500",
              )}
            >
              {copy.statusLabel}
            </span>
            <span className="mt-0.5 text-sm font-bold tracking-tight">
              {props.stageTitle}
            </span>
            <span
              className={cn(
                "mt-0.5 text-xs font-medium",
                props.mode === "review" ? "text-amber-100/60" : "text-slate-500",
              )}
            >
              {props.stageMeta}
            </span>
          </span>
        )}
      </button>
      {isOpen ? (
        <>
          <div
            aria-hidden="true"
            data-testid="island-safe-zone"
            onPointerEnter={() => syncHoverArea("safe-zone", true)}
            onPointerLeave={() => {
              safeTriangleRef.current = null
              syncHoverArea("safe-zone", false)
            }}
            className="absolute top-full z-10 h-6 w-40 bg-transparent"
          />
          <div
            ref={panelRef}
            data-testid="island-panel"
            id={controlsId}
            role="region"
            aria-labelledby={headingId}
            tabIndex={-1}
            onPointerEnter={() => syncHoverArea("panel", true)}
            onPointerLeave={() => {
              safeTriangleRef.current = null
              syncHoverArea("panel", false)
            }}
            onKeyDown={handlePanelKeyDown}
            className={cn(
              "absolute top-[calc(100%+1.5rem)] z-30 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-200/70",
              "bg-white/90 p-4 text-slate-950 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/70",
              "[font-variant-numeric:tabular-nums] origin-top transition-[opacity,transform,box-shadow] duration-300 ease-out motion-reduce:duration-75 motion-reduce:transition-none",
              panelState === "closing"
                ? "translate-y-2 scale-[0.98] opacity-0"
                : "translate-y-0 scale-100 opacity-100",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {copy.statusLabel}
                </p>
                <h3
                  id={headingId}
                  className="text-base font-semibold text-slate-950"
                >
                  {props.stageTitle}
                </h3>
                <p className="text-xs text-slate-500">{props.stageMeta}</p>
              </div>
              <button
                id={closeButtonId}
                type="button"
                onClick={() => closePanel(true)}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600"
              >
                收起
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600">{copy.detailLine}</p>
            {props.panelContent ? (
              <div className="mt-4 border-t border-slate-200/80 pt-4">
                {props.panelContent}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
