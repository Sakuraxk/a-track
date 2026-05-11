export type DiagramType = "flow" | "compare" | "timeline" | "structure"

export interface DiagramSpec {
  diagram_type: DiagramType
  title: string
  payload: Record<string, unknown>
  section_key?: string
}

export interface ParsedDiagramSpecResult {
  content: string
  specs: DiagramSpec[]
}
