/**
 * Jupyter Notebook 风格代码沙箱
 * 多 Cell、持久化变量、图表内联渲染
 *
 * 设计要点：
 * - 点击"到沙箱运行"只填充被点击的那个代码块（不自动收集全部）
 * - 用户可手动"新增 Cell"来组织多段代码
 * - 运行 Cell N 时自动拼接 Cell 1..N 的代码（解决 NameError）
 * - matplotlib 图表以 base64 内联渲染
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import {
  Play,
  Loader2,
  Plus,
  PlusCircle,
  Trash2,
  ChevronUp,
  ChevronDown,
  FolderOpen,
  XCircle,
  X,
  Maximize2,
  ImageIcon,
} from 'lucide-react'
import { usePyodide } from '@/hooks/usePyodide'
import {
  type Language,
  CODE_TEMPLATES,
} from '@/lib/codeSandboxRunner'
import '@/styles/subject-tools.css'

/* ─── Types ─── */
interface NotebookCell {
  id: string
  code: string
  output: string | null
  error: string | null
  notice: string | null
  images: string[]
  isRunning: boolean
  hasRun: boolean
  duration: number | null
}

interface CodeSandboxProps {
  subjectKey?: string
  className?: string
  isFullscreen?: boolean
  fillContainer?: boolean
  initialCode?: string
  initialLanguage?: string
  /** 从概念学习页面传入的所有代码块（Notebook 多 Cell 模式） */
  initialCells?: { code: string; language: string }[]
}

let cellIdCounter = 0
function newCellId(): string {
  return `cell-${Date.now()}-${++cellIdCounter}`
}

function createCell(code = ''): NotebookCell {
  return {
    id: newCellId(),
    code,
    output: null,
    error: null,
    notice: null,
    images: [],
    isRunning: false,
    hasRun: false,
    duration: null,
  }
}

/** 计算 Monaco Editor 高度：根据行数自适应，无上限 */
function calcEditorHeight(code: string): string {
  const lineCount = code.split('\n').length
  // 每行 20px + 上下 padding 24px，最少 80px
  const height = Math.max(80, lineCount * 20 + 24)
  return `${height}px`
}

