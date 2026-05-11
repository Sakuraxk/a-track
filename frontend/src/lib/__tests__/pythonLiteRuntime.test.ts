import { describe, expect, it, vi } from 'vitest'

import {
  analyzePythonRuntimeRequirements,
  prepareMindsporeLiteEnvironment,
  MINDSPORE_LITE_SCRIPT,
  SANDBOX_DATASETS_SCRIPT,
  type PythonRuntimeAdapter,
} from '@/lib/pythonLiteRuntime'

class MockPyodide implements PythonRuntimeAdapter {
  loadPackage = vi.fn(async (_name: string | string[]) => undefined)
  loadPackagesFromImports = vi.fn(async (_code: string) => undefined)
  pyimport = vi.fn((_name: string) => ({
    add_mock_package: vi.fn(),
  }))
  runPython = vi.fn((_code: string) => undefined)
}

describe('pythonLiteRuntime', () => {
  it('识别 mindspore 代码需要预加载 numpy', () => {
    const requirements = analyzePythonRuntimeRequirements(`
import mindspore as ms
import mindspore.ops as ops

x = ms.Tensor([[1., 2.], [3., 4.]])
print(ops.matmul(x, x))
`)

    expect(requirements.needsMindspore).toBe(true)
    expect(requirements.preloadPackages).toContain('numpy')
  })

  it('为 mindspore lite 运行时自动准备 numpy 与 mock 包', async () => {
    const py = new MockPyodide()

    await prepareMindsporeLiteEnvironment(py)

    expect(py.loadPackage).toHaveBeenCalledWith('numpy')
    expect(py.loadPackage).toHaveBeenCalledWith('micropip')
    expect(py.pyimport).toHaveBeenCalledWith('micropip')
    expect(py.runPython).toHaveBeenCalledTimes(2)
    expect(py.runPython.mock.calls[1]?.[0]).toContain('class Tensor')
    expect(py.runPython.mock.calls[1]?.[0]).toContain('def matmul')
    expect(py.runPython.mock.calls[1]?.[0]).toContain('Model.train')
  })

  it('内置 GradOperation 轻量实现，支持一元函数求导教学示例', () => {
    expect(MINDSPORE_LITE_SCRIPT).toContain('class GradOperation')
    expect(MINDSPORE_LITE_SCRIPT).toContain('(_np.sum(_plus_output) - _np.sum(_minus_output)) / (2 * self.epsilon)')
    expect(MINDSPORE_LITE_SCRIPT).toContain('_ops_mod.GradOperation = GradOperation')
  })

  it('支持 nn.Cell / Parameter / trainable_params / get_by_list 这类轻量网络示例', () => {
    expect(MINDSPORE_LITE_SCRIPT).toContain('class Cell')
    expect(MINDSPORE_LITE_SCRIPT).toContain('def trainable_params(self):')
    expect(MINDSPORE_LITE_SCRIPT).toContain('if self.get_by_list and params is not None')
    expect(MINDSPORE_LITE_SCRIPT).toContain('_nn_mod = _ensure_submodule(_ms, "mindspore.nn")')
    expect(MINDSPORE_LITE_SCRIPT).toContain('_nn_mod.Cell = Cell')
  })

  it('支持比较运算与布尔掩码索引', () => {
    expect(MINDSPORE_LITE_SCRIPT).toContain('def _normalize_index(index):')
    expect(MINDSPORE_LITE_SCRIPT).toContain('def __gt__(self, other):')
    expect(MINDSPORE_LITE_SCRIPT).toContain('return self._binary(other, lambda a, b: a > b)')
    expect(MINDSPORE_LITE_SCRIPT).toContain('return Tensor(self._data[_normalize_index(index)])')
  })

  it('内置 make_classification 兼容 sklearn 常见参数', () => {
    expect(SANDBOX_DATASETS_SCRIPT).toContain('n_redundant=0')
    expect(SANDBOX_DATASETS_SCRIPT).toContain('n_clusters_per_class=2')
    expect(SANDBOX_DATASETS_SCRIPT).toContain('flip_y=0.0')
    expect(SANDBOX_DATASETS_SCRIPT).toContain('weights=None')
    expect(SANDBOX_DATASETS_SCRIPT).toContain('**kwargs')
  })
})
