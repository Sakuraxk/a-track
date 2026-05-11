/**
 * 数学实验室 — 数理逻辑类核心特色
 * 交互画板(JSXGraph) + 3D 曲面(Three.js) + 公式推演 + 几何构造
 */
import { useState, useCallback, useRef, useEffect, lazy, Suspense, useMemo } from 'react'
import { Icon } from '@/components/ui/Icon'
import InlineLatex from '@/components/ui/InlineLatex'
import {
  deriveExpression,
  detectParameters,
  FORMULA_TEMPLATES,
  GEOMETRY_PRESETS,
  type DerivationStep,
  type GeometryPresetId,
} from '@/lib/mathEngine'
import '@/styles/subject-tools.css'

const Canvas3D = lazy(() => import('./Canvas3D'))
const JSXGraphBoard = lazy(() => import('./JSXGraphBoard'))

type TabMode = '2d' | '3d' | 'derive' | 'geometry'

interface MathLabProps {
  subjectKey?: string
  className?: string
}

const MAX_HISTORY = 8

export default function MathLab({ className = '' }: MathLabProps) {
  const [mode, setMode] = useState<TabMode>('2d')
  const [expression, setExpression] = useState('sin(x)')
  const [expressions, setExpressions] = useState<string[]>(['sin(x)'])
  const [derivationSteps, setDerivationSteps] = useState<DerivationStep[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [activeGeoPreset, setActiveGeoPreset] = useState<GeometryPresetId>('circumscribed')
  const [expressionHistory, setExpressionHistory] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [params, setParams] = useState<Record<string, number>>({})
  const [detectedParams, setDetectedParams] = useState<string[]>([])
  const [inputWarning, setInputWarning] = useState('')
  const [showCriticalPoints, setShowCriticalPoints] = useState(false)
  const [showTangent, setShowTangent] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const templateDropdownRef = useRef<HTMLDivElement>(null)

  // ── Detect parameters in expression ─────────────────────────
  useEffect(() => {
    if (mode === '2d' || mode === '3d') {
      const found = detectParameters(expression)
      setDetectedParams(found)
      // Initialize new params with default value 1
      setParams(prev => {
        const next = { ...prev }
        for (const p of found) {
          if (!(p in next)) next[p] = 1
        }
        return next
      })
    } else {
      setDetectedParams([])
    }
  }, [expression, mode])

  // Check dark mode
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Close template dropdown on outside click
  useEffect(() => {
    if (!showTemplates) return
    const handler = (e: MouseEvent) => {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(e.target as Node)) {
        setShowTemplates(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTemplates])

  // ── Add to history ───────────────────────────────────────────
  const addToHistory = useCallback((expr: string) => {
    setExpressionHistory(prev => {
      const filtered = prev.filter(e => e !== expr)
      return [expr, ...filtered].slice(0, MAX_HISTORY)
    })
  }, [])

  // ── Submit expression ────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (!expression.trim()) return
    setInputWarning('')

    // Input validation
    if (/\/\s*0(?![.\d])/.test(expression)) {
      setInputWarning('注意：表达式包含除以零，结果可能未定义')
    }

    addToHistory(expression.trim())

    if (mode === 'derive') {
      const steps = deriveExpression(expression)
      setDerivationSteps(steps)
    } else if (mode === '2d') {
      setExpressions(prev => {
        if (prev.includes(expression.trim())) return prev
        return [...prev, expression.trim()]
      })
    }
  }, [expression, mode, addToHistory])

  // ── Clear 2D functions ───────────────────────────────────────
  const handleClear2D = useCallback(() => {
    setExpressions([expression.trim() || 'sin(x)'])
  }, [expression])

  // ── Remove single function ──────────────────────────────────
  const handleRemoveExpr = useCallback((idx: number) => {
    setExpressions(prev => prev.filter((_, i) => i !== idx))
  }, [])

  // ── Switch expression from history ──────────────────────────
  const handleHistorySelect = useCallback((expr: string) => {
    setExpression(expr)
    setShowHistory(false)
    if (mode === '2d') {
      setExpressions([expr])
    } else if (mode === 'derive') {
      const steps = deriveExpression(expr)
      setDerivationSteps(steps)
    }
  }, [mode])

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const tabKeys: TabMode[] = ['2d', 'geometry', '3d', 'derive']
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault()
        handleClear2D()
      }
      // Ctrl+1/2/3/4 to switch tabs
      if (e.ctrlKey && e.key >= '1' && e.key <= '4') {
        e.preventDefault()
        setMode(tabKeys[parseInt(e.key) - 1])
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleClear2D])

  // ── Auto-derive on tab switch ───────────────────────────────
  useEffect(() => {
    if (mode === 'derive' && expression.trim()) {
      const steps = deriveExpression(expression)
      setDerivationSteps(steps)
    }
  }, [mode, expression])

  // ── Auto-plot on tab switch ─────────────────────────────────
  useEffect(() => {
    if (mode === '2d') {
      setExpressions([expression.trim() || 'sin(x)'])
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Template filtering ──────────────────────────────────────
  const filteredTemplates = useMemo(
    () => FORMULA_TEMPLATES.filter((t) => t.type === mode),
    [mode]
  )

  const handleTemplateSelect = (template: (typeof FORMULA_TEMPLATES)[0]) => {
    if (template.type === 'geometry') {
      setActiveGeoPreset(template.expr as GeometryPresetId)
      setMode('geometry')
    } else {
      setExpression(template.expr)
      addToHistory(template.expr)
      if (template.type === 'derive') {
        setTimeout(() => {
          const steps = deriveExpression(template.expr)
          setDerivationSteps(steps)
        }, 100)
      } else if (template.type === '2d') {
        setExpressions([template.expr])
      }
    }
    setShowTemplates(false)
  }

  // ── Tabs config ─────────────────────────────────────────────
  const tabs: { key: TabMode; label: string; icon: string }[] = [
    { key: '2d', label: '交互画板', icon: 'ph:chart-line-bold' },
    { key: 'geometry', label: '几何构造', icon: 'ph:triangle-bold' },
    { key: '3d', label: '3D 曲面', icon: 'ph:cube-bold' },
    { key: 'derive', label: '推导引擎', icon: 'ph:math-operations-bold' },
  ]

  // ── Curve colors for function list display ──────────────────
  const CURVE_COLORS = ['#818cf8', '#22d3ee', '#fb923c', '#a78bfa', '#34d399', '#f472b6']

  return (
    <div className={`math-lab-container ${className}`}>
      {/* Tab bar */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-white/10 dark:bg-black/20 rounded-xl p-1" role="tablist" aria-label="数学实验室模式">
          {tabs.map((tab, idx) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={mode === tab.key}
              aria-controls={`mathlab-panel-${tab.key}`}
              onClick={() => setMode(tab.key)}
              className={`px-3.5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${
                mode === tab.key
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title={`${tab.label} (Ctrl+${idx + 1})`}
            >
              <Icon icon={tab.icon} className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Template & History controls */}
        <div className="flex items-center gap-2">
          {/* History dropdown */}
          {expressionHistory.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="px-3 py-2 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-white/20 dark:hover:bg-black/20 transition-all flex items-center gap-1.5"
              >
                <Icon icon="ph:clock-counter-clockwise-bold" className="w-4 h-4" />
                历史
              </button>
              {showHistory && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1 z-50 max-h-64 overflow-auto">
                  {expressionHistory.map((expr, i) => (
                    <button
                      key={`${expr}-${i}`}
                      onClick={() => handleHistorySelect(expr)}
                      className="w-full text-left px-3 py-2 text-sm font-mono text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors truncate"
                    >
                      {expr}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Template dropdown */}
          <div className="relative" ref={templateDropdownRef}>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-white/20 dark:hover:bg-black/20 transition-all flex items-center gap-1.5"
            >
              <Icon icon="ph:lightning-bold" className="w-4 h-4" />
              预设
              <Icon
                icon="ph:caret-down-bold"
                className={`w-3 h-3 transition-transform ${showTemplates ? 'rotate-180' : ''}`}
              />
            </button>

            {showTemplates && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1 z-50 max-h-80 overflow-auto">
                {filteredTemplates.length > 0 ? (
                  filteredTemplates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleTemplateSelect(t)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{t.description}</div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-sm text-slate-400 text-center">
                    当前 Tab 暂无预设
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expression input — hidden in geometry mode */}
      {mode !== 'geometry' && (
        <div className="px-5 pb-4">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <Icon icon="ph:function-bold" className="w-5 h-5 text-indigo-400" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              maxLength={500}
              aria-label="数学表达式输入"
              placeholder={
                mode === '3d'
                  ? 'z = f(x, y)，例：sin(x) * cos(y)'
                  : mode === 'derive'
                  ? '输入表达式，例：d/dx (x^3) 或 ∫ sin(x) dx'
                  : 'y = f(x)，例：sin(x) 或 a*x^2+b*x+c'
              }
              className="w-full pl-12 pr-28 py-3 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-indigo-200 dark:border-indigo-800 text-slate-800 dark:text-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-slate-400 transition-all"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {mode === '2d' && expressions.length > 1 && (
                <button
                  onClick={handleClear2D}
                  className="px-2 py-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-700/80 text-slate-500 text-xs font-bold transition-all hover:bg-slate-300 dark:hover:bg-slate-600"
                  title="Ctrl+L 清除所有"
                >
                  清除
                </button>
              )}
              <button
                onClick={handleSubmit}
                className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold transition-all shadow-md"
              >
                {mode === 'derive' ? '推演' : mode === '2d' ? '添加' : '绘制'}
              </button>
            </div>
          </div>

          {/* Input warning */}
          {inputWarning && (
            <div className="mt-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Icon icon="ph:warning-bold" className="w-3.5 h-3.5" />
              {inputWarning}
            </div>
          )}

          {/* LaTeX preview */}
          {expression.trim() && mode !== '3d' && (
            <div className="mt-2 px-2 py-1.5 rounded-lg bg-white/40 dark:bg-slate-800/40 text-sm inline-block">
              <InlineLatex text={`$${expression}$`} />
            </div>
          )}

          {/* Active function list for 2D */}
          {mode === '2d' && expressions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {expressions.map((expr, idx) => (
                <div
                  key={`${expr}-${idx}`}
                  className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg bg-white/60 dark:bg-slate-800/60 text-xs font-mono"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: CURVE_COLORS[idx % CURVE_COLORS.length] }}
                  />
                  <span className="text-slate-700 dark:text-slate-300 max-w-[120px] truncate">{expr}</span>
                  {expressions.length > 1 && (
                    <button
                      onClick={() => handleRemoveExpr(idx)}
                      className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Parameter sliders */}
          {(mode === '2d' || mode === '3d') && detectedParams.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">参数调节</div>
              {detectedParams.map((p) => (
                <div key={p} className="mathlab-param-row">
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 w-8">{p}</span>
                  <input
                    type="range"
                    min={-5}
                    max={5}
                    step={0.1}
                    value={params[p] ?? 1}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      setParams(prev => ({ ...prev, [p]: val }))
                      if (mode === '2d') setExpressions([...expressions])
                    }}
                    className="mathlab-slider flex-1"
                    aria-label={`参数 ${p}`}
                  />
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-300 w-10 text-right">{(params[p] ?? 1).toFixed(1)}</span>
                </div>
              ))}
            </div>
          )}

          {/* 2D mode controls */}
          {mode === '2d' && (
            <div className="mt-3 flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                <input type="checkbox" checked={showCriticalPoints} onChange={(e) => setShowCriticalPoints(e.target.checked)} className="rounded border-slate-300 text-indigo-500" />
                显示关键点
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                <input type="checkbox" checked={showTangent} onChange={(e) => setShowTangent(e.target.checked)} className="rounded border-slate-300 text-indigo-500" />
                显示切线
              </label>
            </div>
          )}
        </div>
      )}

      {/* Geometry preset selector */}
      {mode === 'geometry' && (
        <div className="px-5 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.values(GEOMETRY_PRESETS)).map((preset) => (
              <button
                key={preset.id}
                onClick={() => setActiveGeoPreset(preset.id)}
                className={`flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left ${
                  activeGeoPreset === preset.id
                    ? 'border-indigo-400 bg-indigo-50/80 dark:bg-indigo-900/30 dark:border-indigo-500'
                    : 'border-transparent bg-white/50 dark:bg-slate-800/50 hover:border-indigo-200 dark:hover:border-indigo-700'
                }`}
              >
                <div className={`text-sm font-bold ${activeGeoPreset === preset.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {preset.title}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{preset.description}</div>
              </button>
            ))}
          </div>
          {activeGeoPreset && GEOMETRY_PRESETS[activeGeoPreset] && (
            <div className="mt-2 flex items-center gap-2 text-xs text-indigo-500 dark:text-indigo-400">
              <Icon icon="ph:hand-pointing-bold" className="w-4 h-4" />
              <span>{GEOMETRY_PRESETS[activeGeoPreset].hint}</span>
            </div>
          )}
        </div>
      )}

      {/* Content area */}
      <div className="px-5 pb-5">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-slate-400">
                <Icon icon="ph:spinner" className="w-5 h-5 animate-spin" />
                <span className="text-sm">加载中…</span>
              </div>
            </div>
          }
        >
          {mode === '2d' && (
            <div className="rounded-xl overflow-hidden border border-indigo-200/30 dark:border-indigo-800/30" id="mathlab-panel-2d" role="tabpanel">
              <JSXGraphBoard
                expressions={expressions}
                isDark={isDark}
                params={params}
                showCriticalPoints={showCriticalPoints}
                showTangent={showTangent}
              />
            </div>
          )}

          {mode === 'geometry' && (
            <div className="rounded-xl overflow-hidden border border-indigo-200/30 dark:border-indigo-800/30">
              <JSXGraphBoard
                expressions={[]}
                geometryPreset={activeGeoPreset}
                isDark={isDark}
              />
            </div>
          )}

          {mode === '3d' && (
            <Canvas3D
              expression={expression}
              range={5}
              resolution={50}
              className="h-[420px] rounded-xl"
            />
          )}

          {mode === 'derive' && (
            <div className="space-y-3">
              {derivationSteps.length > 0 ? (
                derivationSteps.map((step, i) => (
                  <div
                    key={i}
                    className="derivation-step bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                        {step.label}
                      </span>
                    </div>
                    <div className="text-lg py-2 px-2 bg-white/40 dark:bg-slate-800/40 rounded-lg">
                      <InlineLatex text={`$${step.latex}$`} />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">{step.description}</p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Icon icon="ph:math-operations-bold" className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">输入表达式后点击「推演」</p>
                  <p className="text-xs text-slate-500 mt-1">支持多项式、三角函数、指数等</p>
                </div>
              )}
            </div>
          )}
        </Suspense>
      </div>

      {/* Keyboard shortcut hint */}
      <div className="px-5 pb-3 flex items-center gap-4 text-[10px] text-slate-400 select-none flex-wrap">
        <span><kbd className="mathlab-kbd">Enter</kbd> 执行</span>
        {mode === '2d' && <span><kbd className="mathlab-kbd">Ctrl+L</kbd> 清除</span>}
        <span><kbd className="mathlab-kbd">Ctrl+1~4</kbd> 切换</span>
      </div>
    </div>
  )
}
