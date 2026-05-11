/**
 * usePyodide – 懒加载 Pyodide，并将轻量 Python 代码留在前端执行，
 * 将重代码切换到后端沙箱。
 */
import { useState, useEffect, useCallback, useRef } from "react";

import { routePythonExecution } from "@/lib/pythonExecutionRouter";
import {
    analyzePythonRuntimeRequirements,
    prepareDatasetEnvironment,
    prepareMindsporeLiteEnvironment,
    type PythonRuntimeAdapter,
} from "@/lib/pythonLiteRuntime";

interface PyodideInterface extends PythonRuntimeAdapter {
    loadPackagesFromImports(code: string): Promise<void>;
}

interface MicropipInterface {
    add_mock_package(name: string, version: string): void;
}

interface LoadPyodideFn {
    (config?: { indexURL?: string }): Promise<PyodideInterface>;
}

declare global {
    interface Window {
        loadPyodide?: LoadPyodideFn;
    }
}

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/";
const PYODIDE_SCRIPT_URL = `${PYODIDE_CDN}pyodide.js`;
const RUN_TIMEOUT_MS = 30_000;

let pyodideInstance: PyodideInterface | null = null;
let pyodideLoadingPromise: Promise<PyodideInterface> | null = null;

const TORCH_LITE_SCRIPT = `
import sys as _sys
import types as _types
import numpy as _np
import torch as _torch

_torch.__path__ = []
_torch.__version__ = "2.1.0"

for _name, _dtype in [
    ("float16", _np.float16),
    ("float32", _np.float32),
    ("float64", _np.float64),
    ("int32", _np.int32),
    ("int64", _np.int64),
]:
    setattr(_torch, _name, _dtype)

def _to_numpy(value):
    if isinstance(value, Tensor):
        return value.data
    return _np.array(value)

class Tensor:
    __array_priority__ = 1000

    def __init__(self, data=None, dtype=None, device=None, requires_grad=False):
        self.data = _np.array(_to_numpy(data), dtype=dtype) if dtype is not None else _np.array(_to_numpy(data))
        self.requires_grad = requires_grad
        self.device = device or "cpu"

    @property
    def shape(self):
        return self.data.shape

    @property
    def T(self):
        return Tensor(self.data.T)

    def numpy(self):
        return self.data.copy()

    def reshape(self, *shape):
        if len(shape) == 1 and isinstance(shape[0], (tuple, list)):
            shape = tuple(shape[0])
        return Tensor(self.data.reshape(*shape))

    def __repr__(self):
        return f"tensor({self.data})"

    __str__ = __repr__

    def __add__(self, other):
        return Tensor(self.data + _to_numpy(other))

    def __sub__(self, other):
        return Tensor(self.data - _to_numpy(other))

    def __mul__(self, other):
        return Tensor(self.data * _to_numpy(other))

    def __matmul__(self, other):
        return Tensor(_np.matmul(self.data, _to_numpy(other)))

def tensor(data, dtype=None, device=None, requires_grad=False):
    return Tensor(data, dtype=dtype, device=device, requires_grad=requires_grad)

def zeros(shape, dtype=_np.float32):
    return Tensor(_np.zeros(shape, dtype=dtype))

def ones(shape, dtype=_np.float32):
    return Tensor(_np.ones(shape, dtype=dtype))

def arange(start, stop=None, step=1, dtype=None):
    if stop is None:
        return Tensor(_np.arange(start, dtype=dtype))
    return Tensor(_np.arange(start, stop, step, dtype=dtype))

def matmul(a, b):
    return Tensor(_np.matmul(_to_numpy(a), _to_numpy(b)))

_torch.Tensor = Tensor
_torch.tensor = tensor
_torch.zeros = zeros
_torch.ones = ones
_torch.arange = arange
_torch.matmul = matmul

def _ensure_submodule(parent, full_name):
    module = _sys.modules.get(full_name)
    if module is None:
        module = _types.ModuleType(full_name)
        module.__path__ = []
        module.__package__ = full_name
        _sys.modules[full_name] = module
        setattr(parent, full_name.split(".")[-1], module)
    return module

_nn_mod = _ensure_submodule(_torch, "torch.nn")
_functional_mod = _ensure_submodule(_nn_mod, "torch.nn.functional")
_functional_mod.relu = lambda x: Tensor(_np.maximum(0, _to_numpy(x)))
`;

