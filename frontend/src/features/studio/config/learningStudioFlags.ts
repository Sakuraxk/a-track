export interface LearningStudioFlags {
  conceptAutoDiagram: boolean
}

export const LEARNING_STUDIO_FLAGS_STORAGE_KEY = "learning-studio.flags"

export const DEFAULT_LEARNING_STUDIO_FLAGS: LearningStudioFlags = {
  conceptAutoDiagram: true,
}

function normalizeFlags(raw: unknown): LearningStudioFlags {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_LEARNING_STUDIO_FLAGS }
  }

  const flags = raw as Partial<LearningStudioFlags>
  return {
    conceptAutoDiagram:
      typeof flags.conceptAutoDiagram === "boolean"
        ? flags.conceptAutoDiagram
        : DEFAULT_LEARNING_STUDIO_FLAGS.conceptAutoDiagram,
  }
}

export function getLearningStudioFlags(): LearningStudioFlags {
  if (typeof window === "undefined") {
    return { ...DEFAULT_LEARNING_STUDIO_FLAGS }
  }

  try {
    const raw = window.localStorage.getItem(LEARNING_STUDIO_FLAGS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_LEARNING_STUDIO_FLAGS }
    return normalizeFlags(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_LEARNING_STUDIO_FLAGS }
  }
}

export function setLearningStudioFlags(next: Partial<LearningStudioFlags>) {
  if (typeof window === "undefined") return
  const merged = { ...getLearningStudioFlags(), ...next }
  window.localStorage.setItem(LEARNING_STUDIO_FLAGS_STORAGE_KEY, JSON.stringify(merged))
}

export function isConceptAutoDiagramEnabled() {
  return getLearningStudioFlags().conceptAutoDiagram
}

export function setConceptAutoDiagramEnabled(enabled: boolean) {
  setLearningStudioFlags({ conceptAutoDiagram: enabled })
}
