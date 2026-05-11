import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import CodeSandbox from '@/components/subject-tools/CodeSandbox'

const { runPythonMock } = vi.hoisted(() => ({
  runPythonMock: vi.fn(),
}))

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea
      aria-label="代码编辑器"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}))

vi.mock('@/hooks/usePyodide', () => ({
  usePyodide: () => ({
    runPython: runPythonMock,
    loading: false,
    ready: true,
    error: null,
  }),
}))

vi.mock('@/lib/codeSandboxRunner', async () => {
  const actual = await vi.importActual<typeof import('@/lib/codeSandboxRunner')>('@/lib/codeSandboxRunner')
  return {
    ...actual,
  }
})

describe('CodeSandbox — Notebook', () => {
  beforeEach(() => {
    runPythonMock.mockReset()
  })

  it('renders notebook with cells', () => {
    render(
      <CodeSandbox
        subjectKey="python_basics"
        initialCode={`print("hello notebook")`}
      />
    )

    expect(screen.getByText('全部运行')).toBeInTheDocument()
    expect(screen.getByText(/新增 Cell/)).toBeInTheDocument()
    expect(screen.getByLabelText('代码编辑器')).toBeInTheDocument()
  })

  it('creates multiple cells from initialCells', () => {
    render(
      <CodeSandbox
        subjectKey="python_basics"
        initialCells={[
          { code: 'import numpy as np', language: 'python' },
          { code: 'x = np.array([1, 2, 3])', language: 'python' },
          { code: 'print(x)', language: 'python' },
        ]}
      />
    )

    const editors = screen.getAllByLabelText('代码编辑器')
    expect(editors).toHaveLength(3)
    expect(screen.getByText('3 个 Cell')).toBeInTheDocument()
  })

  it('runs all cells and shows output', async () => {
    runPythonMock.mockResolvedValue({
      stdout: 'hello from all cells',
      stderr: '',
      images: [],
    })

    render(
      <CodeSandbox
        subjectKey="python_basics"
        initialCode={`print("hello from all cells")`}
      />
    )

    fireEvent.click(screen.getByText('全部运行'))

    await waitFor(() => {
      expect(runPythonMock).toHaveBeenCalled()
    })

    expect(await screen.findByText('hello from all cells')).toBeInTheDocument()
  })

  it('concatenates all cells when running to prevent NameError', async () => {
    runPythonMock.mockResolvedValue({
      stdout: '[1 2 3]',
      stderr: '',
      images: [],
    })

    render(
      <CodeSandbox
        subjectKey="python_basics"
        initialCells={[
          { code: 'import numpy as np', language: 'python' },
          { code: 'x = np.array([1, 2, 3])\nprint(x)', language: 'python' },
        ]}
      />
    )

    fireEvent.click(screen.getByText('全部运行'))

    await waitFor(() => {
      // The runPython call should contain ALL cells concatenated
      const calledCode = runPythonMock.mock.calls[0][0]
      expect(calledCode).toContain('import numpy as np')
      expect(calledCode).toContain('x = np.array([1, 2, 3])')
    })
  })

  it('shows matplotlib images inline', async () => {
    const fakeBase64 = 'iVBORw0KGgoAAAANSUhEU'
    runPythonMock.mockResolvedValue({
      stdout: '',
      stderr: '',
      images: [fakeBase64],
    })

    render(
      <CodeSandbox
        subjectKey="python_basics"
        initialCode={`import matplotlib.pyplot as plt\nplt.plot([1,2,3])\nplt.show()`}
      />
    )

    fireEvent.click(screen.getByText('全部运行'))

    await waitFor(() => {
      const img = screen.getByAltText('图表 1') as HTMLImageElement
      expect(img).toBeInTheDocument()
      expect(img.src).toContain('data:image/png;base64,')
    })
  })

  it('shows error output when execution fails', async () => {
    runPythonMock.mockResolvedValue({
      stdout: '',
      stderr: 'NameError: name "KMeans" is not defined',
      images: [],
    })

    render(
      <CodeSandbox
        subjectKey="python_basics"
        initialCode={`kmeans = KMeans(n_clusters=4)`}
      />
    )

    fireEvent.click(screen.getByText('全部运行'))

    expect(await screen.findByText(/NameError/)).toBeInTheDocument()
  })
})
