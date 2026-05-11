/**
 * 安全代码执行引擎
 * - JavaScript: sandboxed iframe + postMessage
 * - Python: Pyodide WASM (lazy-loaded)
 */

export interface RunResult {
  output: string
  error: string | null
  duration: number // ms
  executionTarget?: 'frontend' | 'backend'
  notice?: string | null
  images?: string[]  // base64-encoded PNG images from matplotlib
}

// ─── JavaScript 执行 ─────────────────────────────────────────────

const JS_SANDBOX_HTML = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>
  const _logs = [];
  const _origConsole = { log: console.log, error: console.error, warn: console.warn };

  console.log = (...a) => _logs.push(a.map(v => typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)).join(' '));
  console.error = (...a) => _logs.push('[ERROR] ' + a.map(v => String(v)).join(' '));
  console.warn = (...a) => _logs.push('[WARN] ' + a.map(v => String(v)).join(' '));

  window.addEventListener('message', async (e) => {
    if (e.data?.type !== 'exec') return;
    const start = performance.now();
    try {
      const result = eval(e.data.code);
      if (result !== undefined) _logs.push(String(result));
      parent.postMessage({ type: 'result', output: _logs.join('\\n'), error: null, duration: performance.now() - start }, '*');
    } catch (err) {
      parent.postMessage({ type: 'result', output: _logs.join('\\n'), error: err.message, duration: performance.now() - start }, '*');
    }
  });
  parent.postMessage({ type: 'ready' }, '*');
</script></body></html>
`

let _jsFrame: HTMLIFrameElement | null = null

function getJsSandbox(): Promise<HTMLIFrameElement> {
  return new Promise((resolve) => {
    // Remove old frame
    if (_jsFrame) {
      _jsFrame.remove()
      _jsFrame = null
    }

    const frame = document.createElement('iframe')
    frame.sandbox.add('allow-scripts')
    frame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;'
    frame.srcdoc = JS_SANDBOX_HTML

    const onReady = (e: MessageEvent) => {
      if (e.data?.type === 'ready' && e.source === frame.contentWindow) {
        window.removeEventListener('message', onReady)
        resolve(frame)
      }
    }
    window.addEventListener('message', onReady)
    document.body.appendChild(frame)
    _jsFrame = frame
  })
}

export async function runJavaScript(code: string, timeoutMs = 5000): Promise<RunResult> {
  const frame = await getJsSandbox()

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ output: '', error: '⏰ 执行超时（5秒限制）', duration: timeoutMs })
      frame.remove()
      _jsFrame = null
    }, timeoutMs)

    const onResult = (e: MessageEvent) => {
      if (e.data?.type === 'result' && e.source === frame.contentWindow) {
        window.removeEventListener('message', onResult)
        clearTimeout(timer)
        resolve({
          output: e.data.output || '',
          error: e.data.error || null,
          duration: Math.round(e.data.duration),
        })
        // Re-create sandbox for next run
        frame.remove()
        _jsFrame = null
      }
    }
    window.addEventListener('message', onResult)
    frame.contentWindow?.postMessage({ type: 'exec', code }, '*')
  })
}

// ─── Python 执行 (Pyodide) ────────────────────────────────────────

let _pyodidePromise: Promise<unknown> | null = null

async function loadPyodide(): Promise<unknown> {
  if (_pyodidePromise) return _pyodidePromise

  _pyodidePromise = new Promise(async (resolve, reject) => {
    try {
      // Load Pyodide script dynamically
      if (!(window as unknown as Record<string, unknown>).loadPyodide) {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js'
        script.async = true
        await new Promise<void>((res, rej) => {
          script.onload = () => res()
          script.onerror = () => rej(new Error('Failed to load Pyodide'))
          document.head.appendChild(script)
        })
      }

      const pyodide = await (window as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>).loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/',
      })
      resolve(pyodide)
    } catch (err) {
      _pyodidePromise = null
      reject(err)
    }
  })

  return _pyodidePromise
}

export async function runPython(code: string, timeoutMs = 10000): Promise<RunResult> {
  const start = performance.now()

  try {
    const pyodide = await loadPyodide() as Record<string, (...args: unknown[]) => unknown>

    // Capture stdout
    pyodide.runPython(`
