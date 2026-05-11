/**
 * 数学引擎 — 基于 math.js 的符号计算与函数可视化
 */
import { derivative, simplify, parse, evaluate, rationalize, type MathNode } from 'mathjs'

// ─── 内置常量/函数名，不算做自由参数 ───────────────────────────────
const BUILTIN_NAMES = new Set([
  'x', 'y', 'z', 'e', 'pi', 'i', 'Infinity',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sinh', 'cosh', 'tanh', 'sqrt', 'cbrt', 'abs', 'ceil', 'floor', 'round',
  'log', 'log2', 'log10', 'exp', 'pow', 'mod', 'sign', 'min', 'max',
  'sec', 'csc', 'cot',
])

// ─── 输入预处理 ───────────────────────────────────────────────────
export interface PreprocessResult {
  expr: string
  mode: 'derivative' | 'integral' | 'matrix' | 'normal'
}

export function preprocessExpression(raw: string): PreprocessResult {
  let expr = raw.trim()

  // d/dx (...) → extract inner and mark as derivative
  const ddxMatch = expr.match(/^d\/d([a-z])\s*\(?(.+?)\)?$/i)
  if (ddxMatch) {
    return { expr: ddxMatch[2].trim(), mode: 'derivative' }
  }

  // ∫ ... dx → extract and mark as integral
  const intMatch = expr.match(/^[∫]\s*(.+?)\s*d([a-z])$/i)
  if (intMatch) {
    return { expr: intMatch[1].trim(), mode: 'integral' }
  }

  // Matrix detection
  if (expr.startsWith('[[')) {
    return { expr, mode: 'matrix' }
  }

  return { expr, mode: 'normal' }
}

// ─── 参数检测 ─────────────────────────────────────────────────────
export function detectParameters(expr: string): string[] {
  try {
    const node = parse(expr)
    const params = new Set<string>()
    node.traverse((n: MathNode) => {
      if (n.type === 'SymbolNode' && 'name' in n) {
        const name = (n as { name: string }).name
        if (!BUILTIN_NAMES.has(name)) params.add(name)
      }
    })
    return Array.from(params).sort()
  } catch {
    return []
  }
}

// ─── 符号推演 ─────────────────────────────────────────────────────

export interface DerivationStep {
  label: string
  latex: string
  description: string
}

/** 对表达式执行多步推演（自动识别求导/积分/矩阵） */
export function deriveExpression(rawExpr: string): DerivationStep[] {
  const { expr, mode } = preprocessExpression(rawExpr)

  if (mode === 'integral') return integrateExpression(expr)
  if (mode === 'matrix') return deriveMatrixSteps(rawExpr)

  const steps: DerivationStep[] = []
  const forceDerivative = mode === 'derivative'

  try {
    const parsed = parse(expr)
    steps.push({
      label: '原始表达式',
      latex: parsed.toTex(),
      description: '输入的数学表达式',
    })

    // 化简
    try {
      const simplified = simplify(expr)
      const simplifiedTex = simplified.toTex()
      if (simplifiedTex !== parsed.toTex()) {
        steps.push({ label: '化简', latex: simplifiedTex, description: '合并同类项、消除冗余' })
      }
    } catch { /* skip */ }

    // 有理化
    try {
      const rationalized = rationalize(expr)
      const rationalTex = rationalized.toTex()
      if (rationalTex !== steps[steps.length - 1].latex) {
        steps.push({ label: '展开/有理化', latex: rationalTex, description: '展开括号或通分' })
      }
    } catch { /* skip */ }

    // 求导
    try {
      const deriv = derivative(expr, 'x')

      if (forceDerivative) {
        steps.push({ label: '应用求导法则', latex: `\\frac{d}{dx}\\left(${parsed.toTex()}\\right)`, description: '对整个表达式关于 x 求导' })
      }

      // 逐项步骤
      addTermByTermDerivSteps(parsed, steps)

      // 最终结果
      const derivSimplified = simplify(deriv.toString())
      steps.push({
        label: '求导结果',
        latex: `\\frac{d}{dx}\\left(${parsed.toTex()}\\right) = ${derivSimplified.toTex()}`,
        description: '最终导数（已化简）',
      })
    } catch { /* skip if no variable x */ }
  } catch (err) {
    steps.push({ label: '解析错误', latex: String(err), description: '无法解析此表达式，请检查语法' })
  }

  return steps
}

