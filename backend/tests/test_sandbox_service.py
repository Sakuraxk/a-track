"""
Tests for SandboxService

涵盖：
1. 正常代码执行
2. 超时保护
3. 黑名单拦截（本地降级模式）
4. Docker/本地模式切换
5. stdin 输入传递
"""

import asyncio
import os
import sys
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

# 在导入前设置环境变量，确保测试可控
os.environ.setdefault("SANDBOX_ENABLED", "true")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.sandbox_service import (
    SandboxService,
    SandboxResult,
    _DOCKER_MPLCONFIGDIR,
    _LOCAL_MPLCONFIGDIR,
    _build_matplotlib_hook,
)


@pytest.fixture
def sandbox_docker():
    """创建一个启用 Docker 的沙箱实例"""
    svc = SandboxService()
    svc._sandbox_enabled = True
    return svc


@pytest.fixture
def sandbox_local():
    """创建一个强制本地模式的沙箱实例"""
    svc = SandboxService()
    svc._sandbox_enabled = False
    return svc


# ============================================================
# 本地模式测试（不依赖 Docker）
# ============================================================

class TestLocalExecution:
    """测试本地降级执行模式"""

    @pytest.mark.asyncio
    async def test_simple_print(self, sandbox_local: SandboxService):
        """正常代码应成功执行"""
        result = await sandbox_local.execute('print("hello sandbox")', timeout=10)
        assert result.success is True
        assert "hello sandbox" in result.stdout
        assert result.backend == "local"

    @pytest.mark.asyncio
    async def test_stdin_input(self, sandbox_local: SandboxService):
        """stdin 输入应正确传递"""
        code = 'name = input("Name: ")\nprint(f"Hello, {name}!")'
        result = await sandbox_local.execute(code, stdin_text="World", timeout=10)
        assert result.success is True
        assert "Hello, World!" in result.stdout

    @pytest.mark.asyncio
    async def test_timeout_protection(self, sandbox_local: SandboxService):
        """死循环应触发超时"""
        code = "while True: pass"
        result = await sandbox_local.execute(code, timeout=2)
        assert result.success is False
        assert "超时" in result.stderr

    @pytest.mark.asyncio
    async def test_syntax_error(self, sandbox_local: SandboxService):
        """语法错误应返回失败"""
        code = "def foo(:\n  pass"
        result = await sandbox_local.execute(code, timeout=5)
        assert result.success is False
        assert result.stderr  # 应有 stderr 输出

    @pytest.mark.asyncio
    async def test_blocklist_import_os(self, sandbox_local: SandboxService):
        """import os 应被黑名单拦截"""
        result = await sandbox_local.execute("import os\nos.listdir('/')", timeout=5)
        assert result.success is False
        assert "安全限制" in result.stderr

    @pytest.mark.asyncio
    async def test_blocklist_subprocess(self, sandbox_local: SandboxService):
        """import subprocess 应被黑名单拦截"""
        result = await sandbox_local.execute('import subprocess\nsubprocess.run(["ls"])', timeout=5)
        assert result.success is False
        assert "安全限制" in result.stderr

    @pytest.mark.asyncio
    async def test_blocklist_eval(self, sandbox_local: SandboxService):
        """eval() 应被黑名单拦截"""
        result = await sandbox_local.execute('eval("1+1")', timeout=5)
        assert result.success is False
        assert "安全限制" in result.stderr

    @pytest.mark.asyncio
    async def test_execution_time_tracked(self, sandbox_local: SandboxService):
        """执行时间应被记录"""
        result = await sandbox_local.execute('print("fast")', timeout=5)
        assert result.execution_time_ms >= 0

    @pytest.mark.asyncio
    async def test_output_truncation(self, sandbox_local: SandboxService):
        """超长输出应被截断到 5000 字符"""
        code = 'print("x" * 10000)'
        result = await sandbox_local.execute(code, timeout=5)
        assert result.success is True
        assert len(result.stdout) <= 5000

    @pytest.mark.asyncio
    async def test_math_computation(self, sandbox_local: SandboxService):
        """正常数学计算"""
        code = "print(sum(range(100)))"
        result = await sandbox_local.execute(code, timeout=5)
        assert result.success is True
        assert "4950" in result.stdout

    @pytest.mark.asyncio
    async def test_mindspore_runtime_boundary_message(self, sandbox_local: SandboxService):
        """后端没有真实 MindSpore 运行时时应返回清晰边界说明，而不是原始 ImportError"""
        result = await sandbox_local.execute("import mindspore as ms\nprint(ms.Tensor([1, 2]))", timeout=5)
        assert result.success is False
        assert "后端沙箱当前不提供真实的 MindSpore 运行时" in result.stderr
        assert "仅支持标准 Python 与已安装的科学计算库" in result.stderr
        assert "Docker 沙箱镜像" in result.stderr

    def test_matplotlib_hook_sets_writable_config_dir(self):
        hook = _build_matplotlib_hook()

        assert "tempfile.gettempdir()" in hook
        assert "os.makedirs" in hook
        assert "Glyph .* missing from current font" in hook
        assert "font_manager" in hook
        assert 'Noto Sans CJK SC' in hook
        assert 'axes.unicode_minus' in hook
        assert _DOCKER_MPLCONFIGDIR == "/tmp/matplotlib"
        assert _LOCAL_MPLCONFIGDIR


