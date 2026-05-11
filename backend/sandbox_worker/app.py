import io
import os
import subprocess
import sys
import tempfile
import threading
import time
import traceback
from contextlib import redirect_stdout, redirect_stderr
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field


OUTPUT_LIMIT = 5000
ERROR_LIMIT = 2000
DEFAULT_TIMEOUT = 10
MEMORY_LIMIT_MB = int(os.getenv("SANDBOX_WORKER_MEMORY_MB", "4096"))
CPU_TIME_LIMIT_SECONDS = int(os.getenv("SANDBOX_WORKER_CPU_SECONDS", "60"))
PROCESS_LIMIT = int(os.getenv("SANDBOX_WORKER_MAX_PROCESSES", "4096"))
FILE_SIZE_LIMIT_BYTES = int(os.getenv("SANDBOX_WORKER_MAX_FILE_BYTES", "1048576"))
_MPLCONFIGDIR = os.path.join(tempfile.gettempdir(), "matplotlib")
os.environ.setdefault("MPLCONFIGDIR", _MPLCONFIGDIR)
os.makedirs(os.environ["MPLCONFIGDIR"], exist_ok=True)

# ---------------------------------------------------------------------------
# MindSpore 代码的最低超时保底（秒）
# 即使客户端请求 timeout=10，MindSpore 代码也至少等待这么久
# ---------------------------------------------------------------------------
MINDSPORE_MIN_TIMEOUT_SECONDS = 60

_DANGEROUS_PATTERNS = [
    "import subprocess",
    "import socket",
    "import requests",
    "import urllib",
    "__import__",
    "eval(",
    "exec(",
]

app = FastAPI(title="Sandbox Worker", version="1.0.0")


# ---------------------------------------------------------------------------
# 预热：在 worker 启动时提前 import 重型库
# ---------------------------------------------------------------------------
import logging
_logger = logging.getLogger("sandbox_worker")

# 标记各模块是否预热成功
_warmed_modules: dict[str, bool] = {}


@app.on_event("startup")
async def _warmup_heavy_imports():
    """Pre-import heavy libraries (MindSpore, sklearn, etc.) at worker startup.

    MindSpore 2.8.0 takes 20-30s for its first import. By doing it here,
    the in-process exec() path can skip that cold start entirely.
    Subprocess-based execution on Linux with fork() also benefits since
    the child inherits the parent's loaded modules.
    """
    import asyncio
    import importlib

    modules_to_warm = ["numpy", "pandas", "sklearn", "mindspore"]

    async def _warm(name: str):
        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(None, importlib.import_module, name)
            _warmed_modules[name] = True
            _logger.info(f"[warmup] {name} loaded successfully")
        except Exception as e:
            _warmed_modules[name] = False
            _logger.warning(f"[warmup] {name} failed: {e}")

    _logger.info("[warmup] Pre-importing heavy libraries...")
    for mod in modules_to_warm:
        await _warm(mod)
    _logger.info("[warmup] Done. Warmed: %s", _warmed_modules)


class ExecutionRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=10000)
    stdin_text: str = ""
    timeout: int = Field(default=DEFAULT_TIMEOUT, ge=1, le=120)


class ExecutionResponse(BaseModel):
    success: bool
    output: str
    error: Optional[str] = None
    execution_time_ms: int
    images: list[str] = []  # base64-encoded PNG images captured from matplotlib


def _build_preexec():
    import resource

    memory_bytes = MEMORY_LIMIT_MB * 1024 * 1024

    def _apply_limits() -> None:
        os.setsid()
        resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
        resource.setrlimit(resource.RLIMIT_CPU, (CPU_TIME_LIMIT_SECONDS, CPU_TIME_LIMIT_SECONDS))
        resource.setrlimit(resource.RLIMIT_NPROC, (PROCESS_LIMIT, PROCESS_LIMIT))
        resource.setrlimit(resource.RLIMIT_FSIZE, (FILE_SIZE_LIMIT_BYTES, FILE_SIZE_LIMIT_BYTES))

    return _apply_limits


def _check_code_safety(code: str) -> Optional[str]:
    code_lower = code.lower()
    for pattern in _DANGEROUS_PATTERNS:
        if pattern.lower() in code_lower:
            return f"安全限制：不允许使用 {pattern}"
    return None


def _code_uses_mindspore(code: str) -> bool:
    """Check if code requires MindSpore."""
    code_lower = code.lower()
    return "import mindspore" in code_lower or "from mindspore" in code_lower