function buildModuleResetScript(moduleName: string): string {
    return `
import sys as _sys
for _name in [name for name in list(_sys.modules) if name == "${moduleName}" or name.startswith("${moduleName}.")]:
    del _sys.modules[_name]
`;
}

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`加载 Pyodide 脚本失败: ${src}`));
        document.head.appendChild(script);
    });
}

async function initPyodide(): Promise<PyodideInterface> {
    if (pyodideInstance) return pyodideInstance;

    if (!pyodideLoadingPromise) {
        pyodideLoadingPromise = (async () => {
            await loadScript(PYODIDE_SCRIPT_URL);
            if (!window.loadPyodide) {
                throw new Error("loadPyodide 未在全局可用");
            }
            pyodideInstance = await window.loadPyodide({ indexURL: PYODIDE_CDN });
            return pyodideInstance;
        })();
    }

    return pyodideLoadingPromise;
}

async function prepareTorchLiteEnvironment(py: PyodideInterface): Promise<void> {
    await py.loadPackage("numpy");
    await py.loadPackage("micropip");
    const micropip = py.pyimport("micropip") as MicropipInterface;
    micropip.add_mock_package("torch", "2.1.0");
    py.runPython(buildModuleResetScript("torch"));
    py.runPython(TORCH_LITE_SCRIPT);
}

/**
 * Build the Python sandbox execution script with smart input() mock.
 *
 * Mock priority order:
 *   P1. Instructional hints:  尝试输入'十' / try typing 'test'
 *   P2. Example value patterns:  (e.g., 25)  /  (如: 1.75)
 *   P3. Keyword-based defaults:  age→25, height→1.75, name→Alice
 *   P4. Generic fallback values
 *
 * NOTE: Chinese curly quotes (U+2018/U+2019/U+201C/U+201D/U+300C/U+300D)
 * cannot appear literally in Python 3.12 source — SyntaxError.
 * We use chr() to build the regex character class at runtime.
 */
export function buildSandboxScript(codeB64: string): string {
    // P2 regex only uses ASCII chars and unicode escapes, safe for r'' strings
    const egRegex =
        "(?:e\\.?g\\.?[,:]?|\\u5982[\\uff1a:]|\\u4f8b\\u5982[\\uff1a:]?)\\s*([^\\)\\]]+)";

    // Build Python lines. The __try_pat regex is built at runtime using chr()
    // to avoid curly-quote literals that Python 3.12 rejects as SyntaxError.
    const pyLines: string[] = [
        "import sys as __sys, io as __io, base64 as __b64, traceback as __tb, re as __re",
        "",
        "__old_out, __old_err = __sys.stdout, __sys.stderr",
        "__cap_out, __cap_err = __io.StringIO(), __io.StringIO()",
        "__sys.stdout, __sys.stderr = __cap_out, __cap_err",
        '__sandbox_globals = {"__name__": "__main__", "__builtins__": __builtins__}',
        "",
        "# mock input(): browser sandbox has no stdin",
        "# P1 regex uses \\u/\\x escapes (not literal curly quotes) to avoid Python 3.12 SyntaxError",
        '__try_pat = "(?:\\u5c1d\\u8bd5|\\u8bd5\\u8bd5|\\u8bf7)?\\u8f93\\u5165\\\\s*[\\x27\\u2018\\u201c\\x22\\u300c](.+?)[\\x27\\u2019\\u201d\\x22\\u300d]|try\\\\s+(?:entering|typing|inputting|input)\\\\s*[\\x27\\x22](.+?)[\\x27\\x22]"',
        "__input_call_count = 0",
        '__input_fallback = ["hello", "42", "test", "3.14", "world"]',
        "",
        'def __sandbox_input(prompt=""):',
        "    global __input_call_count",
        "    value = None",
        "    ps = str(prompt)",
        "",
        "    # P1: instructional hints",
        "    try_m = __re.search(__try_pat, ps)",
        "    if try_m:",
        "        value = (try_m.group(1) or try_m.group(2) or '').strip()",
        "",
        "    # P2: example value patterns like (e.g., 25)",
        "    if not value:",
        `        eg = __re.search(r'${egRegex}', ps)`,
        "        if eg:",
        '            value = eg.group(1).strip().rstrip(".,;:\\u3001\\uff0c\\u3002")',
        "",
        "    # P3: keyword-based defaults",
        "    if not value:",
        "        pl = ps.lower()",
        '        if any(k in pl for k in ["age","\\u5e74\\u9f84","\\u5c81"]): value = "25"',
        '        elif any(k in pl for k in ["height","\\u8eab\\u9ad8","\\u9ad8\\u5ea6","meter"]): value = "1.75"',
        '        elif any(k in pl for k in ["weight","\\u4f53\\u91cd"]): value = "65"',
        '        elif any(k in pl for k in ["score","\\u5206\\u6570","\\u6210\\u7ee9"]): value = "85"',
        '        elif any(k in pl for k in ["price","\\u4ef7\\u683c"]): value = "9.99"',
        '        elif any(k in pl for k in ["number","\\u6570\\u5b57","num","integer","\\u6574\\u6570"]): value = "42"',
        '        elif any(k in pl for k in ["name","\\u540d\\u5b57","\\u59d3\\u540d"]): value = "Alice"',
        '        elif any(k in pl for k in ["yes","no","y/n","\\u662f\\u5426"]): value = "yes"',
        '        elif any(k in pl for k in ["password","\\u5bc6\\u7801"]): value = "abc123"',
        '        elif any(k in pl for k in ["email","\\u90ae\\u7bb1"]): value = "user@example.com"',
        "",
        "    # P4: generic fallback",
        "    if not value:",
        "        value = __input_fallback[__input_call_count % len(__input_fallback)]",
        "    __input_call_count += 1",
        "    if prompt:",
        '        print(prompt, end="")',
        "    print(value)",
        '    print(f"  \\u26a0 [\\u6d4f\\u89c8\\u5668\\u6c99\\u7bb1] input() \\u4e0d\\u652f\\u6301\\u771f\\u5b9e\\u952e\\u76d8\\u8f93\\u5165\\uff0c\\u5df2\\u81ea\\u52a8\\u586b\\u5165\\u6a21\\u62df\\u503c: {repr(value)}")',
        "    return value",
        "",
        '__sandbox_globals["input"] = __sandbox_input',
        "",
        "try:",
        `    __code = __b64.b64decode("${codeB64}").decode("utf-8")`,
        '    exec(compile(__code, "<playground>", "exec"), __sandbox_globals, __sandbox_globals)',
        "except:",
        "    __tb.print_exc(file=__cap_err)",
        "try:",
        "    import warnings as _warnings",
        '    _warnings.filterwarnings("ignore", message=r"Glyph .* missing from current font\\.")',
        "except ImportError:",
        "    pass",
        "try:",
        "    import matplotlib.pyplot as _plt_auto",
        "    if _plt_auto.get_fignums():",
        "        _plt_auto.show()",
        "except ImportError:",
        "    pass",
        "finally:",
        "    __sys.stdout, __sys.stderr = __old_out, __old_err",
        "    __result_stdout__ = __cap_out.getvalue()",
        "    __result_stderr__ = __cap_err.getvalue()",
    ];

    return pyLines.join("\n");
}