// ─── 逐项求导步骤 ──────────────────────────────────────────────────
function addTermByTermDerivSteps(node: MathNode, steps: DerivationStep[]) {
  try {
    const terms = splitAddTerms(node)
    if (terms.length <= 1) return

    steps.push({ label: '应用和差法则', latex: '\\text{对每一项分别求导}', description: '加减法的导数等于各项导数的和差' })

    for (const term of terms) {
      try {
        const termStr = term.toString()
        const d = derivative(termStr, 'x')
        const dSimp = simplify(d.toString())
        const label = termStr.startsWith('-') ? `对 ${termStr} 求导` : `对 ${termStr} 求导`
        steps.push({
          label,
          latex: `\\frac{d}{dx}\\left(${term.toTex()}\\right) = ${dSimp.toTex()}`,
          description: describeDerivRule(term),
        })
      } catch { /* skip term */ }
    }
  } catch { /* skip if not decomposable */ }
}

function splitAddTerms(node: MathNode): MathNode[] {
  if (node.type === 'OperatorNode' && 'op' in node) {
    const op = (node as { op: string }).op
    const args = (node as unknown as { args: MathNode[] }).args
    if ((op === '+' || op === '-') && args?.length === 2) {
      const left = splitAddTerms(args[0])
      if (op === '-') {
        // Wrap right side in negation
        const negRight = parse(`-(${args[1].toString()})`)
        return [...left, negRight]
      }
      return [...left, ...splitAddTerms(args[1])]
    }
  }
  return [node]
}

function describeDerivRule(term: MathNode): string {
  const s = term.toString()
  if (/^-?\d+$/.test(s.trim())) return '常数项的导数为 0'
  if (/x\^\d+/.test(s) || /\*\s*x\^\d+/.test(s)) return '使用幂法则: d/dx(xⁿ) = n·xⁿ⁻¹'
  if (/sin|cos|tan/.test(s)) return '使用三角函数求导法则'
  if (/exp|e\^/.test(s)) return '使用指数函数求导法则'
  if (/log|ln/.test(s)) return '使用对数函数求导法则'
  if (/\*\s*x\b/.test(s) && !/x\^/.test(s)) return '线性项: d/dx(ax) = a'
  return '应用求导法则'
}

// ─── 基础积分引擎 ──────────────────────────────────────────────────
export function integrateExpression(expr: string): DerivationStep[] {
  const steps: DerivationStep[] = []
  try {
    const parsed = parse(expr)
    steps.push({ label: '被积表达式', latex: `\\int ${parsed.toTex()} \\, dx`, description: '识别为不定积分运算' })

    // Try substitution patterns first
    const subResult = trySubstitutionIntegral(expr)
    if (subResult) {
      steps.push(...subResult.steps)
      steps.push({ label: '积分结果', latex: `${subResult.resultTex} + C`, description: '不定积分需要加上积分常数 C' })
      return steps
    }

    // Try term-by-term integration
    const terms = splitAddTerms(parsed)
    if (terms.length > 1) {
      steps.push({ label: '应用线性性', latex: '\\text{对每一项分别积分}', description: '积分的线性性质：各项分别积分后求和' })
    }

    const resultParts: string[] = []
    for (const term of terms) {
      const termStr = term.toString()
      const result = integrateTerm(termStr)
      if (result) {
        steps.push({ label: `积分 ${termStr}`, latex: `\\int ${term.toTex()} \\, dx = ${result.tex}`, description: result.rule })
        resultParts.push(result.expr)
      } else {
        steps.push({ label: `积分 ${termStr}`, latex: `\\int ${term.toTex()} \\, dx`, description: '该项无法通过基础规则积分' })
      }
    }

    if (resultParts.length > 0) {
      try {
        const combined = resultParts.join(' + ')
        const simpTex = simplify(combined).toTex()
        steps.push({ label: '积分结果', latex: simpTex + ' + C', description: '不定积分需要加上积分常数 C' })
      } catch {
        steps.push({ label: '积分结果', latex: resultParts.join(' + ') + ' + C', description: '不定积分需要加上积分常数 C' })
      }
    }
  } catch (err) {
    steps.push({ label: '解析错误', latex: String(err), description: '无法解析此表达式' })
  }
  return steps
}

