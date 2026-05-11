import { useEffect, useMemo, useState } from "react"
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileJson,
  GitCompare,
  History,
  Play,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  TestTube2,
} from "lucide-react"

import { getApiErrorMessage } from "@/lib/api"
import {
  applyPromptIssue,
  analyzePrompt,
  diffPromptVersions,
  getPromptDetail,
  listPrompts,
  optimizePrompt,
  renderPromptPreview,
  restorePromptVersion,
  runPrompt,
  savePrompt,
  type PromptDetail,
  type PromptDraftDiff,
  type PromptFixtureExample,
  type PromptListItem,
  type PromptQualityReport,
  type PromptVersion,
} from "@/lib/promptLabApi"

type EditorTab = "system" | "user" | "params"
type InspectorTab = "variables" | "render" | "run" | "versions"

const DEFAULT_VARIABLES = JSON.stringify({ subject_name: "Python" }, null, 2)

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

export default function PromptLab() {
  const [prompts, setPrompts] = useState<PromptListItem[]>([])
  const [selectedPromptName, setSelectedPromptName] = useState("")
  const [promptSearch, setPromptSearch] = useState("")
  const [detail, setDetail] = useState<PromptDetail | null>(null)
  const [description, setDescription] = useState("")
  const [systemTemplate, setSystemTemplate] = useState("")
  const [userTemplate, setUserTemplate] = useState("")
  const [temperature, setTemperature] = useState("0.7")
  const [maxTokens, setMaxTokens] = useState("2000")
  const [outputFormat, setOutputFormat] = useState("json")
  const [variablesJson, setVariablesJson] = useState(DEFAULT_VARIABLES)
  const [selectedFixtureName, setSelectedFixtureName] = useState("")
  const [note, setNote] = useState("")
  const [selectedVersionId, setSelectedVersionId] = useState("")
  const [preview, setPreview] = useState("")
  const [runResult, setRunResult] = useState("")
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [editorTab, setEditorTab] = useState<EditorTab>("user")
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("variables")
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false)
  const [analysisReport, setAnalysisReport] = useState<PromptQualityReport | null>(null)
  const [comparisonReport, setComparisonReport] = useState<{
    before: PromptQualityReport | null
    after: PromptQualityReport | null
  } | null>(null)
  const [optimizeFocus, setOptimizeFocus] = useState("")
  const [draftDiff, setDraftDiff] = useState<PromptDraftDiff | null>(null)

  const latestVersion = detail?.versions?.[0] ?? null

  const filteredPrompts = useMemo(() => {
    const keyword = promptSearch.trim().toLowerCase()
    if (!keyword) return prompts
    return prompts.filter((prompt) => `${prompt.name} ${prompt.description}`.toLowerCase().includes(keyword))
  }, [promptSearch, prompts])

  const variablesState = useMemo(() => {
    try {
      const parsed = JSON.parse(variablesJson) as Record<string, unknown>
      return { parsed, parseError: "" }
    } catch (err) {
      return { parsed: null, parseError: err instanceof Error ? err.message : "JSON 解析失败" }
    }
  }, [variablesJson])

  const missingVariables = useMemo(() => {
    if (!detail) return []
    if (!variablesState.parsed) return detail.required_variables
    return detail.required_variables.filter((key) => !(key in variablesState.parsed!))
  }, [detail, variablesState])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    void loadPrompts()
  }, [])

  useEffect(() => {
    if (!detail) return
    setDescription(detail.description)
    setSystemTemplate(detail.system_template ?? "")
    setUserTemplate(detail.user_template)
    setTemperature(String(detail.temperature))
    setMaxTokens(String(detail.max_tokens))
    setOutputFormat(detail.output_format)
    setSelectedVersionId(detail.versions?.[0]?.version_id ?? "")
    const firstFixture = detail.fixture_examples?.[0]
    if (firstFixture) {
      setSelectedFixtureName(firstFixture.name)
      setVariablesJson(prettyJson(firstFixture.data))
    } else {
      setVariablesJson(prettyJson(detail.suggested_variables))
    }
  }, [detail])

  async function loadPrompts() {
    try {
      setIsLoading(true)
      const data = await listPrompts()
      setPrompts(data.prompts)
      if (data.prompts.length > 0) {
        const firstPrompt = data.prompts[0].name
        setSelectedPromptName(firstPrompt)
        await loadPromptDetail(firstPrompt)
      }
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  async function loadPromptDetail(promptName: string) {
    try {
      const data = await getPromptDetail(promptName)
      setDetail(data.prompt)
      setPreview("")
      setRunResult("")
      setStatus("")
      setError("")
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  function ensureRenderableVariables() {
    if (variablesState.parseError) {
      throw new Error(`Variables JSON 解析失败：${variablesState.parseError}`)
    }
    if (missingVariables.length > 0) {
      throw new Error(`缺少必要变量：${missingVariables.join(", ")}`)
    }
    return variablesState.parsed as Record<string, unknown>
  }

  async function handleRender() {
    if (!selectedPromptName) return
    try {
      const variables = ensureRenderableVariables()
      setIsRendering(true)
      setError("")
      const data = await renderPromptPreview(selectedPromptName, {
        variables,
        system_template: systemTemplate || undefined,
        user_template: userTemplate,
      })
      setPreview(JSON.stringify(data.messages, null, 2))
      setRunResult("")
      setStatus("Render 完成")
      setInspectorTab("render")
    } catch (err) {
      setError(getApiErrorMessage(err))
      setInspectorTab("variables")
    } finally {
      setIsRendering(false)
    }
  }

  async function handleRun() {
    if (!selectedPromptName) return
    try {
      const variables = ensureRenderableVariables()
      setIsRunning(true)
      setError("")
      const data = await runPrompt(selectedPromptName, {
        variables,
        system_template: systemTemplate || undefined,
        user_template: userTemplate,
        temperature: Number(temperature),
        max_tokens: Number(maxTokens),
      })
      setPreview(JSON.stringify(data.messages, null, 2))
      setRunResult(data.content)
      setStatus(`模型返回完成：${data.model}`)
      setInspectorTab("run")
    } catch (err) {
      setError(getApiErrorMessage(err))
      setInspectorTab("variables")
    } finally {
      setIsRunning(false)
    }
  }

  async function handleSave() {
    if (!selectedPromptName) return
    try {
      setIsSaving(true)
      setError("")
      const data = await savePrompt(selectedPromptName, {
        description,
        system_template: systemTemplate || null,
        user_template: userTemplate,
        temperature: Number(temperature),
        max_tokens: Number(maxTokens),
        output_format: outputFormat,
        note,
      })
      setDetail(data.prompt)
      setStatus(`保存成功，最新版本：${data.version.version_id}`)
      setNote("")
      setInspectorTab("versions")
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDiff() {
    if (!selectedPromptName || !selectedVersionId || !latestVersion) return
    try {
      setError("")
      const compareWith = selectedVersionId === latestVersion.version_id && detail?.versions?.[1]
        ? detail.versions[1].version_id
        : selectedVersionId
      const data = await diffPromptVersions(selectedPromptName, compareWith, latestVersion.version_id)
      setPreview(data.diff.system_template || "")
      setRunResult(data.diff.user_template || "")
      setStatus(`已生成版本差异：${compareWith} vs ${latestVersion.version_id}`)
      setInspectorTab("versions")
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  async function handleRestore() {
    if (!selectedPromptName || !selectedVersionId) return
    try {
      setError("")
      const data = await restorePromptVersion(selectedPromptName, selectedVersionId)
      setDetail(data.prompt)
      setStatus(`已恢复版本：${selectedVersionId}，最新版本：${data.version.version_id}`)
      setInspectorTab("versions")
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  function applyFixture(fixture: PromptFixtureExample) {
    setSelectedFixtureName(fixture.name)
    setVariablesJson(prettyJson(fixture.data))
    setStatus(`已载入变量样例：${fixture.name}`)
    setError("")
  }

  async function handleAnalyze() {
    if (!selectedPromptName) return
    try {
      setIsAnalysisOpen(true)
      setIsAnalyzing(true)
      setError("")
      const data = await analyzePrompt(selectedPromptName, {
        system_template: systemTemplate || undefined,
        user_template: userTemplate,
      })
      setAnalysisReport(data.report)
      setComparisonReport(null)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function handleOptimize() {
    if (!selectedPromptName) return
    try {
      const variables = variablesState.parsed ?? {}
      setIsOptimizing(true)
      setError("")
      const data = await optimizePrompt(selectedPromptName, {
        system_template: systemTemplate || undefined,
        user_template: userTemplate,
        focus: optimizeFocus,
        variables,
      })
      setDraftDiff({
        target_section: data.result.optimized_system_template ? "system" : "user",
        before: data.result.optimized_system_template ? (systemTemplate || "") : userTemplate,
        after: data.result.optimized_system_template ?? data.result.optimized_user_template,
      })
      setSystemTemplate(data.result.optimized_system_template ?? "")
      setUserTemplate(data.result.optimized_user_template)
      setComparisonReport({
        before: analysisReport,
        after: data.result.quality_report,
      })
      setAnalysisReport(data.result.quality_report)
      setStatus(`优化完成：${data.result.change_summary}`)
      setEditorTab(data.result.optimized_system_template ? "system" : "user")
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setIsOptimizing(false)
    }
  }

  async function handleApplyIssue(issueId: string) {
    if (!selectedPromptName) return
    try {
      setError("")
      const data = await applyPromptIssue(selectedPromptName, {
        issue_id: issueId,
        system_template: systemTemplate || undefined,
        user_template: userTemplate,
      })
      setDraftDiff(data.diff)
      setDetail(data.draft)
      setSystemTemplate(data.draft.system_template ?? "")
      setUserTemplate(data.draft.user_template)
      setEditorTab(data.diff.target_section === "system" ? "system" : "user")
      setStatus(`已应用建议：${data.issue.title}`)
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  function renderDiffLines(diff: PromptDraftDiff | null) {
    if (!diff) return null
    const beforeLines = diff.before.split("\n")
    const afterLines = diff.after.split("\n")
    const max = Math.max(beforeLines.length, afterLines.length)
    const rows = []
    for (let index = 0; index < max; index += 1) {
      const beforeLine = beforeLines[index]
      const afterLine = afterLines[index]
      if (beforeLine === afterLine) {
        rows.push(
          <div key={`same-${index}`} className="rounded-lg px-3 py-1.5 text-slate-400">
            {beforeLine || <span className="opacity-40">空行</span>}
          </div>
        )
      } else {
        if (typeof beforeLine === "string") {
          rows.push(
            <div key={`before-${index}`} className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-rose-200 line-through">
              {beforeLine || <span className="opacity-40">空行</span>}
            </div>
          )
        }
        if (typeof afterLine === "string") {
          rows.push(
            <div key={`after-${index}`} className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-emerald-100">
              {afterLine || <span className="opacity-40">空行</span>}
            </div>
          )
        }
      }
    }
    return rows
  }

  if (!import.meta.env.DEV) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">Prompt Lab 仅在开发环境可用。</div>
  }

  return (
    <div className="min-h-[calc(100vh-10rem)] rounded-2xl border border-slate-800 bg-[#0b1020] text-slate-100 shadow-[0_30px_80px_rgba(15,23,42,0.45)]">
      <div className="border-b border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_32%),linear-gradient(180deg,_rgba(15,23,42,0.92),_rgba(6,11,23,0.98))] px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
              <TestTube2 className="h-3.5 w-3.5" />
              提示词实验室 / 仅开发环境
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">提示词实验室</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              面向开发调试的提示词工作台。左侧选择提示词，中间编辑模板，右侧进行渲染、联调、版本对比与变量检查。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button type="button" onClick={() => void handleAnalyze()} className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-400/40 hover:bg-slate-900">提示词质量分析</button>
            <button type="button" onClick={() => void handleOptimize()} disabled={isOptimizing || !selectedPromptName} className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-400/15">{isOptimizing ? "优化中..." : "一键优化"}</button>
            <button type="button" onClick={() => void handleRender()} disabled={isRendering || !selectedPromptName} className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-slate-900">渲染提示词</button>
            <button type="button" onClick={() => void handleRun()} disabled={isRunning || !selectedPromptName} className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">运行系统模型</button>
            <button type="button" onClick={() => void handleSave()} disabled={isSaving || !selectedPromptName} className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300">保存并创建版本</button>
            <button type="button" onClick={() => { if (detail?.fixture_examples?.[0]) applyFixture(detail.fixture_examples[0]) }} className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/40 hover:bg-slate-900">重置样例</button>
          </div>
        </div>
        {(error || status) && (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
            {status && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{status}</div>}
          </div>
        )}
      </div>

      <div className={`grid min-h-[calc(100vh-18rem)] grid-cols-1 ${isSidebarCollapsed ? "xl:grid-cols-[88px_minmax(0,1.25fr)_minmax(340px,0.95fr)]" : "xl:grid-cols-[280px_minmax(0,1.25fr)_minmax(340px,0.95fr)]"}`}>
        <aside data-testid="prompt-lab-sidebar" data-collapsed={isSidebarCollapsed ? "true" : "false"} className="border-b border-slate-800 bg-slate-950/65 xl:border-b-0 xl:border-r">
          <div className="sticky top-0 border-b border-slate-800 bg-slate-950/90 px-4 py-4 backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-3">
              {!isSidebarCollapsed && <div className="text-xs uppercase tracking-[0.2em] text-slate-500">提示词导航</div>}
              <button
                type="button"
                aria-label="折叠菜单"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                className="rounded-xl border border-slate-700 bg-slate-900/80 p-2 text-slate-300 transition hover:border-cyan-400/40 hover:text-white"
              >
                {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={promptSearch} onChange={(e) => setPromptSearch(e.target.value)} placeholder={isSidebarCollapsed ? "" : "搜索提示词..."} className={`w-full rounded-2xl border border-slate-700 bg-slate-900/80 py-3 ${isSidebarCollapsed ? "px-3" : "pl-10 pr-4"} text-sm text-slate-100 outline-none transition focus:border-cyan-400/40`} />
            </div>
          </div>
          <div className="max-h-[calc(100vh-23rem)] space-y-2 overflow-y-auto px-4 py-4">
            {isLoading ? (
              <p className="text-sm text-slate-400">加载中...</p>
            ) : (
              filteredPrompts.map((prompt) => {
                const isActive = selectedPromptName === prompt.name
                return (
                  <button key={prompt.name} type="button" title={prompt.name} onClick={() => { setSelectedPromptName(prompt.name); void loadPromptDetail(prompt.name) }} className={`w-full rounded-2xl border ${isSidebarCollapsed ? "px-3 py-4" : "px-4 py-4"} text-left transition ${isActive ? "border-cyan-400/40 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]" : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{isSidebarCollapsed ? prompt.name.split(".").slice(-1)[0] : prompt.name}</div>
                        {!isSidebarCollapsed && <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{prompt.description}</div>}
                      </div>
                      {!isSidebarCollapsed && <div className="rounded-xl border border-slate-700 bg-slate-950/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">{prompt.output_format}</div>}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <section className="border-b border-slate-800 bg-[#0f172a] xl:border-b-0 xl:border-r">
          <div className="border-b border-slate-800 px-5 py-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">编辑区</div>
                <div className="mt-1 text-lg font-bold text-white">{selectedPromptName || "请选择提示词"}</div>
              </div>
              {latestVersion && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">最新版本：{latestVersion.version_id}</div>}
            </div>
            <div className="flex flex-wrap gap-2">
              {[{ key: "system", label: "系统提示词", icon: Settings }, { key: "user", label: "用户提示词", icon: BookOpen }, { key: "params", label: "参数设置", icon: FileJson }].map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => setEditorTab(key as EditorTab)} className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${editorTab === key ? "bg-white text-slate-950" : "border border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600"}`}>
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[calc(100vh-23rem)] overflow-y-auto p-5">
            {editorTab === "system" && (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-300">描述<input className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
                <label className="block text-sm font-medium text-slate-300">系统提示词模板<textarea className="mt-2 min-h-[420px] w-full rounded-2xl border border-slate-700 bg-[#020617] px-4 py-4 font-mono text-sm leading-6 text-cyan-50" value={systemTemplate} onChange={(e) => setSystemTemplate(e.target.value)} /></label>
                {draftDiff?.target_section === "system" && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="mb-3 text-sm font-semibold text-white">草稿变更高亮</div>
                    <div className="space-y-2 text-sm leading-6">{renderDiffLines(draftDiff)}</div>
                  </div>
                )}
              </div>
            )}
            {editorTab === "user" && (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-300">描述<input className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
                <label className="block text-sm font-medium text-slate-300">用户提示词模板<textarea className="mt-2 min-h-[480px] w-full rounded-2xl border border-slate-700 bg-[#020617] px-4 py-4 font-mono text-sm leading-6 text-emerald-50" value={userTemplate} onChange={(e) => setUserTemplate(e.target.value)} /></label>
                {draftDiff?.target_section === "user" && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="mb-3 text-sm font-semibold text-white">草稿变更高亮</div>
                    <div className="space-y-2 text-sm leading-6">{renderDiffLines(draftDiff)}</div>
                  </div>
                )}
              </div>
            )}
            {editorTab === "params" && (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-300">温度系数<input data-testid="prompt-temperature-input" aria-label="温度系数" className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100" value={temperature} onChange={(e) => setTemperature(e.target.value)} /></label>
                  <label className="block text-sm font-medium text-slate-300">最大 Token<input aria-label="最大 Token" className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} /></label>
                </div>
                <label className="block text-sm font-medium text-slate-300">输出格式<input className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100" value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)} /></label>
                <label className="block text-sm font-medium text-slate-300">版本备注<input className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：提高严格 JSON 约束" /></label>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                  <div className="mb-3 flex items-center gap-2 text-slate-100"><Sparkles className="h-4 w-4 text-cyan-300" />当前提示词参数</div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                    <div>必填变量数</div>
                    <div className="text-right text-slate-100">{detail?.required_variables.length ?? 0}</div>
                    <div>样例数量</div>
                    <div className="text-right text-slate-100">{detail?.fixture_examples?.length ?? 0}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="bg-[#08111f]">
          <div className="border-b border-slate-800 px-5 py-4">
            <div className="mb-4 text-xs uppercase tracking-[0.24em] text-slate-500">检查区</div>
            <div className="flex flex-wrap gap-2">
              {[{ key: "variables", label: "变量", icon: Sparkles }, { key: "render", label: "渲染结果", icon: Eye }, { key: "run", label: "模型输出", icon: Play }, { key: "versions", label: "版本", icon: History }].map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => setInspectorTab(key as InspectorTab)} className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${inspectorTab === key ? "bg-cyan-400 text-slate-950" : "border border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600"}`}>
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[calc(100vh-23rem)] overflow-y-auto p-5">
            {inspectorTab === "variables" && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">样例集</div>
                    <div className="space-y-2">
                      {detail?.fixture_examples?.map((fixture) => (
                        <button key={fixture.name} type="button" onClick={() => applyFixture(fixture)} className={`w-full rounded-2xl border px-3 py-3 text-left text-sm transition ${selectedFixtureName === fixture.name ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-50" : "border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700"}`}>{fixture.name}</button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">必需变量</div>
                    <div className="flex flex-wrap gap-2">
                      {detail?.required_variables.map((variable) => (
                        <span key={variable} className={`rounded-full border px-3 py-1 text-xs ${missingVariables.includes(variable) ? "border-rose-400/40 bg-rose-400/10 text-rose-100" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"}`}>{variable}</span>
                      ))}
                    </div>
                    {missingVariables.length > 0 && <p className="mt-3 text-xs leading-5 text-rose-200">缺少变量：{missingVariables.join(", ")}</p>}
                    {variablesState.parseError && <p className="mt-3 text-xs leading-5 text-amber-200">JSON 解析失败：{variablesState.parseError}</p>}
                  </div>
                </div>
                <label className="block text-sm font-medium text-slate-300">变量 JSON<textarea className="mt-2 min-h-[360px] w-full rounded-2xl border border-slate-700 bg-[#020617] px-4 py-4 font-mono text-sm leading-6 text-slate-100" value={variablesJson} onChange={(e) => setVariablesJson(e.target.value)} /></label>
              </div>
            )}
            {inspectorTab === "render" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div><div className="text-sm font-semibold text-white">渲染消息</div><div className="mt-1 text-xs text-slate-400">先检查最终发送给模型的消息结构。</div></div>
                  <button type="button" onClick={() => void handleRender()} disabled={isRendering} className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-slate-100">{isRendering ? "渲染中..." : "渲染提示词"}</button>
                </div>
                <pre data-testid="prompt-preview-output" className="min-h-[420px] overflow-auto rounded-2xl border border-slate-800 bg-slate-950/90 p-4 text-xs leading-6 text-cyan-50">{preview || "暂无渲染结果"}</pre>
              </div>
            )}
            {inspectorTab === "run" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div><div className="text-sm font-semibold text-white">系统模型输出</div><div className="mt-1 text-xs text-slate-400">运行前会先做变量校验，避免把缺参 prompt 直接发到模型。</div></div>
                  <button type="button" onClick={() => void handleRun()} disabled={isRunning} className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950">{isRunning ? "运行中..." : "运行系统模型"}</button>
                </div>
                <pre data-testid="prompt-secondary-output" className="min-h-[420px] overflow-auto rounded-2xl border border-slate-800 bg-slate-950/90 p-4 text-xs leading-6 text-emerald-50">{runResult || "暂无输出"}</pre>
              </div>
            )}
            {inspectorTab === "versions" && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
                  <label className="block text-sm font-medium text-slate-300">选择版本<select className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100" value={selectedVersionId} onChange={(e) => setSelectedVersionId(e.target.value)}>{detail?.versions?.map((version: PromptVersion) => (<option key={version.version_id} value={version.version_id}>{version.version_id} · {version.note || "无备注"}</option>))}</select></label>
                  <button type="button" onClick={() => void handleDiff()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-slate-100"><GitCompare className="h-4 w-4" />对比选中版本</button>
                  <button type="button" onClick={() => void handleRestore()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100"><RotateCcw className="h-4 w-4" />恢复选中版本</button>
                </div>
                <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="space-y-2">
                    {detail?.versions?.map((version) => (
                      <button data-testid={`version-entry-${version.version_id}`} key={version.version_id} type="button" onClick={() => setSelectedVersionId(version.version_id)} className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedVersionId === version.version_id ? "border-cyan-400/40 bg-cyan-400/10" : "border-slate-800 bg-slate-900/70 hover:border-slate-700"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div><div className="text-sm font-semibold text-white">{version.note || "无备注"}</div><div className="mt-1 text-xs text-slate-400">{version.version_id}</div></div>
                          {version.restored_from && <div className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-100">已恢复</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-4">
                    <pre data-testid="version-diff-primary" className="min-h-[200px] overflow-auto rounded-2xl border border-slate-800 bg-slate-950/90 p-4 text-xs leading-6 text-cyan-50">{preview || "先点击“对比选中版本”查看系统提示词差异"}</pre>
                    <pre data-testid="version-diff-secondary" className="min-h-[200px] overflow-auto rounded-2xl border border-slate-800 bg-slate-950/90 p-4 text-xs leading-6 text-emerald-50">{runResult || "先点击“对比选中版本”查看用户提示词差异"}</pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {isAnalysisOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px]">
          <div data-testid="prompt-analysis-drawer" className="h-full w-full max-w-[440px] border-l border-slate-200 bg-white text-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div data-testid="prompt-analysis-title" className="text-xl font-bold">提示词质量分析</div>
                <div className="mt-1 text-sm text-slate-500">聚焦约束完整性、表达清晰度和可执行性。</div>
              </div>
              <button
                type="button"
                aria-label="关闭分析抽屉"
                onClick={() => setIsAnalysisOpen(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-50"
              >
                关闭
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto px-5 py-5">
              {isAnalyzing && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">分析中...</div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-3 text-sm font-semibold text-slate-600">总分</div>
                <div className="flex items-center gap-4">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-amber-400 text-4xl font-black text-amber-500">{analysisReport?.score ?? "--"}</div>
                  <div>
                    <div className="text-lg font-semibold text-slate-800">{analysisReport?.grade ?? "待分析"}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-500">{analysisReport?.summary ?? "点击“提示词质量分析”获取真实评分与诊断。"}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="mb-4 text-lg font-semibold">维度评分</div>
                {(analysisReport?.dimensions ?? []).map(({ name, score }) => (
                  <div key={name} className="mb-4 last:mb-0">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span>{name}</span>
                      <span className="font-semibold text-slate-500">{score}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className={`h-2 rounded-full ${score >= 80 ? "bg-emerald-500" : score >= 65 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                ))}
                {!analysisReport && <div className="text-sm text-slate-500">暂无评分数据</div>}
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="mb-4 text-lg font-semibold">诊断分析</div>
                <div className="space-y-4">
                  {(analysisReport?.issues ?? []).map((issue) => (
                    <div key={issue.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-sm leading-6 text-slate-600">
                        <span className={`mr-2 rounded px-2 py-0.5 text-xs font-semibold ${issue.severity === "high" ? "bg-rose-100 text-rose-700" : issue.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-700"}`}>{issue.severity}</span>
                        <span className="font-semibold">{issue.title}</span>
                        <div className="mt-2">{issue.problem}</div>
                        <div className="mt-2 text-slate-500">{issue.suggestion}</div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button type="button" onClick={() => void handleApplyIssue(issue.id)} className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white">
                          立即替换
                        </button>
                      </div>
                    </div>
                  ))}
                  {!analysisReport && <div className="text-sm text-slate-500">暂无诊断结果</div>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="mb-4 text-lg font-semibold">改进建议</div>
                <div className="space-y-3 text-sm leading-6 text-slate-600">
                  {(analysisReport?.improvement_suggestions ?? []).map((suggestion) => (
                    <div key={suggestion} className="rounded-2xl bg-slate-50 p-4">{suggestion}</div>
                  ))}
                  {!analysisReport && <div className="text-sm text-slate-500">分析后会在这里展示聚合建议。</div>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="mb-4 text-lg font-semibold">优化焦点</div>
                <textarea
                  value={optimizeFocus}
                  onChange={(e) => setOptimizeFocus(e.target.value)}
                  placeholder="例如：强化 JSON-only 输出约束，减少歧义表达"
                  className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                />
                <div className="mt-4 flex justify-end">
                  <button data-testid="optimize-button" type="button" onClick={() => void handleOptimize()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                    {isOptimizing ? "优化中..." : "一键优化"}
                  </button>
                </div>
              </div>

              {comparisonReport && (
                <div className="rounded-2xl border border-slate-200 p-5">
                  <div className="mb-4 text-lg font-semibold">优化前后评分对比</div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="mb-2 text-sm font-semibold text-slate-500">优化前</div>
                      <div className="text-3xl font-black text-slate-800">{comparisonReport.before?.score ?? "--"}</div>
                      <div className="mt-2 text-sm text-slate-500">{comparisonReport.before?.grade ?? "暂无"}</div>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <div className="mb-2 text-sm font-semibold text-emerald-700">优化后</div>
                      <div className="text-3xl font-black text-emerald-700">{comparisonReport.after?.score ?? "--"}</div>
                      <div className="mt-2 text-sm text-emerald-600">{comparisonReport.after?.grade ?? "暂无"}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
