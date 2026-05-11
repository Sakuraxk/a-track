/**
 * InlineLatex — renders plain text that may contain inline LaTeX ($...$)
 * fragments.  Uses KaTeX (installed as a transitive dep of
 * @ant-design/x-markdown) to convert the math portions to HTML while
 * leaving non-math text untouched.
 *
 * Usage:
 *   <InlineLatex text="数列极限的 $\varepsilon$-$N$ 定义" />
 */
import React, { useMemo, useState, useEffect } from "react"

type RenderFn = (tex: string, opts?: Record<string, unknown>) => string

let _katexRender: RenderFn | null | undefined // undefined = not yet loaded

const INLINE_LATEX_RE = /\$([^$]+?)\$/g

/**
 * Pattern to detect bare LaTeX commands that are NOT already wrapped in $...$
 * Matches common LaTeX commands like \frac{}{}, \sqrt{}, \infty, \alpha, etc.
 */
const BARE_LATEX_RE = /\\(?:frac|sqrt|sum|prod|int|lim|log|ln|sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|max|min|sup|inf|det|gcd|binom|vec|hat|bar|dot|ddot|tilde|overline|underline|overbrace|underbrace|left|right|begin|end|text|mathrm|mathbf|mathit|mathcal|mathbb|mathfrak)\s*(?:\{[^}]*\}|\[.*?\]|[^a-zA-Z\s])*|\\(?:infty|alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|partial|nabla|forall|exists|nexists|emptyset|varnothing|in|notin|subset|supset|subseteq|supseteq|cup|cap|setminus|cdot|cdots|ldots|vdots|ddots|times|div|pm|mp|leq|geq|neq|approx|equiv|sim|simeq|cong|propto|perp|parallel|angle|triangle|square|circ|bullet|star|dagger|ddagger|ell|hbar|imath|jmath|Re|Im|wp|aleph|beth|to|rightarrow|leftarrow|Rightarrow|Leftarrow|leftrightarrow|Leftrightarrow|mapsto|uparrow|downarrow|nearrow|searrow|nwarrow|swarrow|implies|iff|neg|land|lor|oplus|otimes|bigcup|bigcap|bigoplus|bigotimes|lfloor|rfloor|lceil|rceil|langle|rangle|quad|qquad|,|;|!|:|displaystyle|scriptstyle|limits|nolimits|over|above|atop|choose|brace|brack|pmod|bmod|not)(?![a-zA-Z])/

/**
 * Pre-process text: if it contains bare LaTeX commands not already inside $...$,
 * wrap the entire text (or just the bare commands) in $ delimiters.
 */
function ensureLatexDelimiters(text: string): string {
    // If text already has $ delimiters, assume it's properly formatted
    if (text.includes("$")) return text

    // Check if the text contains bare LaTeX commands
    if (!BARE_LATEX_RE.test(text)) return text

    // If the entire text looks like a single math expression (no significant
    // natural language), wrap the whole thing
    const trimmed = text.trim()
    // Simple heuristic: if the text is short and mostly math-like, wrap entirely
    // Otherwise, try to wrap individual LaTeX segments
    const nonLatexParts = trimmed.split(BARE_LATEX_RE).filter(Boolean)
    const hasSignificantText = nonLatexParts.some(
        (part) => /[\u4e00-\u9fff]{2,}|[a-zA-Z]{4,}/.test(part)
    )

    if (!hasSignificantText) {
        // Wrap the whole thing as a math expression
        return `$${trimmed}$`
    }

    // For mixed content, wrap segments that look like LaTeX
    return trimmed.replace(
        // Match sequences that contain LaTeX commands and their arguments
        /((?:\\[a-zA-Z]+(?:\{[^}]*\})*(?:\s*[_^]\s*(?:\{[^}]*\}|[a-zA-Z0-9]))*\s*)+)/g,
        (match) => `$${match.trim()}$`
    )
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}

function renderTextWithLatex(text: string, renderToString: RenderFn): string {
    const parts: string[] = []
    let lastIndex = 0

    for (const match of text.matchAll(INLINE_LATEX_RE)) {
        // Add text before this match (HTML-escaped)
        if (match.index! > lastIndex) {
            parts.push(escapeHtml(text.slice(lastIndex, match.index!)))
        }
        // Render the LaTeX
        try {
            parts.push(
                renderToString(match[1].trim(), {
                    throwOnError: false,
                    displayMode: false,
                    output: "html",
                })
            )
        } catch {
            parts.push(escapeHtml(match[0]))
        }
        lastIndex = match.index! + match[0].length
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(escapeHtml(text.slice(lastIndex)))
    }

    return parts.join("")
}

// Lazy-load KaTeX once
const katexLoadPromise: Promise<RenderFn | null> = (async () => {
    try {
        const mod = await import("katex")
        await import("katex/dist/katex.min.css")
        const fn = mod.default?.renderToString ?? mod.renderToString ?? null
        _katexRender = fn
        return fn
    } catch {
        _katexRender = null
        return null
    }
})()

function useKatex(): RenderFn | null {
    const [render, setRender] = useState<RenderFn | null>(
        () => (_katexRender === undefined ? null : _katexRender)
    )

    useEffect(() => {
        if (_katexRender !== undefined) {
            setRender(() => _katexRender ?? null)
            return
        }
        let cancelled = false
        katexLoadPromise.then((fn) => {
            if (!cancelled) setRender(() => fn)
        })
        return () => { cancelled = true }
    }, [])

    return render
}

interface InlineLatexProps {
    text: string
    className?: string
}

const InlineLatex: React.FC<InlineLatexProps> = ({ text, className }) => {
    const renderFn = useKatex()
    // Pre-process: auto-wrap bare LaTeX commands with $ delimiters
    const processedText = useMemo(() => ensureLatexDelimiters(text), [text])
    const hasLatex = processedText.includes("$")

    const html = useMemo(() => {
        if (!hasLatex || !renderFn) return ""
        return renderTextWithLatex(processedText, renderFn)
    }, [processedText, hasLatex, renderFn])

    if (!hasLatex || !renderFn) {
        return <span className={className}>{text}</span>
    }

    return (
        <span
            className={className}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    )
}

export default InlineLatex
