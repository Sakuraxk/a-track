import type { LearningWorkstationState } from "@/features/studio/components/workstation/workstationTypes"

export type IslandPanelState =
  | "collapsed"
  | "preview"
  | "expanded"
  | "pinned"
  | "closing"

export type IslandHoverArea = "trigger" | "panel" | "safe-zone"

export type PointerPosition = {
  x: number
  y: number
}

export type SafeTriangle = {
  apex: PointerPosition
  left: PointerPosition
  right: PointerPosition
}

export const HOVER_INTENT_MS = 400
export const CLOSE_TRANSITION_MS = 16

export const ISLAND_FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export type TransitionIntent = "none" | "daybreak" | "inherit-hero"

export function getHoverEnterState(
  mode: LearningWorkstationState,
): IslandPanelState {
  return mode === "practice" ? "preview" : "expanded"
}

export function isIslandPanelOpen(state: IslandPanelState): boolean {
  return state === "expanded" || state === "pinned" || state === "closing"
}

export function shouldKeepIslandOpen(
  activeAreas: Record<IslandHoverArea, boolean>,
): boolean {
  return activeAreas.trigger || activeAreas.panel || activeAreas["safe-zone"]
}

export function getTransitionIntent(
  previousState: LearningWorkstationState | null,
  nextState: LearningWorkstationState,
): TransitionIntent {
  if (previousState === "review" && nextState === "progress") {
    return "daybreak"
  }

  return "none"
}

export function buildSafeTriangle(
  pointer: PointerPosition,
  panelRect: DOMRect,
): SafeTriangle {
  return {
    apex: pointer,
    left: { x: panelRect.left, y: panelRect.top },
    right: { x: panelRect.right, y: panelRect.top },
  }
}

function getTriangleArea(
  first: PointerPosition,
  second: PointerPosition,
  third: PointerPosition,
): number {
  return Math.abs(
    (first.x * (second.y - third.y) +
      second.x * (third.y - first.y) +
      third.x * (first.y - second.y)) /
      2,
  )
}

export function isPointInsideSafeTriangle(
  point: PointerPosition,
  triangle: SafeTriangle,
): boolean {
  const totalArea = getTriangleArea(triangle.apex, triangle.left, triangle.right)
  const splitArea =
    getTriangleArea(point, triangle.left, triangle.right) +
    getTriangleArea(triangle.apex, point, triangle.right) +
    getTriangleArea(triangle.apex, triangle.left, point)

  return Math.abs(totalArea - splitArea) < 0.5
}
