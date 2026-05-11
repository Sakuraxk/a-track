"""
代码沙箱服务 — Docker 容器化安全执行

提供三种执行模式：
1. sandbox-worker（默认）：通过独立沙箱服务执行用户代码
2. Docker 模式（兼容回退）：在一次性容器中执行用户代码
3. 本地模式（最后降级）：Docker 不可用时回退到 subprocess + 黑名单

使用方式：
    from app.services.sandbox_service import sandbox
    result = await sandbox.execute(code, stdin_text="", timeout=10)
"""

import asyncio
import base64
import importlib.util
import logging
import os
import sys
import tempfile
import time
from dataclasses import dataclass, field
from typing import Optional, Tuple

import httpx

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SandboxResult:
    """沙箱执行结果"""
    success: bool
    stdout: str
    stderr: str
    execution_time_ms: int
    # 执行方式：'docker' | 'local' | 'service' | 'boundary'
    backend: str
    images: list[str] = field(default_factory=list)  # base64-encoded PNG images from matplotlib


# ---------------------------------------------------------------------------
# 危险模式黑名单 — 仅用于本地降级模式
# ---------------------------------------------------------------------------
_DANGEROUS_PATTERNS = [
    "import subprocess",
    "import socket", "import requests", "import urllib",
    "__import__", "eval(", "exec(", "open(",
    "import shutil", "import pathlib",
]

# ---------------------------------------------------------------------------
# Matplotlib 图表捕获标记
# ---------------------------------------------------------------------------
_SANDBOX_IMG_BEGIN = "[SANDBOX_IMG_BASE64]"
_SANDBOX_IMG_END = "[/SANDBOX_IMG_BASE64]"
_LOCAL_MPLCONFIGDIR = os.path.join(tempfile.gettempdir(), "matplotlib")
_DOCKER_MPLCONFIGDIR = "/tmp/matplotlib"


def _extract_images_from_output(output: str) -> tuple[str, list[str]]:
    """Extract base64 image markers from output, returning cleaned output and images list."""
    images: list[str] = []
    clean_lines: list[str] = []
    i = 0
    lines = output.split('\n')
    while i < len(lines):
        line = lines[i]
        if _SANDBOX_IMG_BEGIN in line:
            img_data = line.split(_SANDBOX_IMG_BEGIN, 1)[1]
            if _SANDBOX_IMG_END in img_data:
                img_data = img_data.split(_SANDBOX_IMG_END, 1)[0]
                images.append(img_data)
            else:
                parts = [img_data]
                i += 1
                while i < len(lines) and _SANDBOX_IMG_END not in lines[i]:
                    parts.append(lines[i])
                    i += 1
                if i < len(lines):
                    parts.append(lines[i].split(_SANDBOX_IMG_END, 1)[0])
                images.append(''.join(parts))
        else:
            clean_lines.append(line)
        i += 1
    return '\n'.join(clean_lines), images


def _code_uses_matplotlib(code: str) -> bool:
    """Check if code imports or uses matplotlib."""
    code_lower = code.lower()
    return "matplotlib" in code_lower or "pyplot" in code_lower


