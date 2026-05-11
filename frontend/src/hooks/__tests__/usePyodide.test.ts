import { describe, expect, it } from "vitest"

import { buildSandboxScript, MATPLOTLIB_HOOK_SCRIPT } from "@/hooks/usePyodide"

describe("usePyodide matplotlib auto capture", () => {
  it("captures pending matplotlib figures before restoring stdout", () => {
    const script = buildSandboxScript("cHJpbnQoJ29rJyk=")
    const autoCaptureIndex = script.indexOf("if _plt_auto.get_fignums():")
    const restoreIndex = script.indexOf("__sys.stdout, __sys.stderr = __old_out, __old_err")

    expect(autoCaptureIndex).toBeGreaterThan(-1)
    expect(restoreIndex).toBeGreaterThan(-1)
    expect(autoCaptureIndex).toBeLessThan(restoreIndex)
  })

  it("suppresses matplotlib glyph warnings inside the sandbox script", () => {
    const script = buildSandboxScript("cHJpbnQoJ29rJyk=")

    expect(script).toContain('_warnings.filterwarnings("ignore"')
    expect(script).toContain('Glyph .* missing from current font\\.')
  })

  it("configures matplotlib CJK font fallbacks in the frontend hook", () => {
    expect(MATPLOTLIB_HOOK_SCRIPT).toContain('font_manager')
    expect(MATPLOTLIB_HOOK_SCRIPT).toContain('Noto Sans CJK SC')
    expect(MATPLOTLIB_HOOK_SCRIPT).toContain('axes.unicode_minus')
  })
})
