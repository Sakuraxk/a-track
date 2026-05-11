import { describe, expect, it } from 'vitest'

import { analyzePythonExecution } from '@/lib/pythonExecutionPolicy'

describe('analyzePythonExecution', () => {
  it('允许轻量级 Tensor 与 ops 教学示例', () => {
    const result = analyzePythonExecution(`
import mindspore as ms
import numpy as np

x = ms.Tensor(np.arange(12).reshape(3, 4))
print(x.shape)
print(ms.ops.arange(0, 10, 2))
`)

    expect(result.allowed).toBe(true)
    expect(result.target).toBe('frontend')
    expect(result.runnable).toBe(true)
    expect(result.message).toBeNull()
    expect(result.requiredMocks.mindspore).toBe(true)
  })

  it('将训练代码分流到后端并给出前端限制说明', () => {
    const result = analyzePythonExecution(`
import mindspore as ms

model = ms.Model(network)
model.train(10, train_dataset)
`)

    expect(result.allowed).toBe(false)
    expect(result.target).toBe('backend')
    expect(result.runnable).toBe(true)
    expect(result.message).toContain('当前前端沙箱未执行这段 Python 代码。')
    expect(result.message).toContain('训练与优化步骤')
    expect(result.message).toContain('后端沙箱或本地 Python 环境')
  })

  it('将数据集流水线代码分流到后端', () => {
    const result = analyzePythonExecution(`
import mindspore.dataset as ds

dataset = ds.GeneratorDataset(source=data, column_names=["x"])
dataset = dataset.batch(32)
`)

    expect(result.allowed).toBe(false)
    expect(result.target).toBe('backend')
    expect(result.runnable).toBe(true)
    expect(result.message).toContain('MindSpore 数据集流水线')
  })

  it('显式后端标记的代码直接归类为后端执行', () => {
    const result = analyzePythonExecution(`
# sandbox: backend
import mindspore as ms

class LargeModel(ms.nn.Cell):
    ...
`)

    expect(result.allowed).toBe(false)
    expect(result.target).toBe('backend')
    expect(result.runnable).toBe(true)
    expect(result.message).toContain('后端沙箱')
  })

  it('覆盖 MindSpore 轻量运行时能力合同片段', () => {
    const snippets = [
      `
import mindspore as ms
x = ms.Tensor([[1, 2], [3, 4]])
print(x.shape, x.dtype, x.ndim, x.size)
print(x[0], x[:, 1], x[x > 2])
`,
      `
import mindspore as ms
import mindspore.ops as ops
x = ms.Tensor([[1., 2.], [3., 4.]])
print(ops.matmul(x, x))
print(ops.reduce_sum(x), ops.reduce_mean(x))
print(ops.reshape(x, (4, 1)))
`,
      `
import mindspore as ms
import mindspore.ops as ops

def square_sum(x):
    return ops.reduce_sum(x * x)

grad = ops.GradOperation()(square_sum)
print(grad(ms.Tensor([1., 2., 3.])))
`,
      `
import mindspore as ms

class Linear(ms.nn.Cell):
    def __init__(self):
        super().__init__()
        self.weight = ms.Parameter(ms.Tensor([[2.0]]), name="weight")

    def construct(self, x):
        return x @ self.weight

net = Linear()
print(net.trainable_params())
`,
    ]

    for (const snippet of snippets) {
      const result = analyzePythonExecution(snippet)
      expect(result.target).toBe('frontend')
      expect(result.allowed).toBe(true)
      expect(result.runnable).toBe(true)
    }
  })

  // ────────────────────────────────────────────────────
  // 新增测试：注释和字符串中的代码不应误触发后端规则
  // ────────────────────────────────────────────────────

  it('注释中的训练代码不应触发后端分流', () => {
    const result = analyzePythonExecution(`
import numpy as np

# model.train(10, dataset)  # 这只是注释示例
x = np.array([1, 2, 3])
print(x.sum())
`)

    expect(result.allowed).toBe(true)
    expect(result.target).toBe('frontend')
  })

  it('字符串中的复杂网络层不应触发后端分流', () => {
    const result = analyzePythonExecution(`
import numpy as np

desc = "可以使用 nn.Dense 和 nn.Conv2d 搭建网络"
print(desc)
print(np.zeros(5))
`)

    expect(result.allowed).toBe(true)
    expect(result.target).toBe('frontend')
  })

  it('注释中的 GeneratorDataset 不应触发后端分流', () => {
    const result = analyzePythonExecution(`
import mindspore as ms

# 后续步骤：使用 GeneratorDataset 加载数据
x = ms.Tensor([1.0, 2.0, 3.0])
print(x.shape)
`)

    expect(result.allowed).toBe(true)
    expect(result.target).toBe('frontend')
  })

  // ────────────────────────────────────────────────────
  // 新增测试：range() 阈值调整（50→1000）
  // ────────────────────────────────────────────────────

  it('range(999) 允许前端执行', () => {
    const result = analyzePythonExecution(`
for i in range(999):
    x = i * 2
print("done")
`)

    expect(result.allowed).toBe(true)
    expect(result.target).toBe('frontend')
  })

  it('range(100) 允许前端执行', () => {
    const result = analyzePythonExecution(`
for i in range(100):
    print(i)
`)

    expect(result.allowed).toBe(true)
    expect(result.target).toBe('frontend')
  })

  it('range(1000) 转后端执行', () => {
    const result = analyzePythonExecution(`
for i in range(1000):
    x = i ** 2
`)

    expect(result.allowed).toBe(false)
    expect(result.target).toBe('backend')
    expect(result.message).toContain('高开销迭代')
  })

  it('range(10000) 转后端执行', () => {
    const result = analyzePythonExecution(`
for epoch in range(10000):
    loss = epoch * 0.01
`)

    expect(result.allowed).toBe(false)
    expect(result.target).toBe('backend')
  })

  // ────────────────────────────────────────────────────
  // 新增测试：# sandbox: frontend 强制前端 + 警告
  // ────────────────────────────────────────────────────

  it('# sandbox: frontend 即使有后端特征也强制前端执行', () => {
    const result = analyzePythonExecution(`
# sandbox: frontend
import pandas as pd

df = pd.DataFrame({"a": [1, 2, 3]})
print(df)
`)

    expect(result.allowed).toBe(true)
    expect(result.target).toBe('frontend')
    expect(result.summary).toContain('⚠️')
    expect(result.summary).toContain('强制前端执行')
  })

  it('# sandbox: frontend 无后端特征时无警告', () => {
    const result = analyzePythonExecution(`
# sandbox: frontend
import numpy as np
print(np.arange(10))
`)

    expect(result.allowed).toBe(true)
    expect(result.target).toBe('frontend')
    expect(result.summary).not.toContain('⚠️')
  })

  // ────────────────────────────────────────────────────
  // 新增测试：系统级模块自动路由到后端
  // ────────────────────────────────────────────────────

  it('import os 路由到后端', () => {
    const result = analyzePythonExecution(`
import os
print(os.getcwd())
`)

    expect(result.allowed).toBe(false)
    expect(result.target).toBe('backend')
  })

  it('import subprocess 路由到后端', () => {
    const result = analyzePythonExecution(`
import subprocess
subprocess.run(["echo", "hi"])
`)

    expect(result.allowed).toBe(false)
    expect(result.target).toBe('backend')
  })
})

