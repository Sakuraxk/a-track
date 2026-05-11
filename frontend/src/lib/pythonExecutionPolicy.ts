export type PythonExecutionTarget = 'frontend' | 'backend'

export interface PythonExecutionPolicyResult {
  allowed: boolean
  target: PythonExecutionTarget
  runnable: boolean
  message: string | null
  summary: string
  requiredMocks: {
    mindspore: boolean
    torch: boolean
  }
}

interface ExecutionLimitRule {
  label: string
  regex: RegExp
  explanation: string
}

interface ExecutionIllustrativeRule {
  label: string
  regex: RegExp
  explanation: string
}

interface UnsupportedImportRule {
  label: string
  imports: string[]
  explanation: string
}

/**
 * 简化的 Python 代码预处理 — 移除注释和字符串内容
 * 防止注释中的 `# model.train()` 或字符串中的 `"model.train()"` 误触发后端规则
 */
function stripCommentsAndStrings(code: string): string {
  return code
    .split('\n')
    .map(line => {
      let result = line
      // 移除字符串内容（保留引号结构，清空内部内容）
      result = result.replace(/"""[\s\S]*?"""/g, '""')
      result = result.replace(/'''[\s\S]*?'''/g, "''")
      result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""')
      result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''")
      // 移除行内注释
      result = result.replace(/#.*$/, '')
      return result
    })
    .join('\n')
}

const FRONTEND_CAPABILITY_SUMMARY = [
  '前端沙箱支持稳定的轻量 Python 教学代码：标准 Python、小规模 numpy，以及约定好的 MindSpore 轻量子集。',
  'MindSpore 轻量子集仅覆盖 Tensor / Parameter、shape / dtype / size / ndim / T、索引与布尔掩码、reshape、ops.matmul / reduce_sum / reduce_mean / transpose / squeeze / expand_dims / concat / stack、简单 nn.Cell 与 ops.GradOperation 教学示例。',
].join('\n')

const BACKEND_CAPABILITY_SUMMARY = [
  '该示例不会在前端浏览器沙箱执行，会自动切换到后端沙箱。',
  '后端沙箱适合训练循环、数据集流水线、较长迭代和需要已安装科学计算库的代码，更适合后端沙箱或本地 Python 环境。',
  '如果后端环境仍缺少真实运行时，系统会明确说明，不会假装支持。',
].join('\n')

const EXECUTION_LIMIT_RULES: ExecutionLimitRule[] = [
  {
    label: 'MindSpore 数据集流水线',
    regex: /\b(mindspore\.dataset|ms\.dataset|GeneratorDataset|NumpySlicesDataset|MindDataset)\b/i,
    explanation: '浏览器内 Python 运行时不适合执行数据集加载、批处理、shuffle/map 这类数据流水线。',
  },
  {
    label: '训练与优化步骤',
    regex: /(mindspore\.train|ms\.train|TrainOneStepCell|WithLossCell|Model\s*\(|optimizer\.step\s*\(|loss\.backward\s*\(|\.train\s*\(|\.eval\s*\(|\.predict\s*\()/i,
    explanation: '训练循环、反向传播和优化器步骤属于重计算任务，前端沙箱无法稳定、可信地执行。',
  },
  {
    label: '复杂神经网络层',
    regex: /\b(nn\.(Dense|Conv\d*d|LSTM|GRU|Transformer|Embedding|BatchNorm\d*d|LayerNorm)|ms\.nn\.(Dense|Conv\d*d|LSTM|GRU|Transformer|Embedding|BatchNorm\d*d|LayerNorm))\b/i,
    explanation: '复杂网络层依赖真实深度学习运行时与更完整的算子支持，不属于前端轻量教学子集。',
  },
  {
    label: '高开销迭代',
    regex: /\bfor\s+\w+\s+in\s+range\(\s*\d{4,}\s*\)\s*:/i,
    explanation: '检测到较大的循环次数（≥1000 次），这类代码在浏览器环境中可能阻塞页面响应。',
  },
]

const ILLUSTRATIVE_RULES: ExecutionIllustrativeRule[] = [
  {
    label: '遗留仅示意标记',
    regex: /^[ \t]*(?:#|\/\/)\s*sandbox\s*:\s*illustrative\b/im,
    explanation: '检测到旧版仅示意标记；当前系统已取消仅示意分层，这类代码会统一转交后端执行。',
  },
  {
    label: '遗留示意说明',
    regex: /^[ \t]*(?:#|\/\/)\s*(?:仅示意|示意代码|illustrative only)\b/im,
    explanation: '检测到旧版示意注释；当前系统会将其视为后端执行示例。',
  },
]

const FRONTEND_PACKAGE_ALLOWLIST = new Set(['numpy', 'mindspore', 'sandbox_datasets', 'matplotlib'])

/** 前端安全的 Python 标准库子集 — 仅包含 Pyodide 中稳定可用且无系统级副作用的模块（os/sys/subprocess 等故意排除） */
const PYTHON_STDLIB_MODULES = new Set([
  'abc', 'array', 'base64', 'collections', 'contextlib', 'copy', 'csv', 'dataclasses', 'datetime',
  'decimal', 'enum', 'fractions', 'functools', 'hashlib', 'heapq', 'itertools', 'io', 'json', 'math',
  'operator', 'pathlib', 'random', 're', 'statistics', 'string', 'textwrap', 'time', 'typing', 'uuid',
])

function extractImportedModules(code: string): string[] {
  const imports = new Set<string>()
  const importPattern = /^[ \t]*(?:from\s+([a-zA-Z_][\w.]*)\s+import|import\s+([a-zA-Z_][\w.]*))/gm

  for (const match of code.matchAll(importPattern)) {
    const moduleName = (match[1] ?? match[2] ?? '').split('.')[0]?.trim()
    if (moduleName) {
      imports.add(moduleName)
    }
  }

  return Array.from(imports)
}

function findUnsupportedFrontendImports(code: string): UnsupportedImportRule[] {
  const importedModules = extractImportedModules(code)
  const unsupportedModules = importedModules.filter(
    (moduleName) => !PYTHON_STDLIB_MODULES.has(moduleName) && !FRONTEND_PACKAGE_ALLOWLIST.has(moduleName)
  )

  if (unsupportedModules.length === 0) {
    return []
  }

  return [{
    label: '前端未声明支持的第三方库',
    imports: unsupportedModules,
    explanation: `检测到 ${unsupportedModules.join(', ')}。前端沙箱只承诺标准 Python、numpy 与约定的 MindSpore 轻量子集，不依赖偶然可用的浏览器包。`,
  }]
}

function buildBackendMessage(matchedRules: ExecutionLimitRule[]): string {
  const reasons = matchedRules.map((rule, index) => `${index + 1}. ${rule.label}：${rule.explanation}`)

  return [
    '当前前端沙箱未执行这段 Python 代码。',
    '',
    '原因：',
    ...reasons,
    '',
    '说明：',
    FRONTEND_CAPABILITY_SUMMARY,
    '这类代码更适合后端沙箱或本地 Python 环境。',
    '',
    '建议：',
    '1. 轻量概念示例请保留 Tensor / ops / 小型前向计算版本。',
    '2. 完整训练、数据集或复杂网络示例请转交后端或本地真实运行时。',
    '3. 如需强制走后端，请显式写明 `# sandbox: backend`。',
  ].join('\n')
}

function buildLegacyIllustrativeMessage(rule: ExecutionIllustrativeRule): string {
  return [
    '检测到遗留的“仅示意”标记，当前系统已不再保留仅示意执行层。',
    '',
    `原因：${rule.label}。${rule.explanation}`,
    '',
    '处理方式：该代码会统一转交后端沙箱执行；如果后端缺少真实运行时，系统会明确提示。',
  ].join('\n')
}

export function getPythonExecutionDirective(code: string): PythonExecutionTarget | null {
  const match = code.match(/^[ \t]*(?:#|\/\/)\s*sandbox\s*:\s*(frontend|backend|illustrative)\b/im)
  const directive = match?.[1]?.toLowerCase()
  if (directive === 'frontend') return 'frontend'
  if (directive === 'backend' || directive === 'illustrative') return 'backend'
  return null
}

export function analyzePythonExecution(code: string): PythonExecutionPolicyResult {
  const requiredMocks = {
    mindspore: /\bmindspore\b/i.test(code),
    torch: /\btorch\b/i.test(code),
  }

  const directive = getPythonExecutionDirective(code)
  const illustrativeRule = ILLUSTRATIVE_RULES.find((rule) => rule.regex.test(code))

  // 使用去除注释和字符串的代码进行规则匹配，避免误判
  const strippedCode = stripCommentsAndStrings(code)
  const matchedRules = EXECUTION_LIMIT_RULES.filter((rule) => rule.regex.test(strippedCode))
  const unsupportedImports = findUnsupportedFrontendImports(code)
  const legacyIllustrativeReason = illustrativeRule
    ? [{
        label: illustrativeRule.label,
        regex: /.^/,
        explanation: illustrativeRule.explanation,
      }]
    : []

  const hasBackendIndicators = matchedRules.length > 0 || unsupportedImports.length > 0 || legacyIllustrativeReason.length > 0

  // # sandbox: frontend 强制前端执行，但若检测到后端特征则附加警告
  if (directive === 'frontend') {
    return {
      allowed: true,
      target: 'frontend',
      runnable: true,
      message: null,
      summary: hasBackendIndicators
        ? '⚠️ 已通过 # sandbox: frontend 强制前端执行。检测到部分代码特征通常需要后端运行，如遇错误请移除该指令。\n\n' + FRONTEND_CAPABILITY_SUMMARY
        : FRONTEND_CAPABILITY_SUMMARY,
      requiredMocks,
    }
  }

  if (directive === 'backend' || hasBackendIndicators) {
    const importReasons = unsupportedImports.map((rule) => ({
      label: `${rule.label}：${rule.imports.join(', ')}`,
      regex: /.^/,
      explanation: rule.explanation,
    }))
    const legacyMessage = illustrativeRule ? `${buildLegacyIllustrativeMessage(illustrativeRule)}\n\n` : ''
    return {
      allowed: false,
      target: 'backend',
      runnable: true,
      message: `${legacyMessage}${buildBackendMessage([...legacyIllustrativeReason, ...matchedRules, ...importReasons])}`,
      summary: BACKEND_CAPABILITY_SUMMARY,
      requiredMocks,
    }
  }

  return {
    allowed: true,
    target: 'frontend',
    runnable: true,
    message: null,
    summary: FRONTEND_CAPABILITY_SUMMARY,
    requiredMocks,
  }
}