def _get_effective_timeout(code: str, requested_timeout: int) -> int:
    """Apply minimum timeout floors for heavy libraries.

    MindSpore code gets at least MINDSPORE_MIN_TIMEOUT_SECONDS even if
    the client sent a smaller value.
    """
    if _code_uses_mindspore(code):
        return max(requested_timeout, MINDSPORE_MIN_TIMEOUT_SECONDS)
    return requested_timeout


def _build_mock_input_wrapper() -> str:
    """Build a Python code snippet that replaces builtins.input() with a smart mock.

    Priority order for selecting the mock value:
      P1: Instructional hints — 尝试输入'十' / 试试输入'hello' / try typing 'test'
      P2: Example value patterns — (e.g., 25) / (如: 1.75) / (例如: test)
      P3: Keyword-based defaults — age→25, height→1.75, name→Alice …
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

def _build_sandbox_datasets_script() -> str:
    """Build a Python snippet that registers the sandbox_datasets module with built-in ML datasets."""
    return (
        '# -- sandbox: datasets begin --\n'
        'import sys as _sys, types as _types, numpy as _np\n'
        '_ds_mod = _types.ModuleType("sandbox_datasets")\n'
        '_ds_mod.__path__ = []\n'
        '_ds_mod.__package__ = "sandbox_datasets"\n'
        '_sys.modules["sandbox_datasets"] = _ds_mod\n'
        'def _make_bunch(**kw):\n'
        '    class Bunch(dict):\n'
        '        def __init__(self, **k): super().__init__(**k); self.__dict__.update(k)\n'
        '    return Bunch(**kw)\n'
        'def _ds_load_iris(return_X_y=False):\n'
        '    _np.random.seed(42)\n'
        '    means = [[5.0,3.4,1.5,0.2],[5.9,2.8,4.3,1.3],[6.6,3.0,5.6,2.0]]\n'
        '    stds  = [[0.35,0.38,0.17,0.10],[0.52,0.31,0.47,0.20],[0.64,0.32,0.55,0.27]]\n'
        '    Xp, yp = [], []\n'
        '    for i in range(3):\n'
        '        Xp.append(_np.random.normal(loc=means[i], scale=stds[i], size=(50,4)))\n'
        '        yp.append(_np.full(50, i, dtype=_np.int64))\n'
        '    X, y = _np.vstack(Xp).round(1), _np.concatenate(yp)\n'
        '    if return_X_y: return X, y\n'
        '    return _make_bunch(data=X, target=y, feature_names=["sepal length (cm)","sepal width (cm)","petal length (cm)","petal width (cm)"], target_names=_np.array(["setosa","versicolor","virginica"]), DESCR="Iris")\n'
        'def _ds_load_wine(return_X_y=False):\n'
        '    _np.random.seed(42)\n'
        '    counts, Xp, yp = [59,71,48], [], []\n'
        '    means = [[13.7,2.0,2.5,17.0,106,2.8,3.0,0.29,1.9,5.5,1.06,3.2,1100],[12.3,1.9,2.2,20.0,95,2.2,2.0,0.36,1.6,3.1,1.06,2.8,520],[13.2,3.3,2.4,21.0,99,1.7,0.8,0.45,1.2,7.4,0.68,1.7,630]]\n'
        '    stds = [[0.5,0.3,0.2,2.0,12,0.3,0.4,0.06,0.4,1.2,0.1,0.3,250],[0.5,0.4,0.3,3.0,15,0.5,0.5,0.08,0.5,1.0,0.2,0.4,150],[0.7,0.5,0.3,2.5,14,0.4,0.3,0.10,0.4,1.5,0.1,0.3,200]]\n'
        '    for i in range(3):\n'
        '        Xp.append(_np.abs(_np.random.normal(loc=means[i], scale=stds[i], size=(counts[i],13))).round(2))\n'
        '        yp.append(_np.full(counts[i], i, dtype=_np.int64))\n'
        '    X, y = _np.vstack(Xp), _np.concatenate(yp)\n'
        '    if return_X_y: return X, y\n'
        '    return _make_bunch(data=X, target=y, feature_names=["alcohol","malic_acid","ash","alcalinity_of_ash","magnesium","total_phenols","flavanoids","nonflavanoid_phenols","proanthocyanins","color_intensity","hue","od280/od315","proline"], target_names=_np.array(["class_0","class_1","class_2"]), DESCR="Wine")\n'
        'def _ds_load_breast_cancer(return_X_y=False):\n'
        '    _np.random.seed(42)\n'
        '    mb = [12.1,17.5,78.0,460,0.09,0.08,0.05,0.03,0.17,0.06,0.3,1.2,2.1,22,0.007,0.02,0.03,0.01,0.02,0.003,13.4,23.5,87,560,0.12,0.18,0.17,0.07,0.27,0.08]\n'
        '    mm = [17.5,21.6,115,980,0.10,0.15,0.16,0.09,0.19,0.06,0.6,1.2,4.3,72,0.008,0.03,0.05,0.02,0.03,0.004,21.1,29.3,141,1420,0.14,0.35,0.38,0.15,0.36,0.09]\n'
        '    Xb = _np.abs(_np.random.normal(loc=mb, scale=[x*0.2 for x in mb], size=(357,30))).round(4)\n'
        '    Xm = _np.abs(_np.random.normal(loc=mm, scale=[x*0.15 for x in mm], size=(212,30))).round(4)\n'
        '    X = _np.vstack([Xm, Xb])\n'
        '    y = _np.concatenate([_np.zeros(212, dtype=_np.int64), _np.ones(357, dtype=_np.int64)])\n'
        '    if return_X_y: return X, y\n'
        '    return _make_bunch(data=X, target=y, feature_names=[f"feature_{i}" for i in range(30)], target_names=_np.array(["malignant","benign"]), DESCR="Breast Cancer")\n'
        'def _ds_make_classification(n_samples=100, n_features=20, n_informative=2, n_redundant=0, n_repeated=0, n_classes=2, n_clusters_per_class=2, weights=None, flip_y=0.0, class_sep=1.0, random_state=None, shuffle=True, **kwargs):\n'
        '    if random_state is not None: _np.random.seed(random_state)\n'
        '    n_informative = max(1, min(int(n_informative), int(n_features)))\n'
        '    n_redundant = max(0, min(int(n_redundant), int(n_features) - n_informative))\n'
        '    n_repeated = max(0, min(int(n_repeated), int(n_features) - n_informative - n_redundant))\n'
        '    n_noise = max(0, int(n_features) - n_informative - n_redundant - n_repeated)\n'
        '    if weights is None:\n'
        '        weights_arr = _np.full(n_classes, 1.0 / n_classes)\n'
        '    else:\n'
        '        weights_arr = _np.array(weights[:n_classes], dtype=float)\n'
        '        if weights_arr.size < n_classes:\n'
        '            weights_arr = _np.pad(weights_arr, (0, n_classes - weights_arr.size), constant_values=max(0.0, 1.0 - weights_arr.sum()))\n'
        '        weights_arr = weights_arr / weights_arr.sum() if weights_arr.sum() > 0 else _np.full(n_classes, 1.0 / n_classes)\n'
        '    counts = _np.floor(weights_arr * n_samples).astype(int)\n'
        '    while counts.sum() < n_samples: counts[int(_np.argmin(counts))] += 1\n'
        '    while counts.sum() > n_samples: counts[int(_np.argmax(counts))] -= 1\n'
        '    clusters = max(1, int(n_clusters_per_class))\n'
        '    Xp, yp = [], []\n'
        '    for c in range(n_classes):\n'
        '        for cl in range(clusters):\n'
        '            cnt = counts[c] // clusters + (1 if cl < counts[c] % clusters else 0)\n'
        '            if cnt <= 0: continue\n'
        '            center = _np.random.randn(n_informative) * 0.6 + (c * 2 - (n_classes - 1)) * class_sep\n'
        '            center += (cl - (clusters - 1) / 2.0) * 0.8 * class_sep\n'
        '            informative = _np.random.randn(cnt, n_informative) + center\n'
        '            parts = [informative]\n'
        '            if n_redundant:\n'
        '                mix = _np.random.randn(n_informative, n_redundant)\n'
        '                parts.append(informative @ mix / max(1, n_informative))\n'
        '            if n_repeated:\n'
        '                base = _np.hstack(parts)\n'
        '                reps = base[:, _np.arange(n_repeated) % base.shape[1]]\n'
        '                parts.append(reps)\n'
        '            if n_noise:\n'
        '                parts.append(_np.random.randn(cnt, n_noise))\n'
        '            Xp.append(_np.hstack(parts)); yp.append(_np.full(cnt, c, dtype=_np.int64))\n'
        '    X, y = _np.vstack(Xp), _np.concatenate(yp)\n'
        '    if flip_y:\n'
        '        mask = _np.random.rand(len(y)) < float(flip_y)\n'
        '        y[mask] = _np.random.randint(0, n_classes, size=int(mask.sum()))\n'
        '    idx = _np.random.permutation(len(y)) if shuffle else _np.arange(len(y))\n'
        '    return X[idx], y[idx]\n'
        'def _ds_make_regression(n_samples=100, n_features=1, noise=10.0, random_state=None):\n'
        '    if random_state is not None: _np.random.seed(random_state)\n'
        '    X = _np.random.randn(n_samples, n_features); coef = _np.random.randn(n_features) * 5\n'
        '    return X, X @ coef + noise * _np.random.randn(n_samples)\n'
        'def _ds_make_blobs(n_samples=100, n_features=2, centers=3, cluster_std=1.0, random_state=None):\n'
        '    if random_state is not None: _np.random.seed(random_state)\n'
        '    cp = _np.random.randn(centers, n_features) * 5 if isinstance(centers, int) else _np.array(centers)\n'
        '    nc = len(cp); n_per = n_samples // nc; rem = n_samples - n_per * nc\n'
        '    Xp, yp = [], []\n'
        '    for c in range(nc):\n'
        '        cnt = n_per + (1 if c < rem else 0)\n'
        '        Xp.append(_np.random.randn(cnt, n_features) * cluster_std + cp[c]); yp.append(_np.full(cnt, c, dtype=_np.int64))\n'
        '    X, y = _np.vstack(Xp), _np.concatenate(yp); idx = _np.random.permutation(len(y))\n'
        '    return X[idx], y[idx]\n'
        'def _ds_load_digits(return_X_y=False):\n'
        '    _np.random.seed(42)\n'
        '    n_per = 18; Xp, yp = [], []\n'
        '    for d in range(10):\n'
        '        p = _np.random.randint(0, 16, size=(n_per, 64)).astype(_np.float64)\n'
        '        p[:, d*6:(d+1)*6] += 8; p = _np.clip(p, 0, 16)\n'
        '        Xp.append(p); yp.append(_np.full(n_per, d, dtype=_np.int64))\n'
        '    X, y = _np.vstack(Xp), _np.concatenate(yp)\n'
        '    if return_X_y: return X, y\n'
        '    return _make_bunch(data=X, target=y, feature_names=[f"pixel_{i}" for i in range(64)], target_names=_np.arange(10), DESCR="Digits")\n'
        '_ds_mod.load_iris = _ds_load_iris\n'
        '_ds_mod.load_wine = _ds_load_wine\n'
        '_ds_mod.load_digits = _ds_load_digits\n'
        '_ds_mod.load_breast_cancer = _ds_load_breast_cancer\n'
        '_ds_mod.make_classification = _ds_make_classification\n'
        '_ds_mod.make_regression = _ds_make_regression\n'
        '_ds_mod.make_blobs = _ds_make_blobs\n'
        'def _ds_make_moons(n_samples=100, noise=0.1, random_state=None):\n'
        '    if random_state is not None: _np.random.seed(random_state)\n'
        '    n_out = n_samples // 2; n_in = n_samples - n_out\n'
        '    ox = _np.cos(_np.linspace(0, _np.pi, n_out))\n'
        '    oy = _np.sin(_np.linspace(0, _np.pi, n_out))\n'
        '    ix = 1 - _np.cos(_np.linspace(0, _np.pi, n_in))\n'
        '    iy = 1 - _np.sin(_np.linspace(0, _np.pi, n_in)) - 0.5\n'
        '    X = _np.vstack([_np.column_stack([ox, oy]), _np.column_stack([ix, iy])])\n'
        '    y = _np.concatenate([_np.zeros(n_out, dtype=_np.int64), _np.ones(n_in, dtype=_np.int64)])\n'
        '    if noise and noise > 0: X += _np.random.normal(scale=noise, size=X.shape)\n'
        '    return X, y\n'
        'def _ds_make_circles(n_samples=100, noise=0.1, factor=0.8, random_state=None):\n'
        '    if random_state is not None: _np.random.seed(random_state)\n'
        '    n_out = n_samples // 2; n_in = n_samples - n_out\n'
        '    lo = _np.linspace(0, 2*_np.pi, n_out, endpoint=False)\n'
        '    li = _np.linspace(0, 2*_np.pi, n_in, endpoint=False)\n'
        '    X = _np.vstack([_np.column_stack([_np.cos(lo), _np.sin(lo)]), _np.column_stack([_np.cos(li)*factor, _np.sin(li)*factor])])\n'
        '    y = _np.concatenate([_np.zeros(n_out, dtype=_np.int64), _np.ones(n_in, dtype=_np.int64)])\n'
        '    if noise and noise > 0: X += _np.random.normal(scale=noise, size=X.shape)\n'
        '    return X, y\n'
        '_ds_mod.make_moons = _ds_make_moons\n'
        '_ds_mod.make_circles = _ds_make_circles\n'
        '# -- sandbox: datasets end --\n'
    )


# ---------------------------------------------------------------------------
# Matplotlib 图表捕获 — 将 plt.show() 替换为 base64 PNG 输出
# ---------------------------------------------------------------------------

_SANDBOX_IMG_BEGIN = "[SANDBOX_IMG_BASE64]"
_SANDBOX_IMG_END = "[/SANDBOX_IMG_BASE64]"


def _build_matplotlib_hook() -> str:
    """Build Python snippet that hooks matplotlib to capture figures as base64 PNG.

    Replaces plt.show() with a function that saves all open figures to
    base64-encoded PNG strings and prints them with special markers.
    Also sets the Agg backend so no GUI is needed.
    """
    return (
        '# -- sandbox: matplotlib hook begin --\n'
        'import os as _os\n'
        'import tempfile as _tempfile\n'
        '_os.environ.setdefault("MPLCONFIGDIR", _os.path.join(_tempfile.gettempdir(), "matplotlib"))\n'
        '_os.makedirs(_os.environ["MPLCONFIGDIR"], exist_ok=True)\n'
        'import warnings as _warnings\n'
        '_warnings.filterwarnings("ignore", message=r"Glyph .* missing from current font\\\\.")\n'
        'import matplotlib as _mpl\n'
        '_mpl.use("Agg")  # non-interactive backend\n'
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


def _code_uses_matplotlib(code: str) -> bool:
    """Check if code imports or uses matplotlib."""
    code_lower = code.lower()
    return "matplotlib" in code_lower or "import plt" in code_lower or "pyplot" in code_lower


def _extract_images_from_output(output: str) -> tuple[str, list[str]]:
    """Extract base64 image markers from output, returning cleaned output and images list."""
    images: list[str] = []
    clean_lines: list[str] = []
    i = 0
    lines = output.split('\n')
    while i < len(lines):
        line = lines[i]
        if _SANDBOX_IMG_BEGIN in line:
            # Extract base64 data, possibly spanning multiple lines
            img_data = line.split(_SANDBOX_IMG_BEGIN, 1)[1]
            if _SANDBOX_IMG_END in img_data:
                img_data = img_data.split(_SANDBOX_IMG_END, 1)[0]
                images.append(img_data)
            else:
                # multi-line (shouldn't happen normally but handle it)
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


def _auto_capture_matplotlib_figures() -> str:
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


# ---------------------------------------------------------------------------
# 方案 A — 进程内 exec()：利用预热好的 import 缓存
# ---------------------------------------------------------------------------

def _execute_in_process(code: str, timeout: int) -> ExecutionResponse:
    """Execute code in-process using exec() in a dedicated thread.

    This path benefits from pre-warmed imports because the modules are
    already loaded in sys.modules of this process.  Used for MindSpore
    code to avoid the 20-30s cold-start penalty of subprocess.
    """
    start = time.monotonic()

    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    result_holder: dict = {"success": False, "error": None}

    def _run():
        try:
            globals_dict = {"__name__": "__main__", "__builtins__": __builtins__}
            with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
                exec(compile(code, "<sandbox>", "exec"), globals_dict, globals_dict)
            result_holder["success"] = True
        except Exception:
            result_holder["error"] = traceback.format_exc()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    thread.join(timeout=timeout)

    elapsed = int((time.monotonic() - start) * 1000)

    if thread.is_alive():
        # Thread is still running — timeout
        return ExecutionResponse(
            success=False,
            output="",
            error=f"执行超时（限制 {timeout} 秒）",
            execution_time_ms=elapsed,
        )

    stdout_text = stdout_buf.getvalue()
    stderr_text = stderr_buf.getvalue()[:ERROR_LIMIT]

    # Extract embedded images from full stdout BEFORE truncating text
    clean_output, images = _extract_images_from_output(stdout_text)
    clean_output = clean_output[:OUTPUT_LIMIT]

    if result_holder["error"]:
        error_text = result_holder["error"][:ERROR_LIMIT]
        return ExecutionResponse(
            success=False,
            output=clean_output,
            error=stderr_text + error_text if stderr_text else error_text,
            execution_time_ms=elapsed,
            images=images,
        )

    return ExecutionResponse(
        success=True,
        output=clean_output,
        error=stderr_text or None,
        execution_time_ms=elapsed,
        images=images,
    )


# ---------------------------------------------------------------------------
# 方案 B — 子进程 subprocess.run()：安全性更高的隔离执行
# ---------------------------------------------------------------------------

def _execute_in_subprocess(code: str, stdin_text: str, timeout: int) -> ExecutionResponse:
    """Execute code in a subprocess with resource limits."""
    start = time.monotonic()
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8")

    try:
        tmp.write(code)
        tmp.flush()
        tmp.close()

        result = subprocess.run(
            [sys.executable, tmp.name],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=tempfile.gettempdir(),
            input=stdin_text if stdin_text else None,
            preexec_fn=_build_preexec(),
        )
        stdout = (result.stdout or "")
        stderr = (result.stderr or "")[:ERROR_LIMIT]

        # Extract embedded images from full stdout BEFORE truncating text
        clean_output, images = _extract_images_from_output(stdout)
        clean_output = clean_output[:OUTPUT_LIMIT]

        return ExecutionResponse(
            success=result.returncode == 0,
            output=clean_output,
            error=stderr or None,
            execution_time_ms=int((time.monotonic() - start) * 1000),
            images=images,
        )
    except subprocess.TimeoutExpired:
        return ExecutionResponse(
            success=False,
            output="",
            error=f"执行超时（限制 {timeout} 秒）",
            execution_time_ms=int((time.monotonic() - start) * 1000),
            images=[],
        )
    except Exception as exc:
        return ExecutionResponse(
            success=False,
            output="",
            error=str(exc),
            execution_time_ms=int((time.monotonic() - start) * 1000),
        )
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


def execute_python(code: str, stdin_text: str = "", timeout: int = DEFAULT_TIMEOUT) -> ExecutionResponse:
    """Execute Python code, choosing the optimal execution strategy.

    MindSpore code uses in-process exec() to benefit from pre-warmed imports.
    All other code uses subprocess for better isolation.
    """
    blocked_reason = _check_code_safety(code)
    if blocked_reason:
        return ExecutionResponse(success=False, output="", error=blocked_reason, execution_time_ms=0)

    # Apply minimum timeout floor for heavy libraries
    effective_timeout = _get_effective_timeout(code, timeout)
    _logger.info(
        "[execute] timeout: requested=%ds, effective=%ds, mindspore=%s",
        timeout, effective_timeout, _code_uses_mindspore(code),
    )

    # Prepare effective code with injected helpers
    effective_code = code
    if not stdin_text and ("input(" in code or "input (" in code):
        effective_code = _build_mock_input_wrapper() + effective_code
    if "sandbox_datasets" in code:
        effective_code = _build_sandbox_datasets_script() + effective_code
    if _code_uses_matplotlib(code):
        effective_code = _build_matplotlib_hook() + effective_code
        effective_code = effective_code + _auto_capture_matplotlib_figures()

    # Strategy selection:
    # MindSpore code → in-process exec() (benefits from pre-warmed imports)
    # Other code → subprocess (better isolation, resource limits)
    uses_mindspore = _code_uses_mindspore(code)
    mindspore_warmed = _warmed_modules.get("mindspore", False)

    if uses_mindspore and mindspore_warmed and not stdin_text:
        _logger.info("[execute] Using in-process exec() for MindSpore code (pre-warmed)")
        return _execute_in_process(effective_code, effective_timeout)
    else:
        if uses_mindspore and not mindspore_warmed:
            _logger.warning("[execute] MindSpore not pre-warmed, falling back to subprocess")
        return _execute_in_subprocess(effective_code, stdin_text, effective_timeout)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "warmed_modules": {k: v for k, v in _warmed_modules.items()},
    }


@app.post("/execute", response_model=ExecutionResponse)
def execute(payload: ExecutionRequest) -> ExecutionResponse:
    return execute_python(payload.code, stdin_text=payload.stdin_text, timeout=payload.timeout)
