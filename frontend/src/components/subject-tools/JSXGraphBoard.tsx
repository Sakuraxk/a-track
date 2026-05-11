/**
 * JSXGraphBoard — 基于 JSXGraph 的交互式 2D 数学画板
 * 支持：函数图像、可拖拽控制点、几何构造、平移/缩放
 *
 * JSXGraph 通过 CDN 动态加载（npm 包的 ESM exports 与 Vite 不兼容），
 * 运行时通过 window.JXG 全局变量访问。
 */
import { useEffect, useRef, useCallback, useId, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { parseToJSXGraphFn, findCriticalPoints, type GeometryPresetId } from '@/lib/mathEngine'
import { derivative, evaluate } from 'mathjs'

// ── CDN loader ─────────────────────────────────────────────────
const JSXGRAPH_JS_URL = 'https://cdn.jsdelivr.net/npm/jsxgraph@1.12.2/distrib/jsxgraphcore.js'
const JSXGRAPH_CSS_URL = 'https://cdn.jsdelivr.net/npm/jsxgraph@1.12.2/distrib/jsxgraph.css'

let _jsxReady: Promise<void> | null = null

function loadJSXGraph(): Promise<void> {
  if (_jsxReady) return _jsxReady

  _jsxReady = new Promise<void>((resolve, reject) => {
    // Already loaded?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).JXG?.JSXGraph) { resolve(); return }

    // Inject CSS
    if (!document.getElementById('jsxgraph-css')) {
      const link = document.createElement('link')
      link.id = 'jsxgraph-css'
      link.rel = 'stylesheet'
      link.href = JSXGRAPH_CSS_URL
      document.head.appendChild(link)
    }

    // Inject JS
    const script = document.createElement('script')
    script.src = JSXGRAPH_JS_URL
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load JSXGraph'))
    document.head.appendChild(script)
  })

  return _jsxReady
}

/** Typed accessor for the JSXGraph global */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getJXG(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).JXG
}

// ── Types ──────────────────────────────────────────────────────
interface JSXGraphBoardProps {
  /** mathjs-compatible expressions like ["sin(x)", "x^2"] */
  expressions: string[]
  /** Optional geometry preset instead of function mode */
  geometryPreset?: GeometryPresetId | null
  /** Dark mode */
  isDark?: boolean
  /** Parameter values for parametric expressions */
  params?: Record<string, number>
  /** Show critical points (zeros, extrema) */
  showCriticalPoints?: boolean
  /** Show tangent line on first curve */
  showTangent?: boolean
  className?: string
}

// Curated color palette for multi-function plotting
const CURVE_COLORS = [
  '#818cf8', // indigo-400
  '#22d3ee', // cyan-400
  '#fb923c', // orange-400
  '#a78bfa', // violet-400
  '#34d399', // emerald-400
  '#f472b6', // pink-400
]