def _build_matplotlib_hook() -> str:
    """Build Python snippet that hooks matplotlib to capture figures as base64 PNG."""
    return (
        '# -- sandbox: matplotlib hook begin --\n'
        'import os as _os\n'
        'import tempfile as _tempfile\n'
        '_os.environ.setdefault("MPLCONFIGDIR", _os.path.join(_tempfile.gettempdir(), "matplotlib"))\n'
        '_os.makedirs(_os.environ["MPLCONFIGDIR"], exist_ok=True)\n'
        'import warnings as _warnings\n'
        '_warnings.filterwarnings("ignore", message=r"Glyph .* missing from current font\\\\.")\n'
        'import matplotlib as _mpl\n'
        '_mpl.use("Agg")\n'
        'import matplotlib.pyplot as _plt\n'
        'from matplotlib import font_manager as _fm\n'
        'import io as _io, base64 as _b64\n'
        '_font_candidates = ["Noto Sans CJK SC", "Noto Sans CJK JP", "WenQuanYi Zen Hei", "Microsoft YaHei", "SimHei", "Arial Unicode MS", "DejaVu Sans"]\n'
        '_available = {f.name for f in _fm.fontManager.ttflist}\n'
        '_selected = [name for name in _font_candidates if name in _available]\n'
        'if _selected:\n'
        '    _mpl.rcParams["font.sans-serif"] = _selected + list(_mpl.rcParams.get("font.sans-serif", []))\n'
        '_mpl.rcParams["axes.unicode_minus"] = False\n'
        'def _sandbox_show(*args, **kwargs):\n'
        '    for _fig_num in _plt.get_fignums():\n'
        '        _fig = _plt.figure(_fig_num)\n'
        '        _buf = _io.BytesIO()\n'
        '        _fig.savefig(_buf, format="png", dpi=100, bbox_inches="tight", facecolor="white")\n'
        '        _buf.seek(0)\n'
        '        _img_b64 = _b64.b64encode(_buf.read()).decode("ascii")\n'
        '        print(f"[SANDBOX_IMG_BASE64]{_img_b64}[/SANDBOX_IMG_BASE64]")\n'
        '        _buf.close()\n'
        '    _plt.close("all")\n'
        '_plt.show = _sandbox_show\n'
        '# -- sandbox: matplotlib hook end --\n'
    )


def _build_matplotlib_auto_capture() -> str:
    """Build Python snippet that auto-captures any unclosed matplotlib figures at script end."""
    return (
        '\n# -- sandbox: auto-capture unclosed figures --\n'
        'try:\n'
        '    import matplotlib.pyplot as _plt_auto\n'
        '    if _plt_auto.get_fignums():\n'
        '        _plt_auto.show()\n'
        'except ImportError:\n'
        '    pass\n'
        '# -- sandbox: auto-capture end --\n'
    )


def _build_mock_input_wrapper() -> str:
    """Build Python code snippet that replaces builtins.input() with a smart mock.

    Priority order:
      P1: Instructional hints  - 尝试输入'十' / try typing 'test'
      P2: Example value patterns - (e.g., 25) / (如: 1.75)
      P3: Keyword-based defaults - age→25, height→1.75, name→Alice
      P4: Generic fallback values
    """
    return (
        '# -- sandbox: mock input() begin --\n'
        'import builtins as __builtins_mod\n'
        'import re as __re\n'
        '__mock_idx = 0\n'
        '__mock_fallback = ["hello", "42", "test", "3.14", "world"]\n'
        'def __mock_input(prompt=""):\n'
        '    global __mock_idx\n'
        '    value = None\n'
        '    ps = str(prompt)\n'
        '    # P1: instructional hints\n'
        "    try_m = __re.search(r'(?:\u5c1d\u8bd5|\u8bd5\u8bd5|\u8bf7)?\u8f93\u5165\\s*[\\'\\u2018\\u201c\"\\u300c](.+?)[\\'\\u2019\\u201d\"\\u300d]|try\\s+(?:entering|typing|inputting|input)\\s*[\\'\"](.*?)[\\'\"]', ps)\n"
        '    if try_m:\n'
        '        value = (try_m.group(1) or try_m.group(2) or "").strip()\n'
        '    # P2: example patterns\n'
        '    if not value:\n'
        "        eg = __re.search(r'(?:e\\.?g\\.?[,:]?|\u5982[\uff1a:]|\u4f8b\u5982[\uff1a:]?)\\s*([^\\)\\]]+)', ps)\n"
        '        if eg:\n'
        '            value = eg.group(1).strip().rstrip(".,;:\u3001\uff0c\u3002")\n'
        '    # P3: keyword-based defaults\n'
        '    if not value:\n'
        '        pl = ps.lower()\n'
        '        if any(k in pl for k in ["age","\u5e74\u9f84","\u5c81"]): value = "25"\n'
        '        elif any(k in pl for k in ["height","\u8eab\u9ad8","\u9ad8\u5ea6","meter"]): value = "1.75"\n'
        '        elif any(k in pl for k in ["weight","\u4f53\u91cd"]): value = "65"\n'
        '        elif any(k in pl for k in ["score","\u5206\u6570","\u6210\u7ee9"]): value = "85"\n'
        '        elif any(k in pl for k in ["price","\u4ef7\u683c"]): value = "9.99"\n'
        '        elif any(k in pl for k in ["number","\u6570\u5b57","num","integer","\u6574\u6570"]): value = "42"\n'
        '        elif any(k in pl for k in ["name","\u540d\u5b57","\u59d3\u540d"]): value = "Alice"\n'
        '        elif any(k in pl for k in ["yes","no","y/n","\u662f\u5426"]): value = "yes"\n'
        '        elif any(k in pl for k in ["password","\u5bc6\u7801"]): value = "abc123"\n'
        '        elif any(k in pl for k in ["email","\u90ae\u7bb1"]): value = "user@example.com"\n'
        '    # P4: generic fallback\n'
        '    if not value:\n'
        '        value = __mock_fallback[__mock_idx % len(__mock_fallback)]\n'
        '    __mock_idx += 1\n'
        '    if prompt:\n'
        '        print(prompt, end="")\n'
        '    print(value)\n'
        '    print(f"  \u26a0 [\u6c99\u7bb1] input() \u4e0d\u652f\u6301\u771f\u5b9e\u952e\u76d8\u8f93\u5165\uff0c\u5df2\u81ea\u52a8\u586b\u5165\u6a21\u62df\u503c: {repr(value)}")\n'
        '    return value\n'
        '__builtins_mod.input = __mock_input\n'
        '# -- sandbox: mock input() end --\n'
    )