import sys
from io import StringIO
_stdout_capture = StringIO()
sys.stdout = _stdout_capture
`)

    // Run user code with timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('⏰ 执行超时')), timeoutMs)
    )

    await Promise.race([
      Promise.resolve(pyodide.runPython(code)),
      timeoutPromise,
    ])

    // Get output
    const output = pyodide.runPython(`
sys.stdout = sys.__stdout__
_stdout_capture.getvalue()
`) as string

    return {
      output: output || '',
      error: null,
      duration: Math.round(performance.now() - start),
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    // Clean up Python-specific error formatting
    const cleanError = errorMessage
      .replace(/PythonError: Traceback \(most recent call last\):\n/, '')
      .replace(/\s+File "<exec>", line \d+, in <module>\n/, '')
      .trim()

    return {
      output: '',
      error: cleanError,
      duration: Math.round(performance.now() - start),
    }
  }
}

// ─── Unified Runner ───────────────────────────────────────────────

export type Language = 'javascript' | 'python'

export async function runCode(code: string, language: Language): Promise<RunResult> {
  if (language === 'python') return runPython(code)
  return runJavaScript(code)
}

// ─── Code Templates ───────────────────────────────────────────────

export interface CodeTemplate {
  id: string
  title: string
  language: Language
  code: string
}

export const CODE_TEMPLATES: CodeTemplate[] = [
  {
    id: 'js-hello',
    title: '🟡 JS — Hello World',
    language: 'javascript',
    code: `// Hello World 示例
console.log("Hello, World! 🚀");
console.log("欢迎来到代码沙箱！");`,
  },
  {
    id: 'js-sort',
    title: '🟡 JS — 冒泡排序',
    language: 'javascript',
    code: `// 冒泡排序算法
function bubbleSort(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
      }
    }
  }
  return arr;
}

const data = [64, 34, 25, 12, 22, 11, 90];
console.log("排序前:", data);
console.log("排序后:", bubbleSort([...data]));`,
  },
  {
    id: 'js-fibonacci',
    title: '🟡 JS — 斐波那契数列',
    language: 'javascript',
    code: `// 斐波那契数列生成器
function* fibonacci(n) {
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) {
    yield a;
    [a, b] = [b, a + b];
  }
}

const fib = [...fibonacci(15)];
console.log("前 15 个斐波那契数:", fib.join(", "));`,
  },
  {
    id: 'py-hello',
    title: '🐍 Python — Hello World',
    language: 'python',
    code: `# Hello World 示例
print("Hello, World! 🚀")
print("欢迎来到 Python 沙箱！")

name = "A-Track"
print(f"你正在使用 {name} 学习平台")`,
  },
  {
    id: 'py-sort',
    title: '🐍 Python — 快速排序',
    language: 'python',
    code: `# 快速排序算法
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

data = [3, 6, 8, 10, 1, 2, 1]
print("排序前:", data)
print("排序后:", quicksort(data))`,
  },
  {
    id: 'py-data',
    title: '🐍 Python — 数据分析',
    language: 'python',
    code: `# 简单数据分析
data = [23, 45, 12, 67, 34, 89, 11, 56, 78, 90]

print(f"数据: {data}")
print(f"平均值: {sum(data) / len(data):.2f}")
print(f"最大值: {max(data)}")
print(f"最小值: {min(data)}")
print(f"中位数: {sorted(data)[len(data)//2]}")

# 频率分布
ranges = [(0,30), (30,60), (60,100)]
for low, high in ranges:
    count = sum(1 for x in data if low <= x < high)
    bar = "█" * count
    print(f"  {low:>3}-{high:<3}: {bar} ({count})")`,
  },
]
