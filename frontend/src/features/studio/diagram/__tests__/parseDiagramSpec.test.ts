import { describe, expect, it } from "vitest"

import { extractDiagramSpecBlocks, parseDiagramSpec } from "@/features/studio/diagram/parseDiagramSpec"

describe("parseDiagramSpec", () => {
  it("parses valid diagram-spec blocks and strips them from markdown", () => {
    const markdown = `
## 二、核心知识点
核心内容说明。
\`\`\`diagram-spec
{"diagram_type":"flow","title":"二分查找流程","section_key":"二、核心知识点","payload":{"nodes":["初始化","比较中位数","收缩区间"]}}
\`\`\`
`

    const result = parseDiagramSpec(markdown)

    expect(result.specs).toHaveLength(1)
    expect(result.specs[0].diagram_type).toBe("flow")
    expect(result.specs[0].title).toBe("二分查找流程")
    expect(result.content).toContain("## 二、核心知识点")
    expect(result.content).not.toContain("diagram-spec")
  })

  it("ignores invalid schema blocks", () => {
    const markdown = `
## 练习
\`\`\`diagram-spec
{"diagram_type":"unsupported","title":"坏数据","payload":[]}
\`\`\`
\`\`\`diagram-spec
{not-json}
\`\`\`
`

    const result = parseDiagramSpec(markdown)

    expect(result.specs).toHaveLength(0)
    expect(result.content).toContain("## 练习")
  })

  it("extracts raw diagram-spec blocks for incremental merge", () => {
    const markdown = `
## 二、核心知识点
\`\`\`diagram-spec
{"diagram_type":"flow","title":"流程图","section_key":"核心知识点","payload":{"nodes":["A","B"]}}
\`\`\`
`

    const blocks = extractDiagramSpecBlocks(markdown)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toContain("diagram-spec")
    expect(blocks[0]).toContain("\"diagram_type\":\"flow\"")
  })
})
