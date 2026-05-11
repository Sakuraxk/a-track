import { api, getApiErrorMessage } from '@/lib/api'
import { analyzePythonExecution } from '@/lib/pythonExecutionPolicy'

export interface PythonExecutionResult {
  stdout: string
  stderr: string
  executionTarget: 'frontend' | 'backend'
  notice: string | null
  images?: string[]  // base64-encoded PNG images from matplotlib
}

export interface BackendPythonExecutionResponse {
  success?: boolean
  output: string
  error: string | null
  execution_time_ms: number
  images?: string[]  // base64-encoded PNG images
}

interface BackendPythonExecutionRequest {
  code: string
  timeout: number
}

interface PythonExecutionRouteOptions {
  runInBrowser: (code: string) => Promise<{ stdout: string; stderr: string; images?: string[] }>
  runInBackend?: (payload: BackendPythonExecutionRequest) => Promise<BackendPythonExecutionResponse>
}

const BACKEND_TIMEOUT_SECONDS = 60
const BACKEND_TIMEOUT_MINDSPORE_SECONDS = 120
const BACKEND_EXECUTION_NOTICE = '该代码因性能或运行环境限制，已自动切换到后端沙箱运行。'

function getBackendTimeout(code: string): number {
  if (/\bmindspore\b/i.test(code)) return BACKEND_TIMEOUT_MINDSPORE_SECONDS
  return BACKEND_TIMEOUT_SECONDS
}

async function executePythonInBackend(
  payload: BackendPythonExecutionRequest
): Promise<BackendPythonExecutionResponse> {
  // HTTP timeout = execution timeout + 15s network overhead
  const httpTimeoutMs = payload.timeout * 1000 + 15000
  const response = await api.post<BackendPythonExecutionResponse>('/api/practice/execute', payload, {
    timeout: httpTimeoutMs,
  })
  return response.data
}

function normalizeBackendError(code: string, backendError: string, policyMessage: string | null): string {
  if (/No module named\s+['"]?mindspore['"]?/i.test(backendError) && /\bmindspore\b/i.test(code)) {
    return [
      '后端沙箱当前不提供真实的 MindSpore 运行时。',
      '这段代码已经转交后端执行，但后端环境仍无法加载 MindSpore。',
      '建议将示例改写为 Tensor / ops / 前向计算的轻量版本，或在本地 MindSpore 环境中运行完整训练代码。',
    ].join('\n')
  }

  if (/No module named\s+['"]?torch['"]?/i.test(backendError) && /\btorch\b/i.test(code)) {
    return [
      '后端沙箱当前不提供真实的 PyTorch 运行时。',
      '这段代码已经转交后端执行，但后端环境仍无法加载 torch。',
      '建议改用轻量张量示例，或在本地 PyTorch 环境中运行完整代码。',
    ].join('\n')
  }

  if (backendError.trim().length > 0) {
    return backendError
  }

  return policyMessage ?? '后端沙箱未能成功执行这段代码。'
}

export async function routePythonExecution(
  code: string,
  { runInBrowser, runInBackend = executePythonInBackend }: PythonExecutionRouteOptions
): Promise<PythonExecutionResult> {
  const policy = analyzePythonExecution(code)

  if (policy.target === 'frontend') {
    const result = await runInBrowser(code)
    return {
      ...result,
      executionTarget: 'frontend',
      notice: null,
    }
  }

  try {
    const backendResult = await runInBackend({
      code,
      timeout: getBackendTimeout(code),
    })

    return {
      stdout: backendResult.output || '',
      stderr: backendResult.error
        ? normalizeBackendError(code, backendResult.error, policy.message)
        : '',
      executionTarget: 'backend',
      notice: BACKEND_EXECUTION_NOTICE,
      images: backendResult.images || [],
    }
  } catch (error) {
    return {
      stdout: '',
      stderr: [
        '后端沙箱执行失败。',
        `原因：${getApiErrorMessage(error)}`,
        '',
        policy.message ?? '前端未直接执行这段代码。',
      ].join('\n'),
      executionTarget: 'backend',
      notice: BACKEND_EXECUTION_NOTICE,
    }
  }
}
