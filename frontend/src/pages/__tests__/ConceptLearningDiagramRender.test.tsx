import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import ConceptLearning from "@/pages/ConceptLearning"
import { LEARNING_STUDIO_FLAGS_STORAGE_KEY } from "@/features/studio/config/learningStudioFlags"
import { api } from "@/lib/api"
import { generateConceptExercises, getCachedContent, streamConceptContent } from "@/lib/streamConceptContent"

vi.mock("@ant-design/x-markdown", () => ({
  XMarkdown: ({
    content,
    components = {},
  }: {
    content: string
    components?: Record<string, React.ComponentType<{ children?: React.ReactNode }>>
  }) => {
    const H2 = components.h2 ?? ((props: { children?: React.ReactNode }) => <h2 {...props} />)
    const H3 = components.h3 ?? ((props: { children?: React.ReactNode }) => <h3 {...props} />)
    const Paragraph = components.p ?? ((props: { children?: React.ReactNode }) => <p {...props} />)

    return (
      <div className="x-markdown">
        {content.split("\n").map((line, index) => {
          const normalizedLine = line.trimStart()
          if (normalizedLine.startsWith("### ")) {
            return <H3 key={index}>{normalizedLine.replace(/^###\s*/, "")}</H3>
          }
          if (normalizedLine.startsWith("## ")) {
            return <H2 key={index}>{normalizedLine.replace(/^##\s*/, "")}</H2>
          }
          if (!normalizedLine.trim()) {
            return null
          }
          return <Paragraph key={index}>{normalizedLine}</Paragraph>
        })}
      </div>
    )
  },
  useStreaming: (content: string) => content,
}))

vi.mock("@/stores/auth", () => ({
  useAuthStore: (selector: (state: { profile: { user_id: string; ability_tags: Record<string, number> } }) => unknown) =>
    selector({
      profile: { user_id: "user-1", ability_tags: { python: 0.8 } },
    }),
}))

vi.mock("@/stores/learning-path", () => ({
  useLearningPathStore: (selector: (state: { updateTaskCompletion: (...args: unknown[]) => void }) => unknown) =>
    selector({ updateTaskCompletion: vi.fn() }),
}))

vi.mock("@/components/concept/ConceptMarkmap", () => ({
  default: ({ markdown }: { markdown: string }) => <div data-testid="concept-markmap">{markdown}</div>,
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock("@/lib/streamConceptContent", () => ({
  streamConceptContent: vi.fn(),
  generateConceptExercises: vi.fn(async () => ({
    success: true,
    exercises_count: 3,
    group_id: "group-concept-1",
    raw_content: JSON.stringify({
      exercises: [
        {
          type: "mcq",
          title: "变量命名与赋值",
          description: "以下哪段代码会引发错误？请选择会导致语法错误或运行时错误的选项。",
          answer_key: "B",
          options: [
            { label: "A", text: "name = 'Alice'" },
            { label: "B", text: "1name = 'Alice'" },
            { label: "C", text: "user_age = 18" },
            { label: "D", text: "score = 95" },
          ],
        },
      ],
    }),
  })),
  getCachedContent: vi.fn(async () => ({
    exists: true,
    markmap_markdown: "# 二分查找基础\n## 一、背景说明\n## 二、核心知识点",
    concept_map: { root: "二分查找基础", nodes: [], edges: [], chapter_order: [] },
    content: `
## 一、背景说明
背景段落。
\`\`\`diagram-spec
{"diagram_type":"flow","title":"背景流程","section_key":"一、背景说明","payload":{"nodes":["背景A","背景B"]}}
\`\`\`

## 二、核心知识点
这是关键章节内容。
\`\`\`diagram-spec
{"diagram_type":"compare","title":"核心概念对比","section_key":"核心知识点","payload":{"left_title":"线性查找","right_title":"二分查找","left_items":["O(n)"],"right_items":["O(log n)"]}}
\`\`\`
`,
    reasoning: "",
  })),
  deleteConceptContent: vi.fn(),
}))

const mockGetCachedContent = vi.mocked(getCachedContent)
const mockStreamConceptContent = vi.mocked(streamConceptContent)
const mockGenerateConceptExercises = vi.mocked(generateConceptExercises)
const mockApiGet = vi.mocked(api.get)

const mockLearningPath = {
  id: "path-1",
  user_id: "user-1",
  goal: "掌握 Python",
  total_days: 2,
  daily_minutes: 20,
  created_at: "2026-03-16T00:00:00Z",
  progress_percent: 0,
  current_day: 1,
  version: 2,
  version_name: "学习计划 v2",
  days: [
    {
      day: 1,
      date: "2026-03-16",
      theme: "变量与类型",
      total_minutes: 20,
      tasks: [
        {
          id: "task-001",
          title: "变量与类型",
          description: "学习变量与类型",
          type: "concept",
          duration_minutes: 20,
          resources: [],
          completed: false,
        },
      ],
    },
    {
      day: 2,
      date: "2026-03-17",
      theme: "复杂度分析",
      total_minutes: 20,
      tasks: [
        {
          id: "task-002",
          title: "复杂度分析",
          description: "学习复杂度分析",
          type: "concept",
          duration_minutes: 20,
          resources: [],
          completed: false,
        },
      ],
    },
  ],
}

describe("ConceptLearning Diagram 渲染", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockApiGet.mockImplementation(async (url) => {
      if (url === "/api/ai-learning-path/path-1") {
        return { data: mockLearningPath } as never
      }

      if (url === "/api/question-bank/groups") {
        return {
          data: {
            success: true,
            groups: [],
          },
        } as never
      }

      throw new Error(`Unexpected api.get call: ${String(url)}`)
    })
    mockGetCachedContent.mockResolvedValue({
      exists: true,
      markmap_markdown: "# 二分查找基础\n## 一、背景说明\n## 二、核心知识点",
      concept_map: { root: "二分查找基础", nodes: [], edges: [], chapter_order: [] },
      content: `
## 一、背景说明
背景段落。
\`\`\`diagram-spec
{"diagram_type":"flow","title":"背景流程","section_key":"一、背景说明","payload":{"nodes":["背景A","背景B"]}}
\`\`\`

## 二、核心知识点
这是关键章节内容。
\`\`\`diagram-spec
{"diagram_type":"compare","title":"核心概念对比","section_key":"核心知识点","payload":{"left_title":"线性查找","right_title":"二分查找","left_items":["O(n)"],"right_items":["O(log n)"]}}
\`\`\`
`,
      reasoning: "",
    })
  })

  it("disables auto diagram rendering when flag is off", async () => {
    localStorage.setItem(LEARNING_STUDIO_FLAGS_STORAGE_KEY, JSON.stringify({ conceptAutoDiagram: false }))

    render(
      <MemoryRouter initialEntries={["/app/concept-learning/task-001?title=二分查找基础&subject=Python"]}>
        <Routes>
          <Route path="/app/concept-learning/:taskId" element={<ConceptLearning />} />
        </Routes>
      </MemoryRouter>
    )

    await screen.findByText(/核心知识点/)
    expect(screen.queryByTestId("diagram-card-compare")).not.toBeInTheDocument()
    expect(screen.queryByTestId("diagram-card-flow")).not.toBeInTheDocument()
  })

  it("suppresses non-core cached diagrams by default", async () => {
    localStorage.removeItem(LEARNING_STUDIO_FLAGS_STORAGE_KEY)
    mockGetCachedContent.mockResolvedValueOnce({
      exists: true,
      markmap_markdown: "# 二分查找基础\n## 核心知识点",
      concept_map: { root: "二分查找基础", nodes: [], edges: [], chapter_order: [] },
      content: `
## 核心知识点
这是关键章节内容。
\`\`\`diagram-spec
{"diagram_type":"compare","title":"核心概念对比","section_key":"核心知识点","payload":{"left_title":"线性查找","right_title":"二分查找","left_items":["O(n)"],"right_items":["O(log n)"]}}
\`\`\`
`,
      reasoning: "",
    })

    render(
      <MemoryRouter initialEntries={["/app/concept-learning/task-001?title=二分查找基础&subject=Python"]}>
        <Routes>
          <Route path="/app/concept-learning/:taskId" element={<ConceptLearning />} />
        </Routes>
      </MemoryRouter>
    )

    await screen.findByText(/核心知识点/)
    expect(screen.queryByTestId("diagram-card-flow")).not.toBeInTheDocument()
  })

  it("renders the markmap overview before article content", async () => {
    render(
      <MemoryRouter initialEntries={["/app/concept-learning/task-001?title=二分查找基础&subject=Python"]}>
        <Routes>
          <Route path="/app/concept-learning/:taskId" element={<ConceptLearning />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByTestId("concept-markmap")).toHaveTextContent("二分查找基础")
    expect(screen.getByTestId("concept-markmap-shell")).toBeInTheDocument()
    const article = screen.getByTestId("concept-article")
    expect(article).toHaveClass("mx-auto")
    expect(article.className).toContain("max-w-[980px]")
  })




  it("renders in-page exercise preview and switches CTA after generation", async () => {
    const user = userEvent.setup()
    mockGenerateConceptExercises.mockResolvedValueOnce({
      success: true,
      exercises_count: 3,
      group_id: "group-concept-1",
      raw_content: JSON.stringify({
        exercises: [
          {
            type: "mcq",
            title: "变量命名与赋值",
            description: "以下哪段代码会引发错误？请选择会导致语法错误或运行时错误的选项。",
            answer_key: "B",
            options: [
              { label: "A", text: "name = 'Alice'" },
              { label: "B", text: "1name = 'Alice'" },
              { label: "C", text: "user_age = 18" },
              { label: "D", text: "score = 95" },
            ],
          },
        ],
      }),
    })

    render(
      <MemoryRouter initialEntries={["/app/concept-learning/task-001?title=二分查找基础&subject=Python"]}>
        <Routes>
          <Route path="/app/concept-learning/:taskId" element={<ConceptLearning />} />
        </Routes>
      </MemoryRouter>
    )

    await user.click(await screen.findByRole("button", { name: "点我生成习题" }))

    expect(mockGenerateConceptExercises).toHaveBeenCalledTimes(1)
    expect(await screen.findByText("变量命名与赋值")).toBeInTheDocument()
    expect(screen.getByText("以下哪段代码会引发错误？请选择会导致语法错误或运行时错误的选项。")).toBeInTheDocument()
    expect(screen.getByText("A. name = 'Alice'")).toBeInTheDocument()
    expect(screen.getByText("B. 1name = 'Alice'")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "点我生成习题" })).not.toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "生成一组新的题目" })).toBeInTheDocument()
  })

  it("restores persisted preview after refresh and links directly to practice", async () => {
    const user = userEvent.setup()
    mockGenerateConceptExercises.mockResolvedValueOnce({
      success: true,
      exercises_count: 1,
      group_id: "group-concept-1",
      raw_content: JSON.stringify({
        exercises: [
          {
            type: "mcq",
            title: "布尔值判断",
            description: "Python 中 bool 类型只有哪两个取值？",
            answer_key: "B",
            options: [
              { label: "A", text: "0 和 1" },
              { label: "B", text: "True 和 False" },
            ],
          },
        ],
      }),
    })
    mockApiGet.mockImplementation(async (url) => {
      if (url === "/api/ai-learning-path/path-1") {
        return { data: mockLearningPath } as never
      }

      if (url === "/api/question-bank/groups") {
        return {
          data: {
            success: true,
            groups: [
              {
                id: "group-concept-1",
                title: "布尔值判断",
                source_type: "concept_learning",
                source_task_id: "task-001",
                learning_path_id: "path-1",
                learning_path_version: 2,
                source_day: 1,
                source_chapter_id: "day-1",
                source_chapter_title: "变量与类型",
                item_count: 1,
              },
            ],
          },
        } as never
      }

      if (url === "/api/question-bank/groups/group-concept-1/items") {
        return {
          data: {
            success: true,
            items: [
              {
                id: "q-refresh-1",
                question_type: "mcq",
                stem: "布尔值判断",
                options: [
                  { label: "A", text: "0 和 1" },
                  { label: "B", text: "True 和 False" },
                ],
                difficulty: 1,
              },
            ],
          },
        } as never
      }

      throw new Error(`Unexpected api.get call: ${String(url)}`)
    })

    const view = render(
      <MemoryRouter
        initialEntries={[
          "/app/concept-learning/task-001?title=变量与类型&subject=Python&pathId=path-1&version=2&versionName=学习计划%20v2&chapterId=day-1&chapterTitle=变量与类型&day=1&subjectKey=python",
        ]}
      >
        <Routes>
          <Route path="/app/concept-learning/:taskId" element={<ConceptLearning />} />
          <Route path="/app/question-bank" element={<div>QuestionBankMock</div>} />
        </Routes>
      </MemoryRouter>
    )

    await user.click(await screen.findByRole("button", { name: "点我生成习题" }))

    expect(await screen.findByText("布尔值判断")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "去做这组题" })).toBeInTheDocument()

    view.unmount()

    render(
      <MemoryRouter
        initialEntries={[
          "/app/concept-learning/task-001?title=变量与类型&subject=Python&pathId=path-1&version=2&versionName=学习计划%20v2&chapterId=day-1&chapterTitle=变量与类型&day=1&subjectKey=python",
        ]}
      >
        <Routes>
          <Route path="/app/concept-learning/:taskId" element={<ConceptLearning />} />
          <Route path="/app/question-bank" element={<div>QuestionBankMock</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText("布尔值判断")).toBeInTheDocument()

    await user.click(await screen.findByRole("button", { name: "去做这组题" }))

    expect(await screen.findByText("QuestionBankMock")).toBeInTheDocument()
  })

  it("prefers canonical exercises returned by backend for preview content", async () => {
    const user = userEvent.setup()
    mockGenerateConceptExercises.mockResolvedValueOnce({
      success: true,
      exercises_count: 3,
      group_id: "group-concept-2",
      raw_content: JSON.stringify({
        exercises: [
          {
            type: "mcq",
            title: "旧的单题",
            description: "这是一条过时的 raw_content 预览",
            answer_key: "A",
            options: [{ label: "A", text: "过时选项" }],
          },
        ],
      }),
      exercises: [
        {
          type: "mcq",
          title: "变量命名与赋值",
          description: "以下哪段 Python 代码中的变量命名和赋值操作是正确且符合规范的？",
          answer_key: "C",
          options: [
            { label: "A", text: '1st_place = "gold"' },
            { label: "B", text: "my-variable = 100" },
            { label: "C", text: "_score = 95.5" },
            { label: "D", text: 'class = "Python101"' },
          ],
        },
        {
          type: "short_answer",
          title: "数据类型识别与打印",
          description: "创建变量并打印其值与类型。",
          answer_key: "略",
          options: [],
        },
        {
          type: "mcq",
          title: "布尔值判断",
          description: "Python 中 bool 类型只有哪两个取值？",
          answer_key: "B",
          options: [
            { label: "A", text: "0 和 1" },
            { label: "B", text: "True 和 False" },
          ],
        },
      ],
    } as never)

    render(
      <MemoryRouter initialEntries={["/app/concept-learning/task-001?title=二分查找基础&subject=Python"]}>
        <Routes>
          <Route path="/app/concept-learning/:taskId" element={<ConceptLearning />} />
        </Routes>
      </MemoryRouter>
    )

    await user.click(await screen.findByRole("button", { name: "点我生成习题" }))

    expect(await screen.findByText("本组共生成 3 道题")).toBeInTheDocument()
    expect(screen.getByText("变量命名与赋值")).toBeInTheDocument()
    expect(screen.getByText("数据类型识别与打印")).toBeInTheDocument()
    expect(screen.getByText("布尔值判断")).toBeInTheDocument()
    expect(screen.queryByText("旧的单题")).not.toBeInTheDocument()
  })

  it("renders learning-path chapter navigation and loads the live preview for the current chapter", async () => {
    mockApiGet.mockImplementation(async (url) => {
      if (url === "/api/ai-learning-path/path-1") {
        return { data: mockLearningPath } as never
      }

      if (url === "/api/question-bank/groups") {
        return {
          data: {
            success: true,
            groups: [
              {
                id: "group-live-1",
                title: "变量与类型练习",
                source_type: "concept_learning",
                source_task_id: "task-001",
                learning_path_id: "path-1",
                learning_path_version: 2,
                source_day: 1,
                source_chapter_id: "day-1",
                source_chapter_title: "变量与类型",
                item_count: 1,
              },
            ],
          },
        } as never
      }

      if (url === "/api/question-bank/groups/group-live-1/items") {
        return {
          data: {
            success: true,
            items: [
              {
                id: "q-live-1",
                question_type: "mcq",
                stem: "变量名 `user_name` 是否符合规范？",
                options: [
                  { label: "A", text: "符合规范" },
                  { label: "B", text: "不符合规范" },
                ],
                difficulty: 1,
              },
            ],
          },
        } as never
      }

      throw new Error(`Unexpected api.get call: ${String(url)}`)
    })

    render(
      <MemoryRouter
        initialEntries={[
          "/app/concept-learning/task-001?title=变量与类型&subject=Python&pathId=path-1&version=2&versionName=学习计划%20v2&chapterId=day-1&chapterTitle=变量与类型&day=1&subjectKey=python",
        ]}
      >
        <Routes>
          <Route path="/app/concept-learning/:taskId" element={<ConceptLearning />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText("第1天 变量与类型")).toBeInTheDocument()
    expect(screen.getByText("第2天 复杂度分析")).toBeInTheDocument()
    expect(await screen.findByText("变量名 `user_name` 是否符合规范？")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "去做这组题" })).toBeInTheDocument()
  })

  it("clears a persisted preview when the live question group has been deleted", async () => {
    localStorage.setItem(
      "concept-learning-exercise-preview:task-001:path-1:v2:day-1",
      JSON.stringify({
        groups: [
          {
            id: "group-deleted-1",
            count: 1,
            target:
              "/app/question-bank?from=learning-path&taskTitle=%E5%8F%98%E9%87%8F%E4%B8%8E%E7%B1%BB%E5%9E%8B&taskId=task-001&pathId=path-1&version=2&chapterId=day-1&chapterTitle=%E5%8F%98%E9%87%8F%E4%B8%8E%E7%B1%BB%E5%9E%8B&subjectKey=python&groupId=group-deleted-1",
            items: [
              {
                index: 1,
                stem: "已经被删除的旧题目",
                options: ["A. 旧选项"],
              },
            ],
          },
        ],
      })
    )

    render(
      <MemoryRouter
        initialEntries={[
          "/app/concept-learning/task-001?title=变量与类型&subject=Python&pathId=path-1&version=2&versionName=学习计划%20v2&chapterId=day-1&chapterTitle=变量与类型&day=1&subjectKey=python",
        ]}
      >
        <Routes>
          <Route path="/app/concept-learning/:taskId" element={<ConceptLearning />} />
        </Routes>
      </MemoryRouter>
    )

    await screen.findByText("第1天 变量与类型")

    expect(screen.queryByText("已经被删除的旧题目")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "点我生成习题" })).toBeInTheDocument()
    expect(localStorage.getItem("concept-learning-exercise-preview:task-001:path-1:v2:day-1")).toBeNull()
  })
})
