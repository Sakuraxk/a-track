import { create } from "zustand"

import type {
  ClarificationSession,
  LearningPathMap,
  PreferenceSnapshotPayload,
  SkillTreeSnapshot,
} from "@/lib/learningPathWorkbench"

export type NodePreference = "known" | "target" | "avoid" | null

type WorkbenchState = {
  subjectKey: string | null
  map: LearningPathMap | null
  session: ClarificationSession | null
  ready: {
    ready: boolean
    missing_items: string[]
    summary: string
  } | null
  selectedNodeId: string | null
  searchTerm: string
  preferences: PreferenceSnapshotPayload
  snapshots: SkillTreeSnapshot[]
  activeSnapshotId: string | null
  setSubject: (subjectKey: string) => void
  setMap: (map: LearningPathMap | null) => void
  setSession: (session: ClarificationSession | null) => void
  setReady: (ready: WorkbenchState["ready"]) => void
  setSelectedNodeId: (nodeId: string | null) => void
  setSearchTerm: (value: string) => void
  setFreeTextNotes: (notes: string) => void
  setNodePreference: (nodeId: string, preference: NodePreference) => void
  setSnapshots: (snapshots: SkillTreeSnapshot[]) => void
  setActiveSnapshotId: (id: string | null) => void
  reset: () => void
}

const emptyPreferences = (): PreferenceSnapshotPayload => ({
  known_node_ids: [],
  target_node_ids: [],
  avoid_node_ids: [],
  free_text_notes: "",
})

function removeNode(values: string[], nodeId: string) {
  return values.filter((value) => value !== nodeId)
}

export const useLearningPathWorkbenchStore = create<WorkbenchState>((set) => ({
  subjectKey: null,
  map: null,
  session: null,
  ready: null,
  selectedNodeId: null,
  searchTerm: "",
  preferences: emptyPreferences(),
  snapshots: [],
  activeSnapshotId: null,

  setSubject: (subjectKey) =>
    set({
      subjectKey,
      map: null,
      session: null,
      ready: null,
      selectedNodeId: null,
      searchTerm: "",
      preferences: emptyPreferences(),
      snapshots: [],
      activeSnapshotId: null,
    }),

  setMap: (map) => set({ map, activeSnapshotId: map?.snapshot_id ?? null }),
  setSession: (session) => set({ session }),
  setReady: (ready) => set({ ready }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setFreeTextNotes: (notes) =>
    set((state) => ({
      preferences: {
        ...state.preferences,
        free_text_notes: notes,
      },
    })),
  setNodePreference: (nodeId, preference) =>
    set((state) => {
      const nextPreferences = {
        known_node_ids: removeNode(state.preferences.known_node_ids, nodeId),
        target_node_ids: removeNode(state.preferences.target_node_ids, nodeId),
        avoid_node_ids: removeNode(state.preferences.avoid_node_ids, nodeId),
        free_text_notes: state.preferences.free_text_notes ?? "",
      }

      if (preference === "known") {
        nextPreferences.known_node_ids = [...nextPreferences.known_node_ids, nodeId]
      }
      if (preference === "target") {
        nextPreferences.target_node_ids = [...nextPreferences.target_node_ids, nodeId]
      }
      if (preference === "avoid") {
        nextPreferences.avoid_node_ids = [...nextPreferences.avoid_node_ids, nodeId]
      }

      return {
        preferences: nextPreferences,
      }
    }),
  setSnapshots: (snapshots) => set({ snapshots }),
  setActiveSnapshotId: (activeSnapshotId) => set({ activeSnapshotId }),
  reset: () =>
    set({
      subjectKey: null,
      map: null,
      session: null,
      ready: null,
      selectedNodeId: null,
      searchTerm: "",
      preferences: emptyPreferences(),
      snapshots: [],
      activeSnapshotId: null,
    }),
}))

export function getNodePreference(nodeId: string, preferences: PreferenceSnapshotPayload): NodePreference {
  if (preferences.known_node_ids.includes(nodeId)) return "known"
  if (preferences.target_node_ids.includes(nodeId)) return "target"
  if (preferences.avoid_node_ids.includes(nodeId)) return "avoid"
  return null
}

export function getSelectedNode(
  node: LearningPathMap["tree"] | null,
  nodeId: string | null,
): LearningPathMap["tree"] | null {
  if (!node || !nodeId) return null
  if (node.id === nodeId) return node

  for (const child of node.children) {
    const match = getSelectedNode(child, nodeId)
    if (match) return match
  }

  return null
}
