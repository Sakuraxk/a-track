import { loadCSS, loadJS } from "markmap-common"
import { Transformer } from "markmap-lib"
import * as markmap from "markmap-view"

// Import KaTeX locally instead of relying on CDN (which may be blocked in China).
import katex from "katex"
import "katex/dist/katex.min.css"

// Expose katex globally so markmap-view can pick it up for math rendering.
;(window as any).katex = katex

export const transformer = new Transformer()

const { scripts, styles } = transformer.getAssets()
// Only load non-KaTeX assets from CDN; KaTeX is already loaded above.
if (styles) {
  const filteredStyles = styles.filter(
    (s: any) => !(typeof s === "object" && s?.data?.href?.includes("katex")),
  )
  if (filteredStyles.length > 0) loadCSS(filteredStyles)
}
if (scripts) {
  const filteredScripts = scripts.filter(
    (s: any) => !(typeof s === "object" && s?.data?.src?.includes("katex")),
  )
  if (filteredScripts.length > 0) loadJS(filteredScripts, { getMarkmap: () => markmap })
}
