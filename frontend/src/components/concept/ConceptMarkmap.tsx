import { useEffect, useMemo, useRef, useCallback } from "react"

import { Markmap } from "markmap-view"
import { transformer } from "./markmap-assets"

/**
 * Check whether an SVG element has non-zero rendered dimensions.
 * If the element hasn't been laid-out yet (inside an article whose flexbox
 * hasn't settled), `getBoundingClientRect()` can return 0.
 */
function hasValidDimensions(el: SVGSVGElement): boolean {
  const { height, width } = el.getBoundingClientRect()
  return width > 0 && height > 0
}

function syncNumericSvgDimensions(el: SVGSVGElement): boolean {
  const { height, width } = el.getBoundingClientRect()
  if (width <= 0 || height <= 0) {
    return false
  }

  el.setAttribute("width", String(Math.round(width)))
  el.setAttribute("height", String(Math.round(height)))
  return true
}

export default function ConceptMarkmap({
  markdown,
  heightClass = "h-[360px]",
}: {
  markdown: string
  heightClass?: string
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const markmapRef = useRef<Markmap | null>(null)
  /** Width at which the current Markmap instance was created. */
  const createdAtWidthRef = useRef<number>(0)
  const normalizedMarkdown = useMemo(() => markdown.trim(), [markdown])

  /**
   * (Re-)create the Markmap instance on the SVG and push data into it.
   * If a previous instance exists it will be destroyed first so internal
   * layout state is never stale.
   */
  const renderMarkmap = useCallback(
    (svgEl: SVGSVGElement, md: string) => {
      try {
        if (!syncNumericSvgDimensions(svgEl)) return

        const { root } = transformer.transform(md)

        // Destroy previous instance – this is cheap and guarantees a clean slate
        // for the new container dimensions.
        if (markmapRef.current) {
          markmapRef.current.destroy()
          markmapRef.current = null
        }

        // Clear any leftover SVG children from the previous instance.
        while (svgEl.firstChild) {
          svgEl.removeChild(svgEl.firstChild)
        }

        const mm = Markmap.create(svgEl, {
          autoFit: true,
          duration: 500,
          fitRatio: 0.9,
          maxWidth: 480,
          initialExpandLevel: 3,
          embedGlobalCSS: true,
        })

        markmapRef.current = mm
        createdAtWidthRef.current = svgEl.getBoundingClientRect().width

        void mm.setData(root).then(() => {
          void mm.fit()
        })
      } catch {
        // SVGLength / d3-zoom errors can occur when the SVG hasn't been
        // fully laid out yet. Silently ignore – the ResizeObserver or
        // IntersectionObserver will retry when dimensions become valid.
      }
    },
    [],
  )

  // ----- Markmap lifecycle -----
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || !normalizedMarkdown) return

    // If the SVG already has valid dimensions, render immediately.
    if (hasValidDimensions(svgEl)) {
      renderMarkmap(svgEl, normalizedMarkdown)
      return
    }

    // Otherwise, the container is not yet laid-out (common for the inline
    // preview inside <article class="prose …">).  Use a short polling loop
    // to wait until it is ready.
    let cancelled = false
    let rafId: number | undefined
    let attempt = 0
    const maxAttempts = 30 // ~30 × 50ms = 1.5s max

    const poll = () => {
      if (cancelled) return
      attempt++
      if (hasValidDimensions(svgEl)) {
        renderMarkmap(svgEl, normalizedMarkdown)
        return
      }
      if (attempt < maxAttempts) {
        rafId = requestAnimationFrame(() => {
          setTimeout(() => poll(), 50)
        })
      }
    }
    poll()

    return () => {
      cancelled = true
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [normalizedMarkdown, renderMarkmap])

  // ----- ResizeObserver – re-create when container dimensions change -----
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    const observer = new ResizeObserver(() => {
      if (!normalizedMarkdown) return

      const currentWidth = svgEl.getBoundingClientRect().width
      if (currentWidth <= 0) return
      syncNumericSvgDimensions(svgEl)

      // If the instance was created at a very different width (including 0),
      // destroy and recreate it so Markmap's internal layout is correct.
      const delta = Math.abs(currentWidth - createdAtWidthRef.current)
      if (!markmapRef.current || delta > 20) {
        renderMarkmap(svgEl, normalizedMarkdown)
      } else {
        void markmapRef.current?.fit()
      }
    })
    observer.observe(svgEl)

    return () => {
      observer.disconnect()
    }
  }, [normalizedMarkdown, renderMarkmap])

  // ----- IntersectionObserver – re-fit / recreate when scrolled into view -----
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && normalizedMarkdown) {
            syncNumericSvgDimensions(svgEl)

            if (!markmapRef.current && hasValidDimensions(svgEl)) {
              renderMarkmap(svgEl, normalizedMarkdown)
            } else {
              void markmapRef.current?.fit()
            }
          }
        }
      },
      { threshold: 0.1 },
    )
    io.observe(svgEl)

    return () => {
      io.disconnect()
    }
  }, [normalizedMarkdown, renderMarkmap])

  // ----- Cleanup on unmount -----
  useEffect(() => {
    return () => {
      markmapRef.current?.destroy()
      markmapRef.current = null
    }
  }, [])

  if (!normalizedMarkdown) {
    return null
  }

  return (
    <div className="min-h-[360px] overflow-hidden rounded-2xl border border-white/40 bg-white/55 p-2 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-2xl">
      <svg ref={svgRef} className={`${heightClass} w-full`} />
    </div>
  )
}
