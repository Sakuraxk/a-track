import type { DiagramSpec, DiagramType, ParsedDiagramSpecResult } from "@/features/studio/diagram/types"

const DIAGRAM_BLOCK_PATTERN = /```diagram-spec\s*([\s\S]*?)```/gi
const SUPPORTED_DIAGRAM_TYPES: DiagramType[] = ["flow", "compare", "timeline", "structure"]

function isObjectPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSupportedDiagramType(value: unknown): value is DiagramType {
  return typeof value === "string" && SUPPORTED_DIAGRAM_TYPES.includes(value as DiagramType)
}

function toDiagramSpec(raw: unknown): DiagramSpec | null {
  if (!isObjectPayload(raw)) return null
  if (!isSupportedDiagramType(raw.diagram_type)) return null
  if (typeof raw.title !== "string" || raw.title.trim().length === 0) return null
  if (!isObjectPayload(raw.payload)) return null

  const sectionKey = typeof raw.section_key === "string" && raw.section_key.trim().length > 0
    ? raw.section_key.trim()
    : undefined

  return {
    diagram_type: raw.diagram_type,
    title: raw.title.trim(),
    payload: raw.payload,
    section_key: sectionKey,
  }
}

export function parseDiagramSpec(markdown: string): ParsedDiagramSpecResult {
  const specs: DiagramSpec[] = []
  let content = markdown

  for (const match of markdown.matchAll(DIAGRAM_BLOCK_PATTERN)) {
    const jsonText = match[1]?.trim()
    if (!jsonText) continue

    try {
      const parsed = JSON.parse(jsonText)
      const spec = toDiagramSpec(parsed)
      if (spec) {
        specs.push(spec)
      }
    } catch {
      // Ignore malformed diagram JSON blocks and keep markdown readable.
    }
  }

  content = content
    .replace(DIAGRAM_BLOCK_PATTERN, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return {
    content,
    specs,
  }
}

export function extractDiagramSpecBlocks(markdown: string): string[] {
  const blocks: string[] = []
  const pattern = new RegExp(DIAGRAM_BLOCK_PATTERN.source, DIAGRAM_BLOCK_PATTERN.flags)

  for (const match of markdown.matchAll(pattern)) {
    const rawBlock = match[0]?.trim()
    if (rawBlock) {
      blocks.push(rawBlock)
    }
  }

  return blocks
}