export interface RunPythonResult {
    stdout: string;
    stderr: string;
    executionTarget?: "frontend" | "backend";
    notice?: string | null;
    images?: string[];  // base64-encoded PNG images from matplotlib
}

// ---------------------------------------------------------------------------
// Matplotlib image extraction helpers
// ---------------------------------------------------------------------------
const SANDBOX_IMG_BEGIN = "[SANDBOX_IMG_BASE64]";
const SANDBOX_IMG_END = "[/SANDBOX_IMG_BASE64]";

function extractImagesFromOutput(output: string): { cleanOutput: string; images: string[] } {
    const images: string[] = [];
    const cleanLines: string[] = [];
    const lines = output.split("\n");
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (line.includes(SANDBOX_IMG_BEGIN)) {
            let imgData = line.split(SANDBOX_IMG_BEGIN)[1] || "";
            if (imgData.includes(SANDBOX_IMG_END)) {
                imgData = imgData.split(SANDBOX_IMG_END)[0];
                images.push(imgData);
            } else {
                const parts = [imgData];
                i++;
                while (i < lines.length && !lines[i].includes(SANDBOX_IMG_END)) {
                    parts.push(lines[i]);
                    i++;
                }
                if (i < lines.length) {
                    parts.push(lines[i].split(SANDBOX_IMG_END)[0]);
                }
                images.push(parts.join(""));
            }
        } else {
            cleanLines.push(line);
        }
        i++;
    }
    return { cleanOutput: cleanLines.join("\n"), images };
}

