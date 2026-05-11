/**
 * 工程类学科专用代码展示块 — 浅色主题、仅复制、引导到代码沙箱运行
 * 🔧 学工程，就要能写能跑 — 代码在沙箱中运行
 *
 * 设计要点:
 * - 浅色背景，流式输出时不闪烁
 * - 只提供"复制代码"按钮
 * - 提供"复制到代码沙箱"快捷入口（点击后收集页面所有代码块一起发送）
 * - 增量渲染友好：不使用 Monaco Editor，直接用 <pre> + syntax highlighter
 */
import React, { useState, useEffect, useRef, memo } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'

// ── 事件名：通知代码沙箱接收代码 ──
export const CODE_TO_SANDBOX_EVENT = 'code-to-sandbox'

export interface CodeToSandboxPayload {
  code: string
  language: string
  /** 页面上所有代码块（按文档顺序），用于 Notebook 多 Cell 模式 */
  allCodeBlocks?: { code: string; language: string }[]
}

interface EngineeringCodeBlockProps {
  code: string
  language?: string
  /** 是否启用代码沙箱功能（"到沙箱运行"按钮）。设为 false 时仅展示代码、不提供沙箱入口。 */
  sandboxEnabled?: boolean
}

/**
 * 极简语法高亮 —— 不依赖重型库，增量渲染零卡顿
 * 仅针对 Python / JS 做关键字着色，其他语言回退到纯文本
 */
function highlightCode(code: string, language: string): React.ReactNode[] {
  const lang = language.toLowerCase()

  // Python 关键字
  const pythonKeywords = new Set([
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
    'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
    'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
    'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
    'try', 'while', 'with', 'yield',
  ])

  // Python 内置函数
  const pythonBuiltins = new Set([
    'print', 'range', 'len', 'int', 'str', 'float', 'list', 'dict',
    'set', 'tuple', 'type', 'isinstance', 'input', 'open', 'enumerate',
    'zip', 'map', 'filter', 'sorted', 'reversed', 'sum', 'min', 'max',
    'abs', 'round', 'any', 'all', 'super', 'property', 'staticmethod',
    'classmethod', 'hasattr', 'getattr', 'setattr',
  ])

  // JS 关键字
  const jsKeywords = new Set([
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for',
    'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'this',
    'class', 'extends', 'import', 'export', 'default', 'from', 'async',
    'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof',
    'in', 'of', 'true', 'false', 'null', 'undefined', 'void',
  ])

  const isPython = lang === 'python' || lang === 'py'
  const isJS = lang === 'javascript' || lang === 'js' || lang === 'typescript' || lang === 'ts'

  if (!isPython && !isJS) {
    // 回退：纯文本
    return [<span key="plain">{code}</span>]
  }

  const keywords = isPython ? pythonKeywords : jsKeywords
  const builtins = isPython ? pythonBuiltins : new Set<string>()

  const lines = code.replace(/\r\n/g, '\n').split('\n')
  const result: React.ReactNode[] = []

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    if (lineIdx > 0) result.push('\n')

    // 使用非常简单的 tokenizer 来避免过度复杂
    // 按空白和运算符分割，保留分隔符
    const tokens = line.split(/(\s+|[()[\]{},.:;=+\-*/<>!&|^~%@]|"[^"]*"|'[^']*'|#.*$)/g)

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (!token) continue

      const key = `${lineIdx}-${i}`

      // 注释
      if (token.startsWith('#') || token.startsWith('//')) {
        result.push(
          <span key={key} style={{ color: '#6a737d' }}>{token}</span>
        )
        continue
      }

      // 字符串
      if ((token.startsWith('"') && token.endsWith('"')) ||
          (token.startsWith("'") && token.endsWith("'"))) {
        result.push(
          <span key={key} style={{ color: '#22863a' }}>{token}</span>
        )
        continue
      }

      // 数字
      if (/^\d+(\.\d+)?$/.test(token)) {
        result.push(
          <span key={key} style={{ color: '#005cc5' }}>{token}</span>
        )
        continue
      }

      // 关键字
      if (keywords.has(token)) {
        result.push(
          <span key={key} style={{ color: '#d73a49', fontWeight: 600 }}>{token}</span>
        )
        continue
      }

      // 内置函数
      if (builtins.has(token)) {
        result.push(
          <span key={key} style={{ color: '#6f42c1' }}>{token}</span>
        )
        continue
      }

      // 装饰器
      if (token === '@') {
        result.push(
          <span key={key} style={{ color: '#e36209' }}>{token}</span>
        )
        continue
      }

      // 普通文字
      result.push(<span key={key}>{token}</span>)
    }
  }

  return result
}

const EngineeringCodeBlock: React.FC<EngineeringCodeBlockProps> = memo(({ code, language = 'python', sandboxEnabled = true }) => {
  const [copied, setCopied] = useState(false)
  const [sentToSandbox, setSentToSandbox] = useState(false)
  const codeRef = useRef<string>(code)

  // 增量渲染：codeRef 始终追踪最新值
  useEffect(() => {
    codeRef.current = code
  }, [code])

  const handleCopy = () => {
    navigator.clipboard.writeText(codeRef.current)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyToSandbox = () => {
    // 只发送被点击的代码块到沙箱
    window.dispatchEvent(
      new CustomEvent<CodeToSandboxPayload>(CODE_TO_SANDBOX_EVENT, {
        detail: {
          code: codeRef.current,
          language,
        },
      })
    )
    setSentToSandbox(true)
    setTimeout(() => setSentToSandbox(false), 2500)
  }

  // 只有可在沙箱中运行的语言才显示"到沙箱运行"按钮
  const EXECUTABLE_LANGUAGES = new Set([
    'python', 'py', 'javascript', 'js', 'typescript', 'ts',
  ])
  const isExecutable = sandboxEnabled && EXECUTABLE_LANGUAGES.has((language || '').toLowerCase())

  const displayLanguage = language || 'text'
  const lineCount = code.split('\n').filter(l => l.trim()).length

  return (
    <div
      className="engineering-code-block my-5 overflow-hidden rounded-xl border border-slate-200 bg-[#fafbfc] shadow-sm"
    >
      {/* Header bar — 浅色风格 */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-[#f6f8fa] px-4 py-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wide">
            {displayLanguage}
          </span>
          <span className="text-[10px] text-slate-400">
            {lineCount} 行
          </span>

        </div>
        <div className="flex items-center gap-1.5">
          {/* 复制到代码沙箱 — 仅可执行语言显示 */}
          {isExecutable && (
            <button
              onClick={handleCopyToSandbox}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
              title="复制到代码沙箱运行"
            >
              {sentToSandbox ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>已发送</span>
                </>
              ) : (
                <>
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>到沙箱运行</span>
                </>
              )}
            </button>
          )}
          {/* 复制代码 */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title="复制代码"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-600">已复制</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>复制</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code area — 浅色主题，增量渲染友好 */}
      <div className="overflow-x-auto">
        <pre
          className="px-4 py-3 text-[13px] leading-5 font-mono text-slate-800 whitespace-pre"
          style={{
            margin: 0,
            background: 'transparent',
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, Consolas, monospace',
            tabSize: 4,
          }}
        >
          <code>{highlightCode(code, language)}</code>
        </pre>
      </div>
    </div>
  )
})

EngineeringCodeBlock.displayName = 'EngineeringCodeBlock'

export default EngineeringCodeBlock
