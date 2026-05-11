import { api } from "@/lib/api"

export type PromptListItem = {
  name: string
  description: string
  has_system_template: boolean
  temperature: number
  max_tokens: number
  output_format: string
}

export type PromptVersion = {
  version_id: string
  created_at: string
  note: string
  restored_from: string | null
}

export type PromptIssue = {
  id: string
  severity: "high" | "medium" | "low"
  title: string
  problem: string
  suggestion: string
  target_section: "system" | "user" | "params"
  matched_text: string
  replacement_text?: string | null
}

export type PromptDraftDiff = {
  target_section: "system" | "user" | "params"
  before: string
  after: string
}

export type PromptDimension = {
  name: string
  score: number
  reason: string
}

export type PromptQualityReport = {
  score: number
  grade: string
  dimensions: PromptDimension[]
  issues: PromptIssue[]
  summary: string
  improvement_suggestions: string[]
}

export type PromptFixtureExample = {
  name: string
  data: Record<string, unknown>
}

export type PromptDetail = {
  name: string
  description: string
  system_template: string | null
  user_template: string
  temperature: number
  max_tokens: number
  output_format: string
  required_variables: string[]
  suggested_variables: Record<string, unknown>
  fixtures: string[]
  fixture_examples?: PromptFixtureExample[]
  versions: PromptVersion[]
}

export type RenderPromptPayload = {
  variables: Record<string, unknown>
  system_template?: string | null
  user_template?: string | null
}

export type RunPromptPayload = RenderPromptPayload & {
  temperature?: number
  max_tokens?: number
}

export type SavePromptPayload = {
  description: string
  system_template?: string | null
  user_template: string
  temperature: number
  max_tokens: number
  output_format: string
  note: string
}

export type AnalyzePromptPayload = {
  system_template?: string | null
  user_template?: string | null
}

export type OptimizePromptPayload = AnalyzePromptPayload & {
  focus?: string
  variables?: Record<string, unknown>
}

export async function listPrompts(): Promise<{ prompts: PromptListItem[] }> {
  const response = await api.get<{ prompts: PromptListItem[] }>("/api/dev/prompts")
  return response.data
}

export async function getPromptDetail(promptName: string): Promise<{ prompt: PromptDetail }> {
  const response = await api.get<{ prompt: PromptDetail }>(`/api/dev/prompts/${promptName}`)
  return response.data
}

export async function renderPromptPreview(
  promptName: string,
  payload: RenderPromptPayload
): Promise<{ messages: Array<{ role: string; content: string }> }> {
  const response = await api.post<{ messages: Array<{ role: string; content: string }> }>(
    `/api/dev/prompts/${promptName}/render`,
    payload
  )
  return response.data
}

export async function runPrompt(
  promptName: string,
  payload: RunPromptPayload
): Promise<{ messages: Array<{ role: string; content: string }>; content: string; model: string }> {
  const response = await api.post<{ messages: Array<{ role: string; content: string }>; content: string; model: string }>(
    `/api/dev/prompts/${promptName}/run`,
    payload
  )
  return response.data
}

export async function savePrompt(
  promptName: string,
  payload: SavePromptPayload
): Promise<{ prompt: PromptDetail; version: PromptVersion }> {
  const response = await api.put<{ prompt: PromptDetail; version: PromptVersion }>(
    `/api/dev/prompts/${promptName}`,
    payload
  )
  return response.data
}

export async function diffPromptVersions(
  promptName: string,
  leftVersionId: string,
  rightVersionId: string
): Promise<{ diff: Record<string, string> }> {
  const response = await api.post<{ diff: Record<string, string> }>(`/api/dev/prompts/${promptName}/diff`, {
    left_version_id: leftVersionId,
    right_version_id: rightVersionId,
  })
  return response.data
}

export async function restorePromptVersion(
  promptName: string,
  versionId: string
): Promise<{ prompt: PromptDetail; version: PromptVersion }> {
  const response = await api.post<{ prompt: PromptDetail; version: PromptVersion }>(
    `/api/dev/prompts/${promptName}/restore/${versionId}`
  )
  return response.data
}

export async function analyzePrompt(
  promptName: string,
  payload: AnalyzePromptPayload
): Promise<{ report: PromptQualityReport }> {
  const response = await api.post<{ report: PromptQualityReport }>(
    `/api/dev/prompts/${promptName}/analyze`,
    payload
  )
  return response.data
}

export async function optimizePrompt(
  promptName: string,
  payload: OptimizePromptPayload
): Promise<{
  result: {
    optimized_system_template: string | null
    optimized_user_template: string
    change_summary: string
    optimization_notes: string
    quality_report: PromptQualityReport
  }
}> {
  const response = await api.post<{
    result: {
      optimized_system_template: string | null
      optimized_user_template: string
      change_summary: string
      optimization_notes: string
      quality_report: PromptQualityReport
    }
  }>(`/api/dev/prompts/${promptName}/optimize`, payload)
  return response.data
}

export async function applyPromptIssue(
  promptName: string,
  payload: {
    issue_id: string
    system_template?: string | null
    user_template?: string | null
  }
): Promise<{
  issue: PromptIssue
  draft: PromptDetail
  diff: PromptDraftDiff
}> {
  const response = await api.post<{
    issue: PromptIssue
    draft: PromptDetail
    diff: PromptDraftDiff
  }>(`/api/dev/prompts/${promptName}/issues/apply`, payload)
  return response.data
}
