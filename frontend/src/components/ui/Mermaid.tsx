import React, { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { Loader2, AlertCircle, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';

/** Font stack matching the site – ensures Mermaid measures Chinese text
 *  at the same width the browser will actually render it. */
const MERMAID_FONT =
  '"Plus Jakarta Sans", "Noto Sans SC", system-ui, -apple-system, sans-serif';

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#14b8a6',
    primaryTextColor: '#fff',
    primaryBorderColor: '#0d9488',
    lineColor: '#64748b',
    secondaryColor: '#f1f5f9',
    tertiaryColor: '#fff',
    fontFamily: MERMAID_FONT,
    fontSize: '14px',
    /* Edge label styling – make text on lines clearly visible */
    edgeLabelBackground: '#f0fdfa',
  },
  flowchart: {
    htmlLabels: true,
    padding: 15,
    nodeSpacing: 30,
    rankSpacing: 50,
    wrappingWidth: 200,
  },
  securityLevel: 'loose',
  suppressErrorRendering: true,
});

/**
 * Post-process the rendered SVG to prevent text clipping inside nodes.
 *
 * Mermaid wraps text with `<foreignObject>` elements whose width is
 * pre-calculated. When the actual rendered font is wider than expected
 * the text gets clipped.  This function:
 *   1. Removes hard `max-width` on the inner wrapper `<div>`.
 *   2. Switches `white-space: nowrap` → `normal` so long labels can wrap.
 *   3. Adds a small buffer to every `foreignObject` width attribute.
 */
function patchSvgForeignObjects(svgString: string): string {
  let patched = svgString;

  // 1. Remove max-width and switch white-space:nowrap → normal for node label divs
  patched = patched.replace(
    /(<foreignObject[^>]*>\s*<div[^>]*?)style="([^"]*?)"/g,
    (_match, prefix, styleStr) => {
      let newStyle = styleStr
        .replace(/white-space:\s*nowrap;?\s*/g, 'white-space: normal; ')
        .replace(/max-width:\s*[\d.]+px;?\s*/g, '')
        .trim();
      return `${prefix}style="${newStyle}"`;
    }
  );

  // 2. Widen foreignObject by 20% — only if width > 10 (skips edge label placeholders)
  patched = patched.replace(
    /(<foreignObject[^>]*?\s)width="([\d.]+)"/g,
    (_match, prefix, w) => {
      const original = parseFloat(w);
      if (original <= 10) return _match; // skip trivial/edge-label FOs
      const wider = Math.ceil(original * 1.2);
      return `${prefix}width="${wider}"`;
    }
  );

  // 3. Increase foreignObject height by 50% — only if height > 10
  patched = patched.replace(
    /(<foreignObject[^>]*?\s)height="([\d.]+)"/g,
    (_match, prefix, h) => {
      const original = parseFloat(h);
      if (original <= 10) return _match;
      const taller = Math.ceil(original * 1.5);
      return `${prefix}height="${taller}"`;
    }
  );

  return patched;
}

interface MermaidProps {
  chart: string;
}

/**
 * Strip LaTeX expressions ($...$, $$...$$) to plain text,
 * keeping just the core symbol names for readability in Mermaid labels.
 */
function stripLatex(text: string): string {
  return text
    // Remove $$ ... $$ blocks
    .replace(/\$\$[\s\S]*?\$\$/g, (match) => {
      const inner = match.slice(2, -2).trim();
      return simplifyLatexInner(inner);
    })
    // Remove $ ... $ inline
    .replace(/\$([^$]+)\$/g, (_match, inner) => {
      return simplifyLatexInner(inner.trim());
    });
}

/**
 * Simplify a LaTeX expression to plain text for Mermaid labels.
 */
function simplifyLatexInner(latex: string): string {
  return latex
    // Common commands to readable equivalents
    .replace(/\\lim/g, 'lim')
    .replace(/\\infty/g, '∞')
    .replace(/\\varepsilon/g, 'ε')
    .replace(/\\epsilon/g, 'ε')
    .replace(/\\delta/g, 'δ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\forall/g, '∀')
    .replace(/\\exists/g, '∃')
    .replace(/\\in/g, '∈')
    .replace(/\\notin/g, '∉')
    .replace(/\\subset/g, '⊂')
    .replace(/\\cup/g, '∪')
    .replace(/\\cap/g, '∩')
    .replace(/\\to/g, '→')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\iff/g, '⇔')
    .replace(/\\Leftrightarrow/g, '⇔')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\pm/g, '±')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1/$2)')
    .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    .replace(/\\mathbb\{([^}]*)\}/g, '$1')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\operatorname\{([^}]*)\}/g, '$1')
    // Remove remaining backslash commands
    .replace(/\\[a-zA-Z]+/g, '')
    // Clean up braces
    .replace(/\{/g, '')
    .replace(/\}/g, '')
    // Clean underscores and carets for subscript/superscript
    .replace(/_([a-zA-Z0-9])/g, '$1')
    .replace(/\^([a-zA-Z0-9])/g, '$1')
    .replace(/_\(([^)]*)\)/g, '$1')
    .replace(/\^\(([^)]*)\)/g, '$1')
    .trim();
}

