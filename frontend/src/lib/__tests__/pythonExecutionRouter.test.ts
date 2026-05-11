import { describe, expect, it, vi } from 'vitest'

import { routePythonExecution } from '@/lib/pythonExecutionRouter'

describe('routePythonExecution', () => {
  it('轻量代码优先走前端运行', async () => {
    const runInBrowser = vi.fn().mockResolvedValue({
      stdout: 'frontend ok',
      stderr: '',
    })
    const runInBackend = vi.fn()

    const result = await routePythonExecution('print("hello")', {
      runInBrowser,
      runInBackend,
    })

    expect(runInBrowser).toHaveBeenCalledWith('print("hello")')
    expect(runInBackend).not.toHaveBeenCalled()
    expect(result).toEqual({
      stdout: 'frontend ok',
      stderr: '',
      executionTarget: 'frontend',
      notice: null,
    })
  })

  it('重代码切换到后端运行并返回说明', async () => {
    const runInBrowser = vi.fn()
    const runInBackend = vi.fn().mockResolvedValue({
      output: 'backend ok',
      error: null,
      execution_time_ms: 321,
    })

    const result = await routePythonExecution('model.train(10, train_dataset)', {
      runInBrowser,
      runInBackend,
    })

    expect(runInBrowser).not.toHaveBeenCalled()
    expect(runInBackend).toHaveBeenCalledWith({
      code: 'model.train(10, train_dataset)',
      timeout: 30,
    })
    expect(result.executionTarget).toBe('backend')
    expect(result.notice).toContain('已自动切换到后端沙箱运行')
    expect(result.stdout).toBe('backend ok')
    expect(result.stderr).toBe('')
  })

  it('显式后端标记的代码直接调用后端执行器', async () => {
    const runInBrowser = vi.fn()
    const runInBackend = vi.fn().mockResolvedValue({
      output: 'backend via directive',
      error: null,
      execution_time_ms: 20,
    })

    const result = await routePythonExecution('# sandbox: backend\nprint("train elsewhere")', {
      runInBrowser,
      runInBackend,
    })

    expect(runInBrowser).not.toHaveBeenCalled()
    expect(runInBackend).toHaveBeenCalledWith({
      code: '# sandbox: backend\nprint("train elsewhere")',
      timeout: 30,
    })
    expect(result.executionTarget).toBe('backend')
    expect(result.notice).toContain('已自动切换到后端沙箱运行')
    expect(result.stdout).toBe('backend via directive')
  })

  it('后端运行失败时返回面向用户的说明', async () => {
    const runInBrowser = vi.fn()
    const runInBackend = vi.fn().mockResolvedValue({
      output: '',
      error: 'No module named mindspore',
      execution_time_ms: 12,
    })

    const result = await routePythonExecution('import mindspore as ms\nmodel.train(10, train_dataset)', {
      runInBrowser,
      runInBackend,
    })

    expect(result.executionTarget).toBe('backend')
    expect(result.notice).toContain('已自动切换到后端沙箱运行')
    expect(result.stderr).toContain('后端沙箱当前不提供真实的 MindSpore 运行时')
  })
})