function integrateTerm(expr: string): { expr: string; tex: string; rule: string } | null {
  const s = expr.trim()
  // Constant
  const constMatch = s.match(/^(-?[\d.]+)$/)
  if (constMatch) {
    const c = constMatch[1]
    return { expr: `${c}*x`, tex: `${c} x`, rule: '常数积分: ∫a dx = ax' }
  }
  // Pure x (no exponent)
  if (s === 'x') return { expr: '0.5*x^2', tex: '\\frac{1}{2} x^{2}', rule: '幂法则: ∫x dx = x²/2' }
  if (s === '-x' || s === '-(x)') return { expr: '-0.5*x^2', tex: '-\\frac{1}{2} x^{2}', rule: '幂法则' }
  // a*x^n
  const powMatch = s.match(/^(-?[\d.]*)\*?x\^(-?[\d.]+)$/)
  if (powMatch) {
    const a = powMatch[1] === '' || powMatch[1] === undefined ? 1 : parseFloat(powMatch[1])
    const n = parseFloat(powMatch[2])
    if (n === -1) return { expr: `${a}*log(abs(x))`, tex: `${a === 1 ? '' : a}\\ln|x|`, rule: '∫x⁻¹ dx = ln|x|' }
    const newN = n + 1
    const coeff = a / newN
    return { expr: `${coeff}*x^${newN}`, tex: `${fracTex(a, newN)} x^{${newN}}`, rule: `幂法则: ∫xⁿdx = xⁿ⁺¹/(n+1), n=${n}` }
  }
  // a*x (linear)
  const linMatch = s.match(/^(-?[\d.]+)\*?x$/)
  if (linMatch) {
    const a = parseFloat(linMatch[1])
    return { expr: `${a / 2}*x^2`, tex: `${fracTex(a, 2)} x^{2}`, rule: '幂法则: ∫ax dx = ax²/2' }
  }
  // sin(x)
  if (s === 'sin(x)') return { expr: '-cos(x)', tex: '-\\cos(x)', rule: '∫sin(x) dx = -cos(x)' }
  if (s === '-sin(x)' || s === '-(sin(x))') return { expr: 'cos(x)', tex: '\\cos(x)', rule: '∫-sin(x) dx = cos(x)' }
  // cos(x)
  if (s === 'cos(x)') return { expr: 'sin(x)', tex: '\\sin(x)', rule: '∫cos(x) dx = sin(x)' }
  // exp(x)
  if (s === 'exp(x)') return { expr: 'exp(x)', tex: 'e^{x}', rule: '∫eˣ dx = eˣ' }
  // 1/x
  if (s === '1/x') return { expr: 'log(abs(x))', tex: '\\ln|x|', rule: '∫1/x dx = ln|x|' }
  return null
}

function fracTex(num: number, den: number): string {
  const v = num / den
  if (Number.isInteger(v)) return String(v)
  if (Number.isInteger(num) && Number.isInteger(den)) return `\\frac{${num}}{${den}}`
  return v.toFixed(4)
}

function trySubstitutionIntegral(expr: string): { steps: DerivationStep[]; resultTex: string } | null {
  // Pattern: (2*x)/(x^2+1) → ln|x²+1|
  const m1 = expr.match(/^\(?\s*(\d*)\*?x\s*\)?\s*\/\s*\(\s*x\^2\s*([+-])\s*(\d+)\s*\)$/)
  if (m1) {
    const coeff = m1[1] ? parseInt(m1[1]) : 1
    const sign = m1[2]
    const c = m1[3]
    if (coeff === 2) {
      return {
        steps: [
          { label: '换元法', latex: `\\text{令 } u = x^2 ${sign} ${c}, \\text{ 则 } du = 2x \\, dx`, description: '识别到分子是分母导数的形式' },
          { label: '代入', latex: `\\int \\frac{du}{u} = \\ln|u|`, description: '化为标准形式 ∫du/u' },
          { label: '回代', latex: `\\ln|x^2 ${sign} ${c}|`, description: '将 u 回代为原始表达式' },
        ],
        resultTex: `\\ln|x^2 ${sign} ${c}|`,
      }
    }
  }
  return null
}