/**
 * Sanitize a label string so that it's safe inside Mermaid ["..."] labels.
 * Removes or replaces characters that break Mermaid parsing,
 * but preserves <br>, <br/>, <br /> line-break tags that Mermaid uses.
 */
function sanitizeLabel(label: string): string {
  // First, temporarily protect <br> variants from being stripped
  const BR_PLACEHOLDER = '\x00BR\x00';
  let result = label
    .replace(/<br\s*\/?>/gi, BR_PLACEHOLDER)
    // Strip LaTeX
    .replace(/\$\$[\s\S]*?\$\$/g, (m) => simplifyLatexInner(m.slice(2, -2).trim()))
    .replace(/\$([^$]+)\$/g, (_, inner) => simplifyLatexInner(inner.trim()))
    // Replace problematic characters for Mermaid
    .replace(/"/g, "'")
    .replace(/\\/g, '')
    .replace(/[<>]/g, '')
    .replace(/\|/g, ' ')
    // Remove parentheses (ASCII and fullwidth) — they break Mermaid label parsing
    .replace(/[()（）]/g, (ch) => ch === '(' || ch === '（' ? ' - ' : '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Restore <br/> tags
  result = result.replace(new RegExp(BR_PLACEHOLDER, 'g'), '<br/>');
  return result;
}

/**
 * Fix node definitions where Chinese text is used as node ID directly.
 * Converts patterns like: 中文节点 --> 另一个节点
 * To: n1["中文节点"] --> n2["另一个节点"]
 */
function fixChineseNodeIds(chart: string): string {
  const lines = chart.split('\n');
  const nodeMap = new Map<string, string>();
  let nodeCounter = 0;

  function getNodeId(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return trimmed;
    // If already a valid ASCII id (possibly with label), return as-is
    if (/^[a-zA-Z_][a-zA-Z0-9_]*(\[.*\]|\(.*\)|\{.*\})?$/.test(trimmed)) {
      return trimmed;
    }
    // If it's an ID with label like A["text"], return as-is
    if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*\[".+"\]$/.test(trimmed)) {
      return trimmed;
    }
    // If it contains Chinese and no brackets, wrap it
    if (/[\u4e00-\u9fa5]/.test(trimmed) && !/[\[\](){}]/.test(trimmed)) {
      if (nodeMap.has(trimmed)) {
        return nodeMap.get(trimmed)!;
      }
      const id = `node${++nodeCounter}`;
      nodeMap.set(trimmed, `${id}["${sanitizeLabel(trimmed)}"]`);
      return nodeMap.get(trimmed)!;
    }
    return trimmed;
  }

  const result = lines.map(line => {
    // Skip directive lines (flowchart, graph, mindmap, etc.)
    if (/^\s*(flowchart|graph|mindmap|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)/i.test(line)) {
      return line;
    }
    // Skip empty lines and comment lines
    if (/^\s*$/.test(line) || /^\s*%%/.test(line)) {
      return line;
    }
    // Don't touch mindmap content lines (indented text without arrows)
    if (/^\s*(flowchart|graph)\s/i.test(chart.split('\n')[0] || '')) {
      // Process arrow connections in flowcharts
      // Match: A --> B, A --text--> B, A --- B, etc.
      const arrowMatch = line.match(/^(\s*)(.+?)\s*(-->|---|-\.->|==>|--[^>]+-->|--[^-]+---)\s*(.+)$/);
      if (arrowMatch) {
        const [, indent, left, arrow, right] = arrowMatch;
        return `${indent}${getNodeId(left)} ${arrow} ${getNodeId(right)}`;
      }
    }
    return line;
  });

  return result.join('\n');
}

function sanitizeMermaidChart(chart: string): string {
  let sanitized = chart
    // Remove markdown code fence wrappers
    .replace(/^```mermaid\s*/i, '')
    .replace(/```$/i, '')
    // Replace fullwidth punctuation with ASCII equivalents
    .replace(/["\u201C\u201D]/g, '"')
    .replace(/['\u2018\u2019]/g, "'")
    .replace(/[\uFF08]/g, '(')
    .replace(/[\uFF09]/g, ')')
    .replace(/[\uFF1A]/g, ':')
    .replace(/[\uFF1B]/g, ';')
    .replace(/[\uFF0C]/g, ',')
    .replace(/[\u3002]/g, '.')
    .replace(/[\u3010]/g, '[')
    .replace(/[\u3011]/g, ']')
    .replace(/\u2013|\u2014/g, '-')
    // Replace Unicode arrows with Mermaid arrow syntax (only between whitespace/word boundaries)
    .replace(/\s*→\s*/g, ' --> ')
    .replace(/\s*⇒\s*/g, ' ==> ')
    // Remove markdown list prefixes that shouldn't be in Mermaid
    .replace(/^\s*[-*]\s+/gm, '')
    .trim();

  // Strip LaTeX from all label content
  sanitized = stripLatex(sanitized);

  // Fix labels: ensure Chinese text is quoted in ["..."]
  // Match node definitions with unquoted Chinese labels like A[中文] → A["中文"]
  sanitized = sanitized.replace(
    /(\[[^\]"]*[\u4e00-\u9fa5][^\]"]*\])/g,
    (match) => {
      const inner = match.slice(1, -1);
      // Already quoted?
      if (inner.startsWith('"') && inner.endsWith('"')) return match;
      return `["${sanitizeLabel(inner)}"]`;
    }
  );
  
  // Fix round-bracket nodes with Chinese: A(中文) → A("中文")
  sanitized = sanitized.replace(
    /(\([^)"]*[\u4e00-\u9fa5][^)"]*\))/g,
    (match) => {
      // Don't touch root((...)) in mindmaps
      if (match.startsWith('((') && match.endsWith('))')) return match;
      const inner = match.slice(1, -1);
      if (inner.startsWith('"') && inner.endsWith('"')) return match;
      return `("${sanitizeLabel(inner)}")`;
    }
  );

  // Fix: remove any remaining problematic characters in quoted labels
  sanitized = sanitized.replace(
    /\["([^"]+)"\]/g,
    (_match, inner) => `["${sanitizeLabel(inner)}"]`
  );

  // ── Mindmap-specific fix ──
  // In Mermaid mindmap syntax, parentheses are shape delimiters.
  // Text like `str.format()` or `input("hello")` breaks parsing.
  // Strip all parentheses from mindmap content lines (but keep root((...))).
  const firstContentLine = sanitized.split('\n').find(l => l.trim().length > 0)?.trim().toLowerCase() || '';
  if (firstContentLine === 'mindmap' || firstContentLine.startsWith('mindmap ')) {
    const mLines = sanitized.split('\n');
    sanitized = mLines.map((line, idx) => {
      const trimmed = line.trim().toLowerCase();
      // Skip the `mindmap` directive line
      if (idx === 0 && (trimmed === 'mindmap' || trimmed.startsWith('mindmap '))) return line;
      // Preserve root((...)) double-paren syntax
      if (/^\s*root\s*\(\(/.test(line)) return line;
      // For all other mindmap lines, remove parentheses that break parsing
      return line.replace(/[()]/g, '');
    }).join('\n');
  }

  return sanitized;
}

/**
 * Attempt to produce a simpler, valid fallback chart when the original fails.
 * Extracts text labels and creates a basic flowchart.
 */
function buildFallbackChart(chart: string): string | null {
  const lines = chart.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Try to detect what type of chart this was supposed to be
  const firstLine = lines[0]?.toLowerCase() || '';
  
  if (firstLine.includes('mindmap')) {
    // For mindmaps, try to extract the tree structure
    const indentedLines = lines.slice(1);
    if (indentedLines.length < 2) return null;
    
    const rebuilt = ['mindmap'];
    for (const line of indentedLines) {
      const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
      // Strip all bracket/paren/brace characters that break mindmap parsing
      const text = line.trim()
        .replace(/^root\s*\(\((.+?)\)\)$/, '$1')  // extract root label
        .replace(/[()\[\]{}"]/g, '')
        .replace(/^-\s+/, '')  // Remove markdown list prefix
        .trim();
      if (text) {
        rebuilt.push(`${' '.repeat(Math.max(2, indent))}${text}`);
      }
    }
    return rebuilt.length > 2 ? rebuilt.join('\n') : null;
  }
  
  if (firstLine.includes('flowchart') || firstLine.includes('graph')) {
    // For flowcharts, try to extract nodes and edges
    const direction = firstLine.includes('lr') ? 'LR' : 'TD';
    const nodes: string[] = [];
    const edges: string[] = [];
    let nodeId = 0;
    
    const nameToId = new Map<string, string>();
    
    function getOrCreateId(name: string): string {
      const clean = sanitizeLabel(name.replace(/^[a-zA-Z_][a-zA-Z0-9_]*\s*/, '').replace(/[[\](){}"]/g, '')).trim();
      const key = clean || name;
      if (nameToId.has(key)) return nameToId.get(key)!;
      const id = `n${++nodeId}`;
      nameToId.set(key, id);
      nodes.push(`    ${id}["${key}"]`);
      return id;
    }
    
    for (const line of lines.slice(1)) {
      const arrowMatch = line.match(/^(.+?)\s*(-->|---|-\.->|==>)\s*(.+)$/);
      if (arrowMatch) {
        const leftId = getOrCreateId(arrowMatch[1]);
        const rightId = getOrCreateId(arrowMatch[3]);
        edges.push(`    ${leftId} --> ${rightId}`);
      }
    }
    
    if (nodes.length >= 2) {
      return [`flowchart ${direction}`, ...nodes, ...edges].join('\n');
    }
  }
  
  return null;
}

/** Minimum / maximum zoom levels (fullscreen only) */
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.15;

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSource, setShowSource] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const normalizedChart = sanitizeMermaidChart(chart);

  /* ── Render chart ── */
  useEffect(() => {
    let cancelled = false;
    const renderChart = async () => {
      if (!normalizedChart) { setLoading(false); return; }
      // Skip charts that are clearly incomplete (e.g., truncated during streaming)
      const lines = normalizedChart.split('\n').filter(l => l.trim());
      if (lines.length < 2 || normalizedChart.length < 20) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      // Attempt 1
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, normalizedChart);
        if (!cancelled) { setSvg(patchSvgForeignObjects(svg)); setLoading(false); }
        return;
      } catch { /* will retry */ }

      // Attempt 2 – fix Chinese node IDs
      try {
        const fixed = fixChineseNodeIds(normalizedChart);
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, fixed);
        if (!cancelled) { setSvg(patchSvgForeignObjects(svg)); setLoading(false); }
        return;
      } catch { /* will retry */ }

      // Attempt 3 – rebuild fallback
      try {
        const fallback = buildFallbackChart(normalizedChart);
        if (fallback) {
          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
          const { svg } = await mermaid.render(id, fallback);
          if (!cancelled) { setSvg(patchSvgForeignObjects(svg)); setLoading(false); }
          return;
        }
      } catch { /* fallback also failed */ }

      if (!cancelled) {
        console.warn('Mermaid: all render attempts failed for chart (showing fallback UI)');
        setSvg(''); setError('图表渲染失败'); setLoading(false);
      }
    };
    renderChart();
    return () => { cancelled = true; };
  }, [normalizedChart]);

  return (
    <>
      {/* ── Inline card (simple, no zoom/pan) ── */}
      <div className="my-6 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 px-4 py-2 bg-slate-50/50 dark:bg-slate-900/80">
          <div className={`h-2 w-2 rounded-full ${error ? 'bg-amber-400' : 'bg-teal-500 animate-pulse'}`} />
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            结构化流程图
          </span>
          {error && (
            <button
              onClick={() => setShowSource(!showSource)}
              className="ml-auto text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              {showSource ? '隐藏源码' : '查看源码'}
            </button>
          )}
          {!loading && !error && svg && (
            <button
              onClick={() => setIsFullscreen(true)}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
              title="全屏查看（支持缩放和拖拽）"
            >
              <Maximize2 className="h-3 w-3" />
              <span className="hidden sm:inline">全屏查看</span>
            </button>
          )}
        </div>
        <div className="p-6 flex flex-col items-center justify-center min-h-[100px]">
          {loading && <Loader2 className="h-6 w-6 animate-spin text-teal-500" />}
          {error ? (
            <div className="w-full space-y-3">
              <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 text-xs text-amber-600 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>图表暂不可用</span>
              </div>
              {showSource && (
                <pre className="max-h-[200px] overflow-auto rounded-lg bg-slate-100 dark:bg-slate-800 p-3 text-[11px] text-slate-600 dark:text-slate-400 font-mono leading-relaxed">
                  {normalizedChart}
                </pre>
              )}
            </div>
          ) : (
            <div
              ref={ref}
              className="mermaid-container w-full overflow-x-auto flex justify-center"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
        </div>
      </div>

      {/* ── Fullscreen modal (zoom / pan / drag) ── */}
      {isFullscreen && (
        <FullscreenViewer svg={svg} onClose={() => setIsFullscreen(false)} />
      )}
    </>
  );
};

/* ═══════════════════════════════════════════════════════
 *  FullscreenViewer – isolated zoom / pan component
 * ═══════════════════════════════════════════════════════ */

interface FullscreenViewerProps {
  svg: string;
  onClose: () => void;
}

const FullscreenViewer: React.FC<FullscreenViewerProps> = ({ svg, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });
  const fitScaleRef = useRef(1);

  /* ── Compute scale to fit entire chart in viewport ── */
  const computeFitScale = useCallback(() => {
    const inner = innerRef.current;
    const container = containerRef.current;
    if (!inner || !container) return 1;
    const svgEl = inner.querySelector('svg');
    if (!svgEl) return 1;

    let naturalW = 0, naturalH = 0;
    const viewBox = svgEl.getAttribute('viewBox');
    if (viewBox) {
      const p = viewBox.split(/[\s,]+/).map(Number);
      if (p.length === 4) { naturalW = p[2]; naturalH = p[3]; }
    }
    if (!naturalW || !naturalH) {
      naturalW = parseFloat(svgEl.getAttribute('width') || '0');
      naturalH = parseFloat(svgEl.getAttribute('height') || '0');
    }
    if (!naturalW || !naturalH) {
      const r = svgEl.getBoundingClientRect();
      naturalW = r.width; naturalH = r.height;
    }
    if (naturalW <= 0 || naturalH <= 0) return 1;

    const pad = 80;
    const cw = container.clientWidth - pad;
    const ch = container.clientHeight - pad;
    if (cw <= 0 || ch <= 0) return 1;
    return Math.min(cw / naturalW, ch / naturalH, 1);
  }, []);

  /* ── Auto-fit on mount ── */
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const fit = computeFitScale();
      fitScaleRef.current = fit;
      setScale(fit);
    });
    return () => cancelAnimationFrame(raf);
  }, [computeFitScale]);

  /* ── Escape key ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  /* ── Wheel zoom ── */
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      const d = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setScale((s) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s + d)));
    };
    c.addEventListener('wheel', h, { passive: false });
    return () => c.removeEventListener('wheel', h);
  }, []);

  /* ── Drag handlers ── */
  const onDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    translateStart.current = { ...translate };
  }, [translate]);

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setTranslate({
      x: translateStart.current.x + (e.clientX - dragStart.current.x),
      y: translateStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, [isDragging]);

  const onUp = useCallback(() => setIsDragging(false), []);

  const resetView = useCallback(() => {
    setScale(fitScaleRef.current);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const pct = Math.round(scale * 100);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-950" style={{ animation: 'mermaidFadeIn .2s ease-out' }}>
      {/* toolbar */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 px-5 py-2.5 bg-white dark:bg-slate-950 shrink-0">
        <div className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">结构化流程图</span>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[10px] text-slate-400 mr-2 hidden sm:inline select-none">滚轮缩放 · 拖拽平移 · 双击重置</span>
          <span className="text-[10px] font-mono font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-1.5 py-0.5 rounded min-w-[40px] text-center select-none">{pct}%</span>
          <button onClick={() => setScale((s) => Math.max(MIN_ZOOM, s - ZOOM_STEP))} disabled={scale <= MIN_ZOOM} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30 transition-colors" title="缩小"><ZoomOut className="h-3.5 w-3.5" /></button>
          <button onClick={() => setScale((s) => Math.min(MAX_ZOOM, s + ZOOM_STEP))} disabled={scale >= MAX_ZOOM} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30 transition-colors" title="放大"><ZoomIn className="h-3.5 w-3.5" /></button>
          <button onClick={resetView} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors" title="重置视图"><RotateCcw className="h-3.5 w-3.5" /></button>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-red-500 transition-colors" title="退出全屏 (Esc)"><Minimize2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* zoomable canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative select-none flex items-center justify-center"
        style={{ cursor: isDragging ? 'grabbing' : 'grab', overflow: 'hidden' }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onDoubleClick={resetView}
      >
        <div
          ref={innerRef}
          className="mermaid-container flex-shrink-0"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform .15s ease-out',
            padding: 40,
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      <style>{`@keyframes mermaidFadeIn { from { opacity:0 } to { opacity:1 } }`}</style>
    </div>
  );
};

export default Mermaid;