export default function JSXGraphBoard({
  expressions,
  geometryPreset = null,
  isDark = false,
  params = {},
  showCriticalPoints = false,
  showTangent = false,
  className = '',
}: JSXGraphBoardProps) {
  const uniqueId = useId().replace(/:/g, '-')
  const containerId = `jsxgraph-${uniqueId}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boardRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [coordLabel, setCoordLabel] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // ── Board theme colors ───────────────────────────────────────
  const theme = {
    axis: isDark ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.3)',
    grid: isDark ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.06)',
    tickLabel: isDark ? 'rgba(148,163,184,0.6)' : 'rgba(71,85,105,0.5)',
  }

  // ── Init board ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initBoard = useCallback((): any => {
    if (!containerRef.current) return null
    const JXG = getJXG()
    if (!JXG?.JSXGraph) return null

    // Cleanup previous board
    if (boardRef.current) {
      try { JXG.JSXGraph.freeBoard(boardRef.current) } catch { /* ignore */ }
      boardRef.current = null
    }

    const board = JXG.JSXGraph.initBoard(containerId, {
      boundingbox: [-10, 8, 10, -8],
      axis: false,
      grid: false,
      showNavigation: false,
      showCopyright: false,
      keepaspectratio: false,
      pan: { enabled: true, needTwoFingers: false },
      zoom: { wheel: true, needShift: false, factorX: 1.15, factorY: 1.15 },
      renderer: 'svg',
    })

    // Draw styled grid
    for (let i = -10; i <= 10; i++) {
      board.create('line', [[i, -10], [i, 10]], {
        strokeColor: theme.grid, strokeWidth: 1,
        fixed: true, highlight: false, dash: 0,
        point1: { visible: false }, point2: { visible: false },
      })
      board.create('line', [[-10, i], [10, i]], {
        strokeColor: theme.grid, strokeWidth: 1,
        fixed: true, highlight: false, dash: 0,
        point1: { visible: false }, point2: { visible: false },
      })
    }

    // Draw axes
    board.create('line', [[-10, 0], [10, 0]], {
      strokeColor: theme.axis, strokeWidth: 1.5,
      fixed: true, highlight: false, straightFirst: true, straightLast: true,
      point1: { visible: false }, point2: { visible: false },
      lastArrow: { type: 2, size: 6 },
    })
    board.create('line', [[0, -10], [0, 10]], {
      strokeColor: theme.axis, strokeWidth: 1.5,
      fixed: true, highlight: false, straightFirst: true, straightLast: true,
      point1: { visible: false }, point2: { visible: false },
      lastArrow: { type: 2, size: 6 },
    })

    // Tick labels
    for (let i = -8; i <= 8; i += 2) {
      if (i === 0) continue
      board.create('text', [i, -0.6, String(i)], {
        fontSize: 10, fixed: true, highlight: false,
        anchorX: 'middle', color: theme.tickLabel,
      })
      board.create('text', [-0.6, i, String(i)], {
        fontSize: 10, fixed: true, highlight: false,
        anchorX: 'right', color: theme.tickLabel,
      })
    }

    // Origin label
    board.create('text', [-0.5, -0.5, 'O'], {
      fontSize: 10, fixed: true, highlight: false,
      color: theme.tickLabel,
    })

    boardRef.current = board
    return board
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId, isDark])

  // ── Plot functions ───────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plotFunctions = useCallback((board: any) => {
    if (!board) return

    setError('')

    expressions.forEach((expr, idx) => {
      if (!expr.trim()) return
      try {
        const fn = parseToJSXGraphFn(expr, params)
        const color = CURVE_COLORS[idx % CURVE_COLORS.length]

        const curve = board.create('functiongraph', [fn, -12, 12], {
          strokeColor: color,
          strokeWidth: 2.5,
          highlight: true,
          highlightStrokeWidth: 3.5,
          highlightStrokeColor: color,
        })

        // Critical points for first expression
        if (showCriticalPoints && idx === 0) {
          try {
            const cps = findCriticalPoints(expr)
            for (const cp of cps) {
              const cpColor = cp.type === 'max' ? '#ef4444' : cp.type === 'min' ? '#22c55e' : '#3b82f6'
              board.create('point', [cp.x, cp.y], {
                size: 4,
                fillColor: cpColor,
                strokeColor: cpColor,
                fixed: true,
                name: `(${cp.x}, ${cp.y})`,
                label: { fontSize: 10, offset: [5, 10], color: cpColor },
              })
            }
          } catch { /* skip */ }
        }

        // Tangent line for first expression
        if (showTangent && idx === 0) {
          try {
            let derivExpr: string
            try {
              derivExpr = derivative(expr, 'x').toString()
            } catch {
              derivExpr = '0'
            }

            const glider = board.create('glider', [1, fn(1), curve], {
              size: 6,
              fillColor: '#ef4444',
              strokeColor: '#dc2626',
              highlightFillColor: '#f87171',
              name: 'P',
              label: { fontSize: 12, offset: [8, 8] },
            })

            const tP1 = board.create('point', [
              () => {
                const px = glider.X(), py = glider.Y()
                let slope = 0
                try { slope = evaluate(derivExpr, { x: px, ...params }) as number } catch { /* */ }
                return [px - 5, py - 5 * slope]
              },
            ], { visible: false })

            const tP2 = board.create('point', [
              () => {
                const px = glider.X(), py = glider.Y()
                let slope = 0
                try { slope = evaluate(derivExpr, { x: px, ...params }) as number } catch { /* */ }
                return [px + 5, py + 5 * slope]
              },
            ], { visible: false })

            board.create('line', [tP1, tP2], {
              strokeColor: '#22d3ee',
              strokeWidth: 2,
              dash: 3,
              straightFirst: false,
              straightLast: false,
            })

            board.create('text', [
              -9, 7,
              () => {
                let slope = 0
                try { slope = evaluate(derivExpr, { x: glider.X(), ...params }) as number } catch { /* */ }
                return `斜率 k = ${slope.toFixed(3)}　点 (${glider.X().toFixed(2)}, ${glider.Y().toFixed(2)})`
              }
            ], { fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', fixed: true })
          } catch { /* skip */ }
        }
      } catch {
        setError(`表达式 "${expr}" 无法解析`)
      }
    })

    board.update()
  }, [expressions, params, showCriticalPoints, showTangent, isDark])

  // ── Build geometry preset ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildGeometryPreset = useCallback((board: any, preset: GeometryPresetId) => {
    if (!board) return

    const pointStyle = {
      size: 5,
      fillColor: '#818cf8',
      strokeColor: '#4f46e5',
      highlightFillColor: '#6366f1',
      highlightStrokeColor: '#4338ca',
      label: { fontSize: 13, offset: [8, 8] },
    }
    const lineStyle = {
      strokeColor: isDark ? '#94a3b8' : '#64748b',
      strokeWidth: 1.5,
    }

    switch (preset) {
      case 'circumscribed': {
        const A = board.create('point', [0, 4], { ...pointStyle, name: 'A' })
        const B = board.create('point', [-3, -2], { ...pointStyle, name: 'B' })
        const C = board.create('point', [4, -1], { ...pointStyle, name: 'C' })

        board.create('polygon', [A, B, C], {
          fillColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
          borders: { ...lineStyle },
          highlight: false,
        })

        board.create('circumcircle', [A, B, C], {
          strokeColor: '#22d3ee',
          strokeWidth: 2,
          fillColor: 'none',
          dash: 2,
          center: {
            visible: true,
            size: 3,
            name: 'O',
            fillColor: '#22d3ee',
            strokeColor: '#0891b2',
          },
        })
        break
      }

      case 'ellipse': {
        const F1 = board.create('point', [-3, 0], { ...pointStyle, name: 'F₁', fillColor: '#fb923c', strokeColor: '#ea580c' })
        const F2 = board.create('point', [3, 0], { ...pointStyle, name: 'F₂', fillColor: '#fb923c', strokeColor: '#ea580c' })
        const P = board.create('point', [0, 4], { ...pointStyle, name: 'P' })

        board.create('ellipse', [F1, F2, P], {
          strokeColor: '#818cf8',
          strokeWidth: 2.5,
          fillColor: isDark ? 'rgba(129,140,248,0.08)' : 'rgba(129,140,248,0.06)',
        })

        board.create('segment', [F1, P], { strokeColor: '#22d3ee', strokeWidth: 1.5, dash: 2, point1: { visible: false }, point2: { visible: false } })
        board.create('segment', [F2, P], { strokeColor: '#fb923c', strokeWidth: 1.5, dash: 2, point1: { visible: false }, point2: { visible: false } })

        // Distance labels
        board.create('text', [
          () => (F1.X() + P.X()) / 2 - 0.8,
          () => (F1.Y() + P.Y()) / 2 + 0.3,
          () => `d₁=${Math.sqrt((F1.X() - P.X()) ** 2 + (F1.Y() - P.Y()) ** 2).toFixed(2)}`
        ], { fontSize: 11, color: '#22d3ee', fixed: true })

        board.create('text', [
          () => (F2.X() + P.X()) / 2 + 0.3,
          () => (F2.Y() + P.Y()) / 2 + 0.3,
          () => `d₂=${Math.sqrt((F2.X() - P.X()) ** 2 + (F2.Y() - P.Y()) ** 2).toFixed(2)}`
        ], { fontSize: 11, color: '#fb923c', fixed: true })

        board.create('text', [
          -9, 7,
          () => {
            const d1 = Math.sqrt((F1.X() - P.X()) ** 2 + (F1.Y() - P.Y()) ** 2)
            const d2 = Math.sqrt((F2.X() - P.X()) ** 2 + (F2.Y() - P.Y()) ** 2)
            return `d₁ + d₂ = ${(d1 + d2).toFixed(2)}`
          }
        ], { fontSize: 13, color: isDark ? '#e2e8f0' : '#1e293b', fixed: true })
        break
      }

      case 'tangent': {
        const fnExpr = '0.15*x^3 - 0.5*x'
        const fn = (x: number) => 0.15 * x * x * x - 0.5 * x

        const curve = board.create('functiongraph', [fn, -10, 10], {
          strokeColor: '#818cf8',
          strokeWidth: 2.5,
        })

        const glider = board.create('glider', [2, fn(2), curve], {
          ...pointStyle,
          name: 'P',
          fillColor: '#ef4444',
          strokeColor: '#dc2626',
          highlightFillColor: '#f87171',
          size: 6,
        })

        // Compute derivative expression once
        let derivExpr: string
        try {
          derivExpr = derivative(fnExpr, 'x').toString()
        } catch {
          derivExpr = '0.45*x^2 - 0.5'
        }

        // Tangent line via two dynamic points
        const tangentP1 = board.create('point', [
          () => {
            const px = glider.X()
            const py = glider.Y()
            let slope = 0
            try { slope = evaluate(derivExpr, { x: px }) as number } catch { /* */ }
            return [px - 5, py - 5 * slope]
          },
        ], { visible: false })

        const tangentP2 = board.create('point', [
          () => {
            const px = glider.X()
            const py = glider.Y()
            let slope = 0
            try { slope = evaluate(derivExpr, { x: px }) as number } catch { /* */ }
            return [px + 5, py + 5 * slope]
          },
        ], { visible: false })

        board.create('line', [tangentP1, tangentP2], {
          strokeColor: '#22d3ee',
          strokeWidth: 2,
          dash: 3,
          straightFirst: false,
          straightLast: false,
        })

        // Slope label
        board.create('text', [
          -9, 7,
          () => {
            let slope = 0
            try { slope = evaluate(derivExpr, { x: glider.X() }) as number } catch { /* */ }
            return `斜率 k = ${slope.toFixed(3)}`
          }
        ], { fontSize: 13, color: isDark ? '#e2e8f0' : '#1e293b', fixed: true })
        break
      }

      case 'vector-add': {
        const O = board.create('point', [0, 0], {
          ...pointStyle, name: 'O', fixed: true,
          fillColor: isDark ? '#475569' : '#94a3b8',
          strokeColor: isDark ? '#334155' : '#64748b',
        })

        const A = board.create('point', [3, 2], { ...pointStyle, name: 'A', fillColor: '#818cf8', strokeColor: '#4f46e5' })
        const B = board.create('point', [1, 4], { ...pointStyle, name: 'B', fillColor: '#22d3ee', strokeColor: '#0891b2' })
        const C = board.create('point', [
          () => A.X() + B.X(),
          () => A.Y() + B.Y(),
        ], { ...pointStyle, name: 'A+B', fixed: true, fillColor: '#fb923c', strokeColor: '#ea580c' })

        // Vectors
        board.create('arrow', [O, A], { strokeColor: '#818cf8', strokeWidth: 2.5, lastArrow: { type: 2, size: 6 } })
        board.create('arrow', [O, B], { strokeColor: '#22d3ee', strokeWidth: 2.5, lastArrow: { type: 2, size: 6 } })
        board.create('arrow', [O, C], { strokeColor: '#fb923c', strokeWidth: 3, lastArrow: { type: 2, size: 7 } })

        // Parallelogram
        board.create('segment', [A, C], { strokeColor: '#22d3ee', strokeWidth: 1, dash: 2, point1: { visible: false }, point2: { visible: false } })
        board.create('segment', [B, C], { strokeColor: '#818cf8', strokeWidth: 1, dash: 2, point1: { visible: false }, point2: { visible: false } })

        // Labels
        board.create('text', [
          -9, 7,
          () => `A⃗ = (${A.X().toFixed(1)}, ${A.Y().toFixed(1)})`
        ], { fontSize: 12, color: '#818cf8', fixed: true })
        board.create('text', [
          -9, 6,
          () => `B⃗ = (${B.X().toFixed(1)}, ${B.Y().toFixed(1)})`
        ], { fontSize: 12, color: '#22d3ee', fixed: true })
        board.create('text', [
          -9, 5,
          () => `A⃗+B⃗ = (${C.X().toFixed(1)}, ${C.Y().toFixed(1)})`
        ], { fontSize: 12, color: '#fb923c', fixed: true })
        break
      }
    }

    board.update()
  }, [isDark])

  // ── Mouse coordinate tracking ────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setupCoordTracking = useCallback((board: any) => {
    if (!board) return

    const el = containerRef.current
    if (!el) return

    const handleMove = (e: MouseEvent) => {
      try {
        const coords = board.getUsrCoordsOfMouse(e)
        if (coords && coords.length >= 2) {
          setCoordLabel(`(${coords[0].toFixed(2)}, ${coords[1].toFixed(2)})`)
        }
      } catch { /* ignore */ }
    }
    const handleLeave = () => setCoordLabel('')

    el.addEventListener('mousemove', handleMove)
    el.addEventListener('mouseleave', handleLeave)

    return () => {
      el.removeEventListener('mousemove', handleMove)
      el.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  // ── Main effect: load JSXGraph then init ─────────────────────
  useEffect(() => {
    let cancelled = false

    loadJSXGraph()
      .then(() => {
        if (cancelled) return
        setIsLoading(false)

        const board = initBoard()
        if (!board) return

        if (geometryPreset) {
          buildGeometryPreset(board, geometryPreset)
        } else {
          plotFunctions(board)
        }

        setupCoordTracking(board)
      })
      .catch((err) => {
        console.error('JSXGraph load failed:', err)
        setError('JSXGraph 加载失败，请检查网络连接')
        setIsLoading(false)
      })

    return () => {
      cancelled = true
      if (boardRef.current) {
        const JXG = getJXG()
        try { JXG?.JSXGraph?.freeBoard(boardRef.current) } catch { /* ignore */ }
        boardRef.current = null
      }
    }
  }, [expressions, geometryPreset, isDark, initBoard, plotFunctions, buildGeometryPreset, setupCoordTracking])

  // ── Zoom controls ────────────────────────────────────────────
  const handleZoomIn = () => boardRef.current?.zoomIn()
  const handleZoomOut = () => boardRef.current?.zoomOut()
  const handleReset = () => {
    if (boardRef.current) {
      boardRef.current.setBoundingBox([-10, 8, 10, -8], false)
      boardRef.current.update()
    }
  }

  // ── Loading state ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={`jsxgraph-wrapper ${isDark ? 'jsxgraph-dark' : ''} ${className}`} style={{ height: '420px' }}>
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Icon icon="ph:spinner" className="w-6 h-6 animate-spin" />
            <span className="text-sm font-medium">加载交互画板…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`jsxgraph-wrapper ${isDark ? 'jsxgraph-dark' : ''} ${className}`}>
      <div
        id={containerId}
        ref={containerRef}
        className="jsxgraph-container"
        style={{ width: '100%', height: '420px' }}
        role="img"
        aria-label="数学函数图像"
      />

      {/* Coordinate tooltip */}
      {coordLabel && (
        <div className="jsxgraph-coord-label">
          {coordLabel}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="jsxgraph-error">
          <Icon icon="ph:warning-bold" className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Zoom controls */}
      <div className="jsxgraph-controls" role="toolbar" aria-label="图像缩放控制">
        <button onClick={handleZoomIn} title="放大" aria-label="放大图像" className="jsxgraph-ctrl-btn">
          <Icon icon="ph:plus-bold" className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleZoomOut} title="缩小" aria-label="缩小图像" className="jsxgraph-ctrl-btn">
          <Icon icon="ph:minus-bold" className="w-3.5 h-3.5" />
        </button>
        <div className="jsxgraph-ctrl-divider" />
        <button onClick={handleReset} title="重置视图" aria-label="重置视图" className="jsxgraph-ctrl-btn">
          <Icon icon="ph:arrows-in-bold" className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Interaction hint */}
      <div className="jsxgraph-hint">
        <Icon icon="ph:hand-grabbing" className="w-3.5 h-3.5" />
        <span>拖拽平移 · 滚轮缩放</span>
      </div>
    </div>
  )
}