// ─── 矩阵步骤展示 ──────────────────────────────────────────────────
function deriveMatrixSteps(expr: string): DerivationStep[] {
  const steps: DerivationStep[] = []
  try {
    const parsed = parse(expr)
    steps.push({ label: '矩阵表达式', latex: parsed.toTex(), description: '输入的矩阵运算' })
    const result = evaluate(expr)
    if (result && typeof result === 'object' && 'toArray' in result) {
      const arr = result.toArray() as number[][]
      // Show result
      const resParsed = parse(JSON.stringify(arr))
      steps.push({ label: '计算结果', latex: resParsed.toTex(), description: '矩阵运算结果' })

      // Try to show element-by-element for multiplication
      const mulMatch = expr.match(/^(\[\[.+?\]\])\s*\*\s*(\[\[.+?\]\])$/)
      if (mulMatch) {
        const A = evaluate(mulMatch[1]).toArray() as number[][]
        const B = evaluate(mulMatch[2]).toArray() as number[][]
        const rows = A.length
        const cols = (B[0] as number[]).length
        const k = (A[0] as number[]).length
        for (let i = 0; i < rows && i < 3; i++) {
          for (let j = 0; j < cols && j < 3; j++) {
            const parts = []
            for (let p = 0; p < k; p++) parts.push(`${A[i][p]} \\times ${B[p][j]}`)
            const val = arr[i][j]
            steps.push({
              label: `元素 [${i + 1},${j + 1}]`,
              latex: `${parts.join(' + ')} = ${val}`,
              description: `第 ${i + 1} 行 × 第 ${j + 1} 列`,
            })
          }
        }
      }
    }
  } catch (err) {
    steps.push({ label: '解析错误', latex: String(err), description: '无法解析矩阵表达式' })
  }
  return steps
}

// ─── 关键点检测 ────────────────────────────────────────────────────
export interface CriticalPoint {
  x: number
  y: number
  type: 'max' | 'min' | 'zero'
}

export function findCriticalPoints(expr: string, xMin = -10, xMax = 10): CriticalPoint[] {
  const points: CriticalPoint[] = []
  const N = 500
  const dx = (xMax - xMin) / N

  let derivExpr: string | null = null
  try { derivExpr = derivative(expr, 'x').toString() } catch { /* no derivative */ }

  const evalSafe = (e: string, x: number): number | null => {
    try {
      const r = evaluate(e, { x }) as number
      return typeof r === 'number' && isFinite(r) ? r : null
    } catch { return null }
  }

  // Find zeros of f(x)
  for (let i = 0; i < N; i++) {
    const x1 = xMin + i * dx
    const x2 = x1 + dx
    const y1 = evalSafe(expr, x1)
    const y2 = evalSafe(expr, x2)
    if (y1 === null || y2 === null) continue
    if (y1 * y2 <= 0 && Math.abs(y1 - y2) < 100) {
      // Bisection
      let lo = x1, hi = x2
      for (let k = 0; k < 20; k++) {
        const mid = (lo + hi) / 2
        const ym = evalSafe(expr, mid)
        if (ym === null) break
        if (Math.abs(ym) < 1e-10) { lo = hi = mid; break }
        if (y1 * ym <= 0) hi = mid; else lo = mid
      }
      const xz = (lo + hi) / 2
      const yz = evalSafe(expr, xz)
      if (yz !== null && Math.abs(yz) < 0.01) {
        points.push({ x: Math.round(xz * 1000) / 1000, y: Math.round(yz * 1000) / 1000, type: 'zero' })
      }
    }
  }

  // Find extrema via derivative zeros
  if (derivExpr) {
    for (let i = 0; i < N; i++) {
      const x1 = xMin + i * dx
      const x2 = x1 + dx
      const d1 = evalSafe(derivExpr, x1)
      const d2 = evalSafe(derivExpr, x2)
      if (d1 === null || d2 === null) continue
      if (d1 * d2 <= 0 && Math.abs(d1 - d2) < 100) {
        let lo = x1, hi = x2
        for (let k = 0; k < 20; k++) {
          const mid = (lo + hi) / 2
          const dm = evalSafe(derivExpr, mid)
          if (dm === null) break
          if (Math.abs(dm) < 1e-10) { lo = hi = mid; break }
          if (d1 * dm <= 0) hi = mid; else lo = mid
        }
        const xc = (lo + hi) / 2
        const yc = evalSafe(expr, xc)
        if (yc === null) continue
        const type: 'max' | 'min' = d1 > 0 ? 'max' : 'min'
        const rx = Math.round(xc * 1000) / 1000
        const ry = Math.round(yc * 1000) / 1000
        // Avoid duplicates with zeros
        if (!points.some(p => Math.abs(p.x - rx) < 0.05)) {
          points.push({ x: rx, y: ry, type })
        }
      }
    }
  }

  return points
}

