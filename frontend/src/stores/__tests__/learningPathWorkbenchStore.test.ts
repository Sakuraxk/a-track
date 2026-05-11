import { beforeEach, describe, expect, it } from "vitest"

import { useLearningPathWorkbenchStore } from "@/stores/learning-path-workbench"

describe("learningPathWorkbenchStore", () => {
  beforeEach(() => {
    useLearningPathWorkbenchStore.getState().reset()
  })

  it("resets node preferences when entering the same subject again", () => {
    const store = useLearningPathWorkbenchStore.getState()

    store.setSubject("python")
    store.setNodePreference("python.syntax.variables", "target")
    expect(useLearningPathWorkbenchStore.getState().preferences.target_node_ids).toEqual([
      "python.syntax.variables",
    ])

    useLearningPathWorkbenchStore.getState().setSubject("python")

    expect(useLearningPathWorkbenchStore.getState().preferences.target_node_ids).toEqual([])
    expect(useLearningPathWorkbenchStore.getState().preferences.known_node_ids).toEqual([])
    expect(useLearningPathWorkbenchStore.getState().preferences.avoid_node_ids).toEqual([])
    expect(useLearningPathWorkbenchStore.getState().selectedNodeId).toBeNull()
  })
})
