export type LearningWorkstationState = "progress" | "practice" | "review"

export type RuntimeShellState = "preflight" | "loading" | "ready" | "degraded" | "error"

export type ActVisibility = "expanded" | "compressed" | "hidden"

export type RenderStateInput = {
  systemState: LearningWorkstationState
  previewState: LearningWorkstationState | null
  overrideState: LearningWorkstationState | null
}