// Matplotlib hook script for Pyodide frontend
export const MATPLOTLIB_HOOK_SCRIPT = `
import matplotlib as _mpl
_mpl.use("Agg")
import matplotlib.pyplot as _plt
from matplotlib import font_manager as _fm
import io as _io, base64 as _b64
_font_candidates = ["Noto Sans CJK SC", "Noto Sans CJK JP", "WenQuanYi Zen Hei", "Microsoft YaHei", "SimHei", "Arial Unicode MS", "DejaVu Sans"]
_available = {f.name for f in _fm.fontManager.ttflist}
_selected = [name for name in _font_candidates if name in _available]
if _selected:
    _mpl.rcParams["font.sans-serif"] = _selected + list(_mpl.rcParams.get("font.sans-serif", []))
_mpl.rcParams["axes.unicode_minus"] = False
def _sandbox_show(*args, **kwargs):
    for _fig_num in _plt.get_fignums():
        _fig = _plt.figure(_fig_num)
        _buf = _io.BytesIO()
        _fig.savefig(_buf, format="png", dpi=100, bbox_inches="tight", facecolor="white")
        _buf.seek(0)
        _img_b64 = _b64.b64encode(_buf.read()).decode("ascii")
        print(f"[SANDBOX_IMG_BASE64]{_img_b64}[/SANDBOX_IMG_BASE64]")
        _buf.close()
    _plt.close("all")
_plt.show = _sandbox_show
`;

function codeUsesMatplotlib(code: string): boolean {
    const lower = code.toLowerCase();
    return lower.includes("matplotlib") || lower.includes("pyplot");
}

export function usePyodide() {
    const [loading, setLoading] = useState(false);
    const [ready, setReady] = useState(!!pyodideInstance);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const ensureReady = useCallback(async () => {
        if (pyodideInstance) {
            if (!ready) setReady(true);
            return pyodideInstance;
        }

        const py = await initPyodide();
        if (mountedRef.current) {
            setReady(true);
        }
        return py;
    }, [ready]);

    const runPythonInBrowser = useCallback(
        async (code: string): Promise<{ stdout: string; stderr: string; images?: string[] }> => {
            const py = await ensureReady();
            const requirements = analyzePythonRuntimeRequirements(code);

            try {
                if (requirements.preloadPackages.length > 0) {
                    await py.loadPackage(requirements.preloadPackages);
                }

                if (requirements.needsMindspore) {
                    await prepareMindsporeLiteEnvironment(py);
                }

                if (requirements.needsTorch) {
                    await prepareTorchLiteEnvironment(py);
                }

                if (requirements.needsDatasets) {
                    await prepareDatasetEnvironment(py);
                }

                // Load and hook matplotlib if needed
                if (codeUsesMatplotlib(code)) {
                    await py.loadPackage("matplotlib");
                    py.runPython(MATPLOTLIB_HOOK_SCRIPT);
                }

                await py.loadPackagesFromImports(code);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return {
                    stdout: "",
                    stderr: `Python 运行环境初始化失败：${message}`,
                };
            }

            const codeB64 = btoa(unescape(encodeURIComponent(code)));
            const sandboxScript = buildSandboxScript(codeB64);

            return new Promise<{ stdout: string; stderr: string; images?: string[] }>((resolve) => {
                const timer = setTimeout(() => {
                    resolve({
                        stdout: "",
                        stderr: "⏱ 执行超时（超过 10 秒），请检查是否有死循环或重计算任务。",
                    });
                }, RUN_TIMEOUT_MS);

                try {
                    py.runPython(sandboxScript);
                    clearTimeout(timer);
                    const rawStdout = String(py.runPython("__result_stdout__") ?? "");
                    const { cleanOutput, images } = extractImagesFromOutput(rawStdout);
                    resolve({
                        stdout: cleanOutput,
                        stderr: String(py.runPython("__result_stderr__") ?? ""),
                        images,
                    });
                } catch (err) {
                    clearTimeout(timer);
                    resolve({
                        stdout: "",
                        stderr: err instanceof Error ? err.message : String(err),
                    });
                }
            });
        },
        [ensureReady]
    );

    const runPython = useCallback(
        async (code: string): Promise<RunPythonResult> => {
            if (mountedRef.current) {
                setLoading(true);
                setError(null);
            }

            try {
                const result = await routePythonExecution(code, {
                    runInBrowser: runPythonInBrowser,
                });

                if (mountedRef.current) {
                    if (result.executionTarget === "frontend") {
                        setReady(true);
                    }
                    setLoading(false);
                }

                return {
                    ...result,
                    images: result.images || [],
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                if (mountedRef.current) {
                    setError(message);
                    setLoading(false);
                }
                return {
                    stdout: "",
                    stderr: message,
                    executionTarget: "frontend",
                    notice: null,
                };
            }
        },
        [runPythonInBrowser]
    );

    return { runPython, loading, ready, error };
}
