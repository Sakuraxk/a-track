import { useCallback, useEffect, useState } from "react"
import type { Dispatch, SetStateAction } from "react"

import type {
  LearningWorkstationState,
  RenderStateInput,
} from "@/features/studio/components/workstation/workstationTypes"

const WORKSTATION_OVERRIDE_STORAGE_KEY = "learning-workstation-override-state"

function buildOverrideStorageKey(storageScope?: string) {
  return storageScope
    ? `${WORKSTATION_OVERRIDE_STORAGE_KEY}:${storageScope}`
    : WORKSTATION_OVERRIDE_STORAGE_KEY
}

function isLearningWorkstationState(
  value: string | null,
): value is LearningWorkstationState {
  return value === "progress" || value === "practice" || value === "review"
}

function readPersistedOverrideStateForScope(
  storageScope?: string,
): LearningWorkstationState | null {
  if (typeof window === "undefined") {
    return null
  }

  const storedValue = window.sessionStorage.getItem(
    buildOverrideStorageKey(storageScope),
  )

  return isLearningWorkstationState(storedValue) ? storedValue : null
}

function writePersistedOverrideState(
  nextState: LearningWorkstationState | null,
  storageScope?: string,
) {
  if (typeof window === "undefined") {
    return
  }

  const storageKey = buildOverrideStorageKey(storageScope)

  if (nextState === null) {
    window.sessionStorage.removeItem(storageKey)
    return
  }

  window.sessionStorage.setItem(storageKey, nextState)
}

export type WorkstationStateController = {
  systemState: LearningWorkstationState
  previewState: LearningWorkstationState | null
  overrideState: LearningWorkstationState | null
  renderState: LearningWorkstationState
  setPreviewState: Dispatch<SetStateAction<LearningWorkstationState | null>>
  setOverrideState: Dispatch<SetStateAction<LearningWorkstationState | null>>
  clearManualState: () => void
}

export function resolveRenderState(
  input: RenderStateInput,
): LearningWorkstationState {
  return input.overrideState ?? input.previewState ?? input.systemState
}

export function useLearningWorkstationState(
  systemState: LearningWorkstationState,
  storageScope?: string,
): WorkstationStateController {
  const [previewState, setPreviewState] =
    useState<LearningWorkstationState | null>(null)
  const [overrideState, setOverrideState] =
    useState<LearningWorkstationState | null>(() =>
      readPersistedOverrideStateForScope(storageScope),
    )

  const setOverrideStateWithPersistence = useCallback<
    Dispatch<SetStateAction<LearningWorkstationState | null>>
  >((nextState) => {
    setOverrideState((previousState) => {
      const resolvedState =
        typeof nextState === "function" ? nextState(previousState) : nextState
      writePersistedOverrideState(resolvedState, storageScope)
      return resolvedState
    })
  }, [storageScope])

  useEffect(() => {
    setOverrideState(readPersistedOverrideStateForScope(storageScope))
  }, [storageScope])

  const renderState = resolveRenderState({
    systemState,
    previewState,
    overrideState,
  })

  const clearManualState = useCallback(() => {
    setPreviewState(null)
    setOverrideState(null)
    writePersistedOverrideState(null, storageScope)
  }, [storageScope])

  return {
    systemState,
    previewState,
    overrideState,
    renderState,
    setPreviewState,
    setOverrideState: setOverrideStateWithPersistence,
    clearManualState,
  }
}