class SandboxService:
    """代码沙箱服务"""

    def __init__(self) -> None:
        self._sandbox_service_url: Optional[str] = os.getenv("SANDBOX_SERVICE_URL")
        self._docker_image: str = os.getenv("SANDBOX_DOCKER_IMAGE", "python-sandbox")
        self._docker_available: Optional[bool] = None
        self._sandbox_enabled: bool = os.getenv("SANDBOX_ENABLED", "true").lower() in ("true", "1", "yes")
        self._docker_memory_limit: str = os.getenv("SANDBOX_DOCKER_MEMORY", "2g")
        self._docker_cpu_limit: str = os.getenv("SANDBOX_DOCKER_CPUS", "2")
        self._docker_pids_limit: str = os.getenv("SANDBOX_DOCKER_PIDS", "256")
        self._docker_tmpfs_size: str = os.getenv("SANDBOX_DOCKER_TMPFS", "256m")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def execute(
        self,
        code: str,
        *,
        stdin_text: str = "",
        timeout: int = 10,
    ) -> SandboxResult:
        """
        执行用户代码，自动选择最安全的可用后端。

        优先使用 Docker 容器；Docker 不可用时降级到本地 subprocess。
        """
        if self._sandbox_service_url:
            try:
                result = await self._run_in_service(code, stdin_text=stdin_text, timeout=timeout)
                return self._normalize_runtime_result(code, result)
            except Exception as exc:
                logger.warning("Sandbox worker unavailable, falling back: %s", exc)

        if self._sandbox_enabled and await self._is_docker_available():
            result = await self._run_in_docker(code, stdin_text=stdin_text, timeout=timeout)
            return self._normalize_runtime_result(code, result)

        runtime_boundary_error = self._get_local_runtime_boundary_error(code)
        if runtime_boundary_error:
            return SandboxResult(
                success=False,
                stdout="",
                stderr=runtime_boundary_error,
                execution_time_ms=0,
                backend="boundary",
                images=[],
            )

        result = await self._run_locally(code, stdin_text=stdin_text, timeout=timeout)
        return self._normalize_runtime_result(code, result)

    def _effective_timeout(self, code: str, timeout: int) -> int:
        """Apply minimum timeout floors for heavy libraries like MindSpore."""
        code_lower = code.lower()
        if "import mindspore" in code_lower or "from mindspore" in code_lower:
            return max(timeout, 60)
        return timeout

    async def _run_in_service(
        self,
        code: str,
        *,
        stdin_text: str = "",
        timeout: int = 10,
    ) -> SandboxResult:
        if not self._sandbox_service_url:
            raise RuntimeError("sandbox worker url not configured")

        # Apply minimum timeout floor for heavy libraries
        effective_timeout = self._effective_timeout(code, timeout)
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=effective_timeout + 10) as client:
            response = await client.post(
                self._sandbox_service_url,
                json={
                    "code": code,
                    "stdin_text": stdin_text,
                    "timeout": effective_timeout,
                },
            )
            response.raise_for_status()
            payload = response.json()

        elapsed = payload.get("execution_time_ms")
        if not isinstance(elapsed, int):
            elapsed = int((time.monotonic() - start) * 1000)

        return SandboxResult(
            success=bool(payload.get("success")),
            stdout=str(payload.get("output") or ""),
            stderr=str(payload.get("error") or ""),
            execution_time_ms=elapsed,
            backend="service",
            images=list(payload.get("images") or []),
        )

    # ------------------------------------------------------------------
    # Docker 执行
    # ------------------------------------------------------------------

    async def _run_in_docker(
        self,
        code: str,
        *,
        stdin_text: str = "",
        timeout: int = 10,
    ) -> SandboxResult:
        """在 Docker 容器中执行代码"""
        import subprocess

        start = time.monotonic()
        code_b64 = base64.b64encode(code.encode("utf-8")).decode("ascii")
        try:
            # 构建 docker run 命令
            # 安全限制：
            #   --rm            容器退出即删除
            #   --network=none  禁止所有网络访问
            #   --read-only     只读 rootfs
            #   --tmpfs /tmp    可写 /tmp（代码执行需要）
            #   --memory 64m    内存上限 64MB
            #   --cpus 0.5      CPU 上限 0.5 核
            #   --pids-limit 32 进程数上限
            #   --user sandbox  受限用户
            cmd = [
                "docker", "run",
                "--rm",
                "-i",
                "--network=none",
                "--read-only",
                "--tmpfs", f"/tmp:rw,noexec,nosuid,size={self._docker_tmpfs_size}",
                f"--memory={self._docker_memory_limit}",
                f"--cpus={self._docker_cpu_limit}",
                f"--pids-limit={self._docker_pids_limit}",
                "--user", "sandbox",
                "-e", f"MPLCONFIGDIR={_DOCKER_MPLCONFIGDIR}",
                "-e", f"USER_CODE_B64={code_b64}",
                self._docker_image,
                "-c",
                (
                    "import base64\n"
                    "code = base64.b64decode(__import__('os').environ['USER_CODE_B64']).decode('utf-8')\n"
                    "globals_dict = {'__name__': '__main__', '__builtins__': __builtins__}\n"
                    "exec(compile(code, '<sandbox>', 'exec'), globals_dict, globals_dict)\n"
                ),
            ]

            def _run_docker() -> tuple[int, str, str]:
                """在线程中运行 docker run，避免事件循环兼容性问题"""
                try:
                    result = subprocess.run(
                        cmd,
                        capture_output=True,
                        text=True,
                        timeout=timeout + 5,  # 额外 5 秒等 Docker 启动
                        input=stdin_text if stdin_text else None,
                    )
                    stdout = (result.stdout or "")
                    stderr = (result.stderr or "")[:2000]
                    if result.returncode != 0 and not stderr.strip():
                        stderr = f"Docker sandbox exited with code {result.returncode}"
                    return result.returncode, stdout, stderr
                except subprocess.TimeoutExpired:
                    return -1, "", f"执行超时（限制 {timeout} 秒）"

            loop = asyncio.get_event_loop()
            returncode, stdout, stderr = await loop.run_in_executor(
                None, _run_docker,
            )

            elapsed = int((time.monotonic() - start) * 1000)

            # Extract images from full stdout BEFORE truncating text
            clean_stdout, images = _extract_images_from_output(stdout)
            clean_stdout = clean_stdout[:5000]

            return SandboxResult(
                success=returncode == 0,
                stdout=clean_stdout,
                stderr=stderr,
                execution_time_ms=elapsed,
                backend="docker",
                images=images,
            )

        except Exception as e:
            elapsed = int((time.monotonic() - start) * 1000)
            logger.exception("Docker sandbox execution failed")
            logger.warning("Docker execution failed, falling back to local: %s", e)
            return await self._run_locally(code, stdin_text=stdin_text, timeout=timeout)

    # ------------------------------------------------------------------
    # 本地降级执行
    # ------------------------------------------------------------------

    async def _run_locally(
        self,
        code: str,
        *,
        stdin_text: str = "",
        timeout: int = 10,
    ) -> SandboxResult:
        """本地 subprocess 执行（降级模式），保留字符串黑名单检查"""
        import subprocess

        # 黑名单检查
        code_lower = code.lower()
        for pattern in _DANGEROUS_PATTERNS:
            if pattern.lower() in code_lower:
                return SandboxResult(
                    success=False,
                    stdout="",
                    stderr=f"安全限制：不允许使用 {pattern}",
                    execution_time_ms=0,
                    backend="local",
                )

        start = time.monotonic()

        # 当代码含 input() 且没有提供 stdin_text 时，注入 mock input 防止 I/O 错误
        effective_code = code
        if not stdin_text and ("input(" in code or "input (" in code):
            effective_code = _build_mock_input_wrapper() + code
        if _code_uses_matplotlib(effective_code):
            effective_code = _build_matplotlib_hook() + effective_code
            effective_code = effective_code + _build_matplotlib_auto_capture()

        tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", delete=False, encoding="utf-8",
        )
        try:
            tmp.write(effective_code)
            tmp.flush()
            tmp.close()

            def _run_subprocess() -> tuple[int, str, str]:
                """在线程中运行 subprocess.run，避免事件循环兼容性问题"""
                try:
                    env = os.environ.copy()
                    env.setdefault("MPLCONFIGDIR", _LOCAL_MPLCONFIGDIR)
                    os.makedirs(env["MPLCONFIGDIR"], exist_ok=True)
                    result = subprocess.run(
                        [sys.executable, tmp.name],
                        capture_output=True,
                        text=True,
                        timeout=timeout,
                        cwd=tempfile.gettempdir(),
                        input=stdin_text if stdin_text else None,
                        env=env,
                    )
                    stdout = (result.stdout or "")
                    stderr = (result.stderr or "")[:2000]
                    return result.returncode, stdout, stderr
                except subprocess.TimeoutExpired:
                    return -1, "", f"执行超时（限制 {timeout} 秒）"

            loop = asyncio.get_event_loop()
            returncode, stdout, stderr = await loop.run_in_executor(
                None, _run_subprocess,
            )

            elapsed = int((time.monotonic() - start) * 1000)

            # Extract images from full stdout BEFORE truncating text
            clean_stdout, images = _extract_images_from_output(stdout)
            clean_stdout = clean_stdout[:5000]

            return SandboxResult(
                success=returncode == 0,
                stdout=clean_stdout,
                stderr=stderr,
                execution_time_ms=elapsed,
                backend="local",
                images=images,
            )

        except Exception as e:
            elapsed = int((time.monotonic() - start) * 1000)
            return SandboxResult(
                success=False,
                stdout="",
                stderr=f"执行错误: {str(e)}",
                execution_time_ms=elapsed,
                backend="local",
                images=[],
            )
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass


    # ------------------------------------------------------------------
    # Docker 可用性检测
    # ------------------------------------------------------------------

    async def _is_docker_available(self) -> bool:
        """检测 Docker 是否可用并缓存结果"""
        import subprocess

        if self._docker_available is not None:
            return self._docker_available

        try:
            def _check() -> int:
                result = subprocess.run(
                    ["docker", "image", "inspect", self._docker_image],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=10,
                )
                return result.returncode

            loop = asyncio.get_event_loop()
            returncode = await loop.run_in_executor(None, _check)
            available = returncode == 0

            if not available:
                logger.warning(
                    "Docker sandbox image '%s' not found. "
                    "Run 'cd backend/sandbox && docker build -t %s .' to build it. "
                    "Falling back to local execution.",
                    self._docker_image, self._docker_image,
                )
            else:
                logger.info("Docker sandbox enabled with image '%s'", self._docker_image)

            self._docker_available = available
            return available

        except Exception as e:
            logger.warning("Docker not available: %s. Falling back to local execution.", e)
            self._docker_available = False
            return False

    def _get_local_runtime_boundary_error(self, code: str) -> Optional[str]:
        if self._requires_module(code, "mindspore") and importlib.util.find_spec("mindspore") is None:
            return self._build_missing_runtime_message("MindSpore")

        if self._requires_module(code, "torch") and importlib.util.find_spec("torch") is None:
            return self._build_missing_runtime_message("PyTorch")

        return None

    def _normalize_runtime_result(self, code: str, result: SandboxResult) -> SandboxResult:
        if result.success:
            return result

        normalized_error = self._normalize_runtime_error(code, result.stderr)
        if normalized_error == result.stderr:
            return result

        return SandboxResult(
            success=result.success,
            stdout=result.stdout,
            stderr=normalized_error,
            execution_time_ms=result.execution_time_ms,
            backend=result.backend,
        )

    def _normalize_runtime_error(self, code: str, stderr: str) -> str:
        stderr_lower = stderr.lower()

        if "exit code 137" in stderr_lower or "oom" in stderr_lower:
            return (
                "后端沙箱执行过程中触发了资源上限。\n"
                "当前示例已经进入真实 Docker 沙箱，但运行时内存或进程限制不足以完成执行。\n"
                "请继续优化沙箱资源配置，或缩小示例规模。"
            )

        if self._requires_module(code, "mindspore") and "no module named" in stderr_lower and "mindspore" in stderr_lower:
            return self._build_missing_runtime_message("MindSpore")

        if self._requires_module(code, "torch") and "no module named" in stderr_lower and "torch" in stderr_lower:
            return self._build_missing_runtime_message("PyTorch")

        return stderr

    def _requires_module(self, code: str, module_name: str) -> bool:
        code_lower = code.lower()
        return f"import {module_name}" in code_lower or f"from {module_name}" in code_lower

    def _build_missing_runtime_message(self, runtime_name: str) -> str:
        if runtime_name == "MindSpore":
            return (
                "后端沙箱当前不提供真实的 MindSpore 运行时。\n"
                "该沙箱仅支持标准 Python 与已安装的科学计算库，不会伪装成完整 MindSpore 环境。\n"
                "请优先使用已构建好的 Docker 沙箱镜像运行 MindSpore 代码，或改写为前端可运行的轻量 Tensor / ops 示例。"
            )

        if runtime_name == "PyTorch":
            return (
                "后端沙箱当前不提供真实的 PyTorch 运行时。\n"
                "该沙箱仅支持标准 Python 与已安装的科学计算库，不会伪装成完整 PyTorch 环境。\n"
                "请优先使用已构建好的 Docker 沙箱镜像运行 PyTorch 代码，或在本地真实 PyTorch 环境中运行。"
            )

        return "后端沙箱当前不提供请求的深度学习运行时。"


# ---------------------------------------------------------------------------
# 模块级单例
# ---------------------------------------------------------------------------
sandbox = SandboxService()
