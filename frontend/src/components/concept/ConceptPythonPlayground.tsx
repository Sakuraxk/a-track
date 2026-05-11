import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Copy, Check, Terminal, Loader2, ImageIcon, Maximize2, Minimize2 } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { usePyodide } from '@/hooks/usePyodide';

interface ConceptPythonPlaygroundProps {
    initialCode: string;
}

export default function ConceptPythonPlayground({ initialCode }: ConceptPythonPlaygroundProps) {
    const [code, setCode] = useState(initialCode);
    const [copied, setCopied] = useState(false);
    const [output, setOutput] = useState<string | null>(null);
    const [errorOutput, setErrorOutput] = useState<string | null>(null);
    const [noticeOutput, setNoticeOutput] = useState<string | null>(null);
    const [images, setImages] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [hasRun, setHasRun] = useState(false);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
    const hasEditedRef = useRef(false);

    const { runPython, loading: pyodideLoading, ready: pyodideReady } = usePyodide();

    // 流式生成时同步 initialCode prop 到内部状态（用户手动编辑后停止同步）
    useEffect(() => {
        if (!hasEditedRef.current) {
            setCode(initialCode);
        }
    }, [initialCode]);

    const handleEditorChange = (value: string | undefined) => {
        hasEditedRef.current = true;
        setCode(value || '');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRun = useCallback(async () => {
        setIsRunning(true);
        setOutput(null);
        setErrorOutput(null);
        setNoticeOutput(null);
        setImages([]);
        setHasRun(false);
        try {
            const result = await runPython(code);
            setOutput(result.stdout || null);
            setErrorOutput(result.stderr || null);
            setNoticeOutput(result.notice || null);
            setImages(result.images || []);
        } catch (err) {
            setErrorOutput(err instanceof Error ? err.message : String(err));
        } finally {
            setIsRunning(false);
            setHasRun(true);
        }
    }, [code, runPython]);

    const runButtonLabel = (() => {
        if (isRunning) return '运行中...';
        if (pyodideLoading) return '加载中...';
        return '运行 (Run)';
    })();

    const runButtonDisabled = isRunning || pyodideLoading;

    const showOutputPanel = output || errorOutput || hasRun || images.length > 0;

    return (
        <div className="my-6 overflow-hidden rounded-xl border border-slate-700/50 bg-[#1e1e1e] shadow-xl">
            <div className="flex items-center justify-between bg-[#2d2d2d] px-4 py-2 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-medium text-slate-300">代码演示</span>

                    {pyodideReady && (
                        <span className="text-[10px] text-emerald-400/70 font-mono">✅ 就绪</span>
                    )}
                    {pyodideLoading && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400/70 font-mono">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            加载 Python 引擎...
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 rounded-md p-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white"
                        title="Copy code"
                    >
                        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <button
                        onClick={handleRun}
                        disabled={runButtonDisabled}
                        className="flex items-center gap-1.5 rounded-md bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30 hover:text-emerald-300 disabled:opacity-50"
                    >
                        {isRunning || pyodideLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Play className="h-3.5 w-3.5" />
                        )}
                        <span>{runButtonLabel}</span>
                    </button>
                </div>
            </div>
            <div className="relative">
                <Editor
                    height="200px"
                    defaultLanguage="python"
                    theme="vs-dark"
                    value={code}
                    onChange={handleEditorChange}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineHeight: 24,
                        padding: { top: 16, bottom: 16 },
                        scrollBeyondLastLine: false,
                        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                    }}
                />
            </div>
            {showOutputPanel && (
                <div className="border-t border-slate-700/50 bg-[#1e1e1e] p-4 text-sm font-mono">
                    {/* Notice (backend redirect) */}
                    {noticeOutput && (
                        <pre className="mb-3 whitespace-pre-wrap rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">⚡ {noticeOutput}</pre>
                    )}

                    <div className="mb-2 text-xs font-semibold text-slate-500">Output:</div>

                    {/* Text output */}
                    {output && (
                        <pre className="whitespace-pre-wrap text-slate-300">{output}</pre>
                    )}

                    {/* Error output */}
                    {errorOutput && (
                        <pre className="whitespace-pre-wrap text-red-400 mt-1">{errorOutput}</pre>
                    )}

                    {/* ═══ Matplotlib / 图表输出 ═══ */}
                    {images.length > 0 && (
                        <div className="mt-3 space-y-3">
                            {images.length > 0 && (
                                <div className="flex items-center gap-1 text-[11px] text-blue-300 mb-2">
                                    <ImageIcon className="h-3 w-3" />
                                    {images.length} 张图表
                                </div>
                            )}
                            {images.map((imgBase64, idx) => (
                                <div key={idx} className="group relative overflow-hidden rounded-xl border border-slate-600/50 bg-white">
                                    <img
                                        src={`data:image/png;base64,${imgBase64}`}
                                        alt={`图表 ${idx + 1}`}
                                        className="h-auto w-full cursor-pointer"
                                        style={{ maxHeight: '500px', objectFit: 'contain' }}
                                        onClick={() => setExpandedImage(imgBase64)}
                                    />
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => setExpandedImage(imgBase64)}
                                            className="flex items-center gap-1 rounded-lg bg-slate-900/70 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm hover:bg-slate-900/90"
                                        >
                                            <Maximize2 className="h-3 w-3" />
                                            放大
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* No output */}
                    {!output && !errorOutput && images.length === 0 && hasRun && (
                        <pre className="whitespace-pre-wrap text-emerald-400/70">✅ 代码运行成功（无输出）</pre>
                    )}
                </div>
            )}

            {/* Full-screen image viewer */}
            {expandedImage && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setExpandedImage(null)}
                >
                    <div className="relative max-h-[90vh] max-w-[90vw]" onClick={e => e.stopPropagation()}>
                        <img
                            src={`data:image/png;base64,${expandedImage}`}
                            alt="放大查看"
                            className="max-h-[85vh] max-w-[85vw] rounded-xl shadow-2xl"
                            style={{ objectFit: 'contain' }}
                        />
                        <button
                            onClick={() => setExpandedImage(null)}
                            className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg hover:bg-slate-100 transition-colors"
                        >
                            <Minimize2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