// ─── 2D 函数采样 ──────────────────────────────────────────────────

export interface Point2D { x: number; y: number }

export function sampleFunction2D(
  expr: string,
  xMin = -10,
  xMax = 10,
  steps = 200
): Point2D[] {
  const points: Point2D[] = []
  const dx = (xMax - xMin) / steps

  for (let i = 0; i <= steps; i++) {
    const x = xMin + i * dx
    try {
      const y = evaluate(expr, { x }) as number
      if (typeof y === 'number' && isFinite(y)) {
        points.push({ x, y })
      }
    } catch {
      // Skip invalid points
    }
  }

  return points
}

// ─── 3D 函数采样 ──────────────────────────────────────────────────

export interface Point3D { x: number; y: number; z: number }

export function sampleFunction3D(
  expr: string,
  range = 5,
  resolution = 40
): { points: Point3D[]; grid: number[][]; xRange: [number, number]; yRange: [number, number]; zRange: [number, number] } {
  const points: Point3D[] = []
  const grid: number[][] = []
  let zMin = Infinity
  let zMax = -Infinity

  const step = (range * 2) / resolution

  for (let i = 0; i <= resolution; i++) {
    const row: number[] = []
    const x = -range + i * step
    for (let j = 0; j <= resolution; j++) {
      const y = -range + j * step
      try {
        const z = evaluate(expr, { x, y }) as number
        if (typeof z === 'number' && isFinite(z)) {
          points.push({ x, y, z })
          row.push(z)
          if (z < zMin) zMin = z
          if (z > zMax) zMax = z
        } else {
          row.push(0)
        }
      } catch {
        row.push(0)
      }
    }
    grid.push(row)
  }

  if (zMin === Infinity) { zMin = -1; zMax = 1 }

  return {
    points,
    grid,
    xRange: [-range, range],
    yRange: [-range, range],
    zRange: [zMin, zMax],
  }
}

// ─── 预设公式模板 ──────────────────────────────────────────────────

export interface FormulaTemplate {
  id: string
  title: string
  expr: string
  type: '2d' | '3d' | 'derive' | 'geometry'
  description: string
}

export const FORMULA_TEMPLATES: FormulaTemplate[] = [
  // 2D 函数
  { id: 'sin', title: '正弦函数', expr: 'sin(x)', type: '2d', description: 'y = sin(x)' },
  { id: 'parabola', title: '抛物线', expr: 'x^2', type: '2d', description: 'y = x²' },
  { id: 'cubic', title: '三次函数', expr: 'x^3 - 3*x', type: '2d', description: 'y = x³ - 3x' },
  { id: 'exp', title: '指数函数', expr: 'exp(x)', type: '2d', description: 'y = eˣ' },
  { id: 'log', title: '对数函数', expr: 'log(x)', type: '2d', description: 'y = ln(x)' },
  { id: 'sincos', title: '三角组合', expr: 'sin(x) + cos(2*x)', type: '2d', description: 'y = sin(x) + cos(2x)' },
  { id: 'abs', title: '绝对值', expr: 'abs(x)', type: '2d', description: 'y = |x|' },
  { id: 'gaussian', title: '高斯函数', expr: 'exp(-x^2)', type: '2d', description: 'y = e^(-x²)' },

  // 3D 函数
  { id: '3d-saddle', title: '马鞍面', expr: 'x^2 - y^2', type: '3d', description: 'z = x² - y²' },
  { id: '3d-paraboloid', title: '抛物面', expr: 'x^2 + y^2', type: '3d', description: 'z = x² + y²' },
  { id: '3d-wave', title: '波浪面', expr: 'sin(x) * cos(y)', type: '3d', description: 'z = sin(x)·cos(y)' },
  { id: '3d-ripple', title: '涟漪面', expr: 'sin(sqrt(x^2 + y^2))', type: '3d', description: 'z = sin(√(x²+y²))' },

  // 推演
  { id: 'derive-quad', title: '二次方程', expr: 'x^2 + 2*x + 1', type: 'derive', description: '展开与因式分解' },
  { id: 'derive-trig', title: '三角恒等式', expr: 'sin(x)^2 + cos(x)^2', type: 'derive', description: '三角函数化简' },
  { id: 'derive-poly', title: '多项式求导', expr: '3*x^4 - 2*x^3 + x^2 - 5', type: 'derive', description: '高次多项式求导' },

  // 几何
  { id: 'geo-circumscribed', title: '三角形外接圆', expr: 'circumscribed', type: 'geometry', description: '拖拽顶点，观察外接圆变化' },
  { id: 'geo-ellipse', title: '椭圆与焦点', expr: 'ellipse', type: 'geometry', description: '拖拽焦点观察椭圆形态' },
  { id: 'geo-tangent', title: '切线可视化', expr: 'tangent', type: 'geometry', description: '拖拽切点观察切线斜率' },
  { id: 'geo-vector', title: '向量加法', expr: 'vector-add', type: 'geometry', description: '拖拽向量观察平行四边形法则' },
]

