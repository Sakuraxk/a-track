"""
独立沙箱测试 — 不依赖 conftest / 整个 app
直接验证 SandboxService 的核心逻辑
"""
import asyncio
import os
import sys

# 确保 backend 目录在 sys.path 中
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ["SANDBOX_ENABLED"] = "false"  # 强制本地模式

from app.services.sandbox_service import SandboxService


async def run_tests():
    svc = SandboxService()
    svc._sandbox_enabled = False  # 强制本地模式
    passed = 0
    failed = 0

    async def check(name, coro, expect_success, expect_in_output=None, expect_in_stderr=None):
        nonlocal passed, failed
        try:
            result = await coro
            ok = True
            reasons = []

            if result.success != expect_success:
                ok = False
                reasons.append(f"expected success={expect_success}, got {result.success}")

            if expect_in_output and expect_in_output not in result.stdout:
                ok = False
                reasons.append(f"expected '{expect_in_output}' in stdout, got: {result.stdout[:100]}")

            if expect_in_stderr and expect_in_stderr not in result.stderr:
                ok = False
                reasons.append(f"expected '{expect_in_stderr}' in stderr, got: {result.stderr[:100]}")

            if ok:
                print(f"  PASS {name} ({result.execution_time_ms}ms, backend={result.backend})")
                passed += 1
            else:
                print(f"  FAIL {name}: {'; '.join(reasons)}")
                failed += 1
        except Exception as e:
            print(f"  FAIL {name}: EXCEPTION {e}")
            failed += 1

    print("\n=== 本地模式测试 ===\n")

    await check(
        "正常 print",
        svc.execute('print("hello sandbox")', timeout=10),
        expect_success=True,
        expect_in_output="hello sandbox",
    )

    await check(
        "stdin 输入",
        svc.execute('name = input()\nprint(f"Hello, {name}!")', stdin_text="World", timeout=10),
        expect_success=True,
        expect_in_output="Hello, World!",
    )

    await check(
        "数学计算",
        svc.execute("print(sum(range(100)))", timeout=5),
        expect_success=True,
        expect_in_output="4950",
    )

    await check(
        "语法错误",
        svc.execute("def foo(:\n  pass", timeout=5),
        expect_success=False,
    )

    await check(
        "超时保护",
        svc.execute("while True: pass", timeout=2),
        expect_success=False,
        expect_in_stderr="超时",
    )

    await check(
        "黑名单: import os",
        svc.execute("import os\nos.listdir('/')", timeout=5),
        expect_success=False,
        expect_in_stderr="安全限制",
    )

    await check(
        "黑名单: import subprocess",
        svc.execute('import subprocess\nsubprocess.run(["ls"])', timeout=5),
        expect_success=False,
        expect_in_stderr="安全限制",
    )

    await check(
        "黑名单: eval",
        svc.execute('eval("1+1")', timeout=5),
        expect_success=False,
        expect_in_stderr="安全限制",
    )

    await check(
        "运行时边界: MindSpore",
        svc.execute('import mindspore as ms\nprint(ms.Tensor([1, 2]))', timeout=5),
        expect_success=False,
        expect_in_stderr="后端沙箱当前不提供真实的 MindSpore 运行时",
    )

    await check(
        "输出截断 (>5000字符)",
        svc.execute('print("x" * 10000)', timeout=5),
        expect_success=True,
    )

    await check(
        "执行时间追踪",
        svc.execute('print("fast")', timeout=5),
        expect_success=True,
        expect_in_output="fast",
    )

    # --- Docker 模式测试 ---
    print("\n=== Docker 模式测试 ===\n")
    docker_svc = SandboxService()
    docker_svc._sandbox_enabled = True

    docker_available = await docker_svc._is_docker_available()
    if not docker_available:
        print("  SKIP Docker 沙箱镜像不可用，跳过 Docker 测试")
        print("     运行 'cd backend/sandbox && docker build -t python-sandbox .' 构建镜像")
    else:
        await check(
            "Docker: 正常 print",
            docker_svc.execute('print("docker hello")', timeout=15),
            expect_success=True,
            expect_in_output="docker hello",
        )

        await check(
            "Docker: 网络隔离",
            docker_svc.execute(
                'import socket\ntry:\n    socket.create_connection(("8.8.8.8",53),timeout=2)\n    print("CONNECTED")\nexcept Exception as e:\n    print(f"BLOCKED: {e}")',
                timeout=15,
            ),
            expect_success=True,
            expect_in_output="BLOCKED",
        )

        await check(
            "Docker: 超时保护",
            docker_svc.execute("while True: pass", timeout=3),
            expect_success=False,
        )

        await check(
            "Docker: MindSpore 轻量示例",
            docker_svc.execute(
                'import mindspore as ms\nimport mindspore.ops as ops\nx = ms.Tensor([1.0, 2.0, 3.0])\nprint(ms.__version__)\nprint(ops.reduce_sum(x))',
                timeout=30,
            ),
            expect_success=True,
            expect_in_output="2.8.0",
        )

    # --- 降级逻辑测试 ---
    print("\n=== 降级逻辑测试 ===\n")
    fallback_svc = SandboxService()
    fallback_svc._sandbox_enabled = True
    fallback_svc._docker_available = False  # 模拟 Docker 不可用

    await check(
        "降级: Docker不可用时回退到本地",
        fallback_svc.execute('print("fallback")', timeout=5),
        expect_success=True,
        expect_in_output="fallback",
    )

    # --- 总结 ---
    print(f"\n{'='*40}")
    print(f"结果: {passed} 通过, {failed} 失败")
    print(f"{'='*40}\n")

    return failed == 0


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    success = asyncio.run(run_tests())
    sys.exit(0 if success else 1)