# ============================================================
# Docker 模式测试
# ============================================================

class TestDockerExecution:
    """测试 Docker 容器执行模式"""

    @pytest.fixture(autouse=True)
    async def _check_docker(self, sandbox_docker: SandboxService):
        """如果 Docker 不可用，跳过这些测试"""
        available = await sandbox_docker._is_docker_available()
        if not available:
            pytest.skip("Docker sandbox image not available")

    @pytest.mark.asyncio
    async def test_simple_print_docker(self, sandbox_docker: SandboxService):
        """Docker 模式下正常执行"""
        result = await sandbox_docker.execute('print("docker hello")', timeout=15)
        assert result.success is True
        assert "docker hello" in result.stdout
        assert result.backend == "docker"

    @pytest.mark.asyncio
    async def test_dangerous_code_contained(self, sandbox_docker: SandboxService):
        """Docker 模式下危险代码被容器隔离"""
        # 在 Docker 中 import os 是允许的（容器隔离了），但不应影响宿主
        code = 'import os\nprint(os.listdir("/tmp"))'
        result = await sandbox_docker.execute(code, timeout=15)
        # 容器内执行，应该成功但看到的是容器内的 /tmp
        assert result.backend == "docker"

    @pytest.mark.asyncio
    async def test_network_isolation(self, sandbox_docker: SandboxService):
        """Docker 模式下网络被禁止"""
        code = '''
import socket
try:
    socket.create_connection(("8.8.8.8", 53), timeout=2)
    print("CONNECTED")
except Exception as e:
    print(f"BLOCKED: {e}")
'''
        result = await sandbox_docker.execute(code, timeout=15)
        assert "BLOCKED" in result.stdout or result.success is False

    @pytest.mark.asyncio
    async def test_timeout_docker(self, sandbox_docker: SandboxService):
        """Docker 模式下超时保护"""
        code = "while True: pass"
        result = await sandbox_docker.execute(code, timeout=3)
        assert result.success is False
        assert result.backend == "docker"


# ============================================================
# 降级逻辑测试
# ============================================================

class TestFallbackLogic:
    """测试 Docker 不可用时的自动降级"""

    @pytest.mark.asyncio
    async def test_fallback_when_docker_unavailable(self):
        """Docker 不可用时应自动降级到本地"""
        svc = SandboxService()
        svc._sandbox_enabled = True
        svc._docker_available = False  # 模拟 Docker 不可用

        result = await svc.execute('print("fallback")', timeout=5)
        assert result.success is True
        assert "fallback" in result.stdout
        assert result.backend == "local"

    @pytest.mark.asyncio
    async def test_docker_detection_cached(self):
        """Docker 可用性检测结果应被缓存"""
        svc = SandboxService()
        svc._docker_available = True

        # 第二次调用应直接返回缓存值
        result = await svc._is_docker_available()
        assert result is True


class TestWorkerServiceRouting:
    """测试独立 sandbox-worker 路由优先级"""

    @pytest.mark.asyncio
    async def test_prefer_sandbox_worker_service_when_configured(self):
        svc = SandboxService()
        svc._sandbox_service_url = "http://sandbox-worker:8011/execute"
        svc._sandbox_enabled = False
        svc._run_in_service = AsyncMock(return_value=SandboxResult(
            success=True,
            stdout="service ok\n",
            stderr="",
            execution_time_ms=123,
            backend="service",
        ))
        svc._run_locally = AsyncMock()

        result = await svc.execute('print("hello service")', timeout=10)

        assert result.success is True
        assert result.stdout == "service ok\n"
        svc._run_in_service.assert_awaited_once()
        svc._run_locally.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_fallback_to_local_when_worker_service_unavailable(self):
        svc = SandboxService()
        svc._sandbox_service_url = "http://sandbox-worker:8011/execute"
        svc._sandbox_enabled = False
        svc._run_in_service = AsyncMock(side_effect=RuntimeError("worker down"))
        svc._run_locally = AsyncMock(return_value=SandboxResult(
            success=True,
            stdout="fallback local\n",
            stderr="",
            execution_time_ms=9,
            backend="local",
        ))

        result = await svc.execute('print("fallback")', timeout=10)

        assert result.success is True
        assert result.backend == "local"
        assert result.stdout == "fallback local\n"
        svc._run_in_service.assert_awaited_once()
        svc._run_locally.assert_awaited_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