// ─── 几何预设场景 ───────────────────────────────────────────────────

export type GeometryPresetId = 'circumscribed' | 'ellipse' | 'tangent' | 'vector-add'

export interface GeometryPreset {
  id: GeometryPresetId
  title: string
  description: string
  hint: string
}

export const GEOMETRY_PRESETS: Record<GeometryPresetId, GeometryPreset> = {
  circumscribed: {
    id: 'circumscribed',
    title: '三角形外接圆',
    description: '三个顶点确定唯一外接圆',
    hint: '拖拽 A / B / C 观察外接圆动态变化',
  },
  ellipse: {
    id: 'ellipse',
    title: '椭圆与焦点',
    description: '椭圆上任一点到两焦点距离之和为常数',
    hint: '拖拽焦点 F₁ / F₂ 或椭圆上的点 P',
  },
  tangent: {
    id: 'tangent',
    title: '切线可视化',
    description: '在函数曲线上的某点绘制切线',
    hint: '拖拽红色切点沿曲线移动',
  },
  'vector-add': {
    id: 'vector-add',
    title: '向量加法',
    description: '平行四边形法则：两向量之和',
    hint: '拖拽向量端点 A / B 观察合向量',
  },
}

// ─── JSXGraph 函数转换器 ────────────────────────────────────────────

/**
 * 将 mathjs 风格表达式安全转换为 JSXGraph 可用的 JS 函数。
 * JSXGraph 的 functiongraph 接受 (x) => number 形式的函数。
 */
const ASYMPTOTE_THRESHOLD = 1e6

export function parseToJSXGraphFn(
  expr: string,
  params: Record<string, number> = {},
): (x: number) => number {
  let prevY = NaN
  return (x: number) => {
    try {
      const scope = { x, ...params }
      const result = evaluate(expr, scope) as number
      if (typeof result !== 'number' || !isFinite(result)) return NaN
      // Filter asymptotes (e.g. tan(x) near π/2)
      if (Math.abs(result) > ASYMPTOTE_THRESHOLD) return NaN
      // Detect sign-change jump → likely asymptote
      if (isFinite(prevY) && Math.abs(result - prevY) > ASYMPTOTE_THRESHOLD * 0.5) {
        prevY = result
        return NaN
      }
      prevY = result
      return result
    } catch {
      return NaN
    }
  }
}

/**
 * 将表达式转为 JSXGraph 3D (x,y) => z 函数
 */
export function parseToJSXGraph3DFn(
  expr: string,
  params: Record<string, number> = {},
): (x: number, y: number) => number {
  return (x: number, y: number) => {
    try {
      const scope = { x, y, ...params }
      const result = evaluate(expr, scope) as number
      if (typeof result === 'number' && isFinite(result)) return result
      return NaN
    } catch {
      return NaN
    }
  }
}