export default function CodeSandbox({
  className = '',
  isFullscreen = false,
  fillContainer = false,
  initialCode,
  initialCells,
}: CodeSandboxProps) {
  const shouldFillContainer = isFullscreen || fillContainer

  const [language] = useState<Language>('python')
  const [cells, setCells] = useState<NotebookCell[]>(() => {
    // 优先使用 initialCells（多 Cell 模式）
    if (initialCells && initialCells.length > 0) {
      return initialCells.map(c => createCell(c.code))
    }
    // 单代码块模式
    if (initialCode) {
      return [createCell(initialCode)]
    }
    // 默认空 Cell
    return [createCell('# 在这里编写 Python 代码\n')]
  })
  const [showTemplates, setShowTemplates] = useState(false)
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const templateRef = useRef<HTMLDivElement>(null)
  const cellsEndRef = useRef<HTMLDivElement>(null)
  const { runPython } = usePyodide()

  // 关闭模板弹窗（点击外部）
  useEffect(() => {
    if (!showTemplates) return
    const handler = (e: MouseEvent) => {
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) {
        setShowTemplates(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTemplates])

  // ── 接收从学习页代码块发送的代码（只填充点击的那个代码块） ──
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{
        code: string
        language: string
        allCodeBlocks?: { code: string; language: string }[]
      }>).detail

      if (!detail?.code) return

      // 只追加点击的那个代码块，不收集全部
      setCells(prev => [...prev, createCell(detail.code)])

      // 滚动到底部
      setTimeout(() => cellsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
    window.addEventListener('code-to-sandbox', handler)
    return () => window.removeEventListener('code-to-sandbox', handler)
  }, [])

  // ── 更新 Cell ──
  const updateCell = useCallback((cellId: string, updates: Partial<NotebookCell>) => {
    setCells(prev => prev.map(c => c.id === cellId ? { ...c, ...updates } : c))
  }, [])



  // ── 运行单个 Cell ──
  const handleRunCell = useCallback(async (cellId: string) => {
    const cellIndex = cells.findIndex(c => c.id === cellId)
    if (cellIndex < 0) return

    updateCell(cellId, { isRunning: true, output: null, error: null, notice: null, images: [], duration: null })

    try {
      const code = cells[cellIndex].code

      const start = performance.now()
      const result = await runPython(code)
      const duration = Math.round(performance.now() - start)

      updateCell(cellId, {
        output: result.stdout || null,
        error: result.stderr || null,
        notice: result.notice ?? null,
        images: result.images || [],
        isRunning: false,
        hasRun: true,
        duration,
      })
    } catch (err) {
      updateCell(cellId, {
        output: null,
        error: `执行失败: ${err instanceof Error ? err.message : String(err)}`,
        notice: null,
        images: [],
        isRunning: false,
        hasRun: true,
        duration: null,
      })
    }
  }, [cells, runPython, updateCell])

  // ── 运行所有 Cell（逐个顺序执行，每个 Cell 独立输出） ──
  const handleRunAll = useCallback(async () => {
    if (cells.length === 0) return
    for (const cell of cells) {
      if (!cell.code.trim()) continue
      await handleRunCell(cell.id)
    }
  }, [cells, handleRunCell])

  // ── Cell 操作 ──
  const addCellBelow = useCallback((afterIndex: number) => {
    setCells(prev => {
      const next = [...prev]
      next.splice(afterIndex + 1, 0, createCell(''))
      return next
    })
  }, [])

  const deleteCell = useCallback((cellId: string) => {
    setCells(prev => {
      if (prev.length <= 1) return prev
      return prev.filter(c => c.id !== cellId)
    })
  }, [])

  const moveCellUp = useCallback((cellId: string) => {
    setCells(prev => {
      const idx = prev.findIndex(c => c.id === cellId)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }, [])

  const moveCellDown = useCallback((cellId: string) => {
    setCells(prev => {
      const idx = prev.findIndex(c => c.id === cellId)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }, [])

  const handleTemplateSelect = (template: (typeof CODE_TEMPLATES)[0]) => {
    // 模板追加为新 Cell，不清空现有代码
    setCells(prev => [...prev, createCell(template.code)])
    setShowTemplates(false)
    setTimeout(() => cellsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // 清空沙箱
  const handleClearAll = useCallback(() => {
    setCells([createCell('# 在这里编写 Python 代码\n')])
  }, [])

  const filteredTemplates = CODE_TEMPLATES.filter(t => t.language === language)
  const isAnyRunning = cells.some(c => c.isRunning)

  return (
    <div className={`code-sandbox-container flex flex-col min-h-0 ${className} ${shouldFillContainer ? 'h-full' : ''}`}>
      {/* ═══ Header bar ═══ */}
      <div className="code-sandbox-header" style={{ zIndex: 20 }}>
        <div className="code-sandbox-dots">
          <span />
          <span />
          <span />
        </div>

        <div className="flex-1 flex items-center justify-between gap-4">
          <div className="relative ml-4 flex min-w-0 items-center gap-3">
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {cells.length} 个 Cell
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Template selector */}
            <div className="relative" ref={templateRef} style={{ zIndex: 30 }}>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition-all hover:border-slate-300 hover:text-slate-700"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">模板</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
              </button>

              {showTemplates && (
                <div
                  className="absolute right-0 top-full mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-md"
                  style={{ zIndex: 9999 }}
                >
                  {filteredTemplates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleTemplateSelect(t)}
                      className="w-full px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear */}
            <button
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500"
              title="清空沙箱"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">清空</span>
            </button>

            {/* Add Cell button */}
            <button
              onClick={() => addCellBelow(cells.length - 1)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">新增 Cell</span>
            </button>

            {/* Run All button */}
            <button
              onClick={handleRunAll}
              disabled={isAnyRunning || !cells.some(c => c.code.trim())}
              className="run-button inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isAnyRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  运行中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" fill="currentColor" />
                  全部运行
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Notebook Body — Cell 列表 ═══ */}
      <div
        className={`relative flex flex-col gap-0 overflow-y-auto p-4 md:p-5 ${shouldFillContainer ? 'min-h-0 flex-1' : 'min-h-[600px]'}`}
        style={shouldFillContainer ? { height: 'calc(100% - 52px)' } : undefined}
      >
        {cells.map((cell, cellIndex) => (
          <div key={cell.id} className="group notebook-cell-wrapper">
            {/* ═══ Single Cell ═══ */}
            <div className={`rounded-md border transition-all mb-2 ${
              cell.isRunning
                ? 'border-emerald-300 shadow-sm'
                : cell.error
                  ? 'border-red-200'
                  : cell.hasRun
                    ? 'border-slate-200'
                    : 'border-slate-200'
            }`}>
              {/* Cell header */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-slate-50/60 rounded-t-md">
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold ${
                    cell.isRunning
                      ? 'bg-emerald-100 text-emerald-600'
                      : cell.hasRun
                        ? cell.error ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-600'
                        : 'bg-slate-100 text-slate-400'
                  }`}>
                    {cell.isRunning ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : cell.hasRun ? (
                      cell.error ? '✕' : '✓'
                    ) : (
                      cellIndex + 1
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    In [{cell.hasRun ? cellIndex + 1 : ' '}]
                  </span>
                  {cell.duration !== null && (
                    <span className="text-[10px] text-slate-300">{cell.duration}ms</span>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleRunCell(cell.id)}
                    disabled={cell.isRunning || isAnyRunning}
                    className="flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
                    title="运行此 Cell（自动包含前面所有 Cell 的代码）"
                  >
                    <Play className="w-3 h-3" fill="currentColor" />
                    运行
                  </button>
                  <button onClick={() => moveCellUp(cell.id)} className="p-1 rounded-sm text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors" title="上移">
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button onClick={() => moveCellDown(cell.id)} className="p-1 rounded-sm text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors" title="下移">
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button onClick={() => addCellBelow(cellIndex)} className="p-1 rounded-sm text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors" title="在下方添加 Cell">
                    <Plus className="w-3 h-3" />
                  </button>
                  {cells.length > 1 && (
                    <button onClick={() => deleteCell(cell.id)} className="p-1 rounded-sm text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="删除 Cell">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="min-w-0 overflow-hidden bg-[#1f2430]">
                <Editor
                  height={calcEditorHeight(cell.code)}
                  language={language}
                  value={cell.code}
                  onChange={(v) => updateCell(cell.id, { code: v || '' })}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    lineHeight: 20,
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    padding: { top: 12, bottom: 12 },
                    lineNumbers: 'on',
                    renderLineHighlight: 'gutter',
                    cursorBlinking: 'smooth',
                    smoothScrolling: true,
                    bracketPairColorization: { enabled: true },
                    automaticLayout: true,
                    tabSize: 4,
                    wordWrap: 'on',
                    lineNumbersMinChars: 3,
                    folding: false,
                    glyphMargin: false,
                    scrollbar: {
                      vertical: 'hidden',
                      horizontal: 'auto',
                      alwaysConsumeMouseWheel: false,
                    },
                  }}
                />
              </div>

              {/* ═══ Output area ═══ */}
              {(cell.hasRun || cell.isRunning) && (
                <div className="border-t border-slate-100 bg-white rounded-b-md">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50/40">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Out [{cell.hasRun ? cellIndex + 1 : ' '}]
                    </span>
                    {cell.images.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-blue-400">
                        <ImageIcon className="w-3 h-3" />
                        {cell.images.length} 张图
                      </span>
                    )}
                  </div>
                  <div className="px-4 pb-4 pt-1 space-y-2">
                    {cell.isRunning && (
                      <div className="flex items-center gap-2 py-2 text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                        <span className="text-sm">运行中...</span>
                      </div>
                    )}

                    {cell.notice && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
                        ⚡ {cell.notice}
                      </div>
                    )}

                    {cell.output && (
                      <pre className="code-output whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                        {cell.output}
                      </pre>
                    )}

                    {cell.error && (
                      <div className="code-output-error rounded-md">
                        <div className="flex items-start gap-2">
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                          <pre className="whitespace-pre-wrap text-sm">{cell.error}</pre>
                        </div>
                      </div>
                    )}

                    {/* Matplotlib 图表 */}
                    {cell.images.length > 0 && (
                      <div className="space-y-3 pt-1">
                        {cell.images.map((imgBase64, idx) => (
                          <div key={idx} className="group/img relative overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                            <img
                              src={`data:image/png;base64,${imgBase64}`}
                              alt={`图表 ${idx + 1}`}
                              className="h-auto w-full cursor-pointer transition-transform hover:scale-[1.01]"
                              style={{ maxHeight: '500px', objectFit: 'contain' }}
                              onClick={() => setExpandedImage(imgBase64)}
                            />
                            <div className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <button
                                onClick={() => setExpandedImage(imgBase64)}
                                className="flex items-center gap-1 rounded-md bg-slate-900/70 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm hover:bg-slate-900/90"
                              >
                                <Maximize2 className="w-3 h-3" />
                                放大
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!cell.isRunning && !cell.error && !cell.output && cell.images.length === 0 && cell.hasRun && (
                      <div className="text-[12px] italic text-slate-400 py-1">
                        运行完成，无输出
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Add cell divider */}
            {cellIndex < cells.length - 1 && (
              <div className="flex items-center justify-center h-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => addCellBelow(cellIndex)}
                  className="flex items-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-3 py-0.5 text-[10px] text-slate-400 hover:border-emerald-300 hover:text-emerald-500 transition-colors"
                >
                  <Plus className="w-2.5 h-2.5" />
                  插入 Cell
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Bottom: Add Cell */}
        <div className="flex items-center justify-center py-4" ref={cellsEndRef}>
          <button
            onClick={() => addCellBelow(cells.length - 1)}
            className="flex items-center gap-2 rounded-md border border-dashed border-slate-200 bg-white/60 px-5 py-3 text-xs font-medium text-slate-500 transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
          >
            <PlusCircle className="w-4 h-4" />
            添加新的 Cell
          </button>
        </div>
      </div>

      {/* ═══ Full-screen image viewer ═══ */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <img
              src={`data:image/png;base64,${expandedImage}`}
              alt="放大查看"
              className="max-h-[85vh] max-w-[85vw] rounded-md shadow-2xl"
              style={{ objectFit: 'contain' }}
            />
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-md bg-white text-slate-700 shadow-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
