import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import QuestionBank from "../QuestionBank"

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}))

vi.mock("@/stores/auth", () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      profile: { user_id: "test-user-id" },
    })
  ),
}))

vi.mock("@/stores/subject", () => ({
  useSubjectStore: vi.fn((selector) =>
    selector({
      currentSubjectId: "subject-1",
      subjects: [{ id: "subject-1", key: "python", name: "Python" }],
      getCurrentSubject: () => ({ id: "subject-1", key: "python", name: "Python" }),
    })
  ),
}))

vi.mock("@/stores/learning-path", () => ({
  useLearningPathStore: vi.fn((selector) =>
    selector({
      updateTaskCompletion: vi.fn(),
    })
  ),
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: mockApiGet,
    post: mockApiPost,
    put: vi.fn(),
    delete: vi.fn(),
  },
  getApiErrorMessage: vi.fn((error) => error.message || "error"),
}))

vi.mock("@/features/practice", () => ({
  QuestionGroupCard: () => null,
  PracticeSession: ({ onComplete }: { onComplete: (result: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onComplete({
          totalQuestions: 1,
          correctCount: 1,
          wrongCount: 0,
          answers: [{ questionId: "q-1", isCorrect: true, response: "B" }],
        })
      }
    >
      完成练习
    </button>
  ),
  SessionSummary: ({
    backLabel,
    onBackToDashboard,
  }: {
    backLabel?: string
    onBackToDashboard: () => void
  }) => (
    <div>
      <span>{backLabel}</span>
      <button type="button" onClick={onBackToDashboard}>
        {backLabel}
      </button>
    </div>
  ),
}))

describe("QuestionBank summary return", () => {
  it("uses 返回文档 and navigates back to the concept page when practice came from the concept document", async () => {
    mockApiPost.mockResolvedValue({
      data: {
        success: true,
        xp_gained: 0,
        leveled_up: false,
        new_badges: [],
      },
    })
    mockApiGet
      .mockResolvedValueOnce({
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
              progress: {
                attempts_count: 0,
                correct_count: 0,
                wrong_count: 0,
                accuracy_rate: 0,
                completed_count: 0,
                total_count: 1,
                last_practiced_at: null,
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          items: [
            {
              id: "q-1",
              question_type: "mcq",
              stem: "bool 类型只有哪两个取值？",
              options: [{ label: "B", text: "True 和 False", is_correct: true }],
              answer_key: "B",
              difficulty: 1,
            },
          ],
        },
      })

    const user = userEvent.setup()

    render(
      <MemoryRouter
        initialEntries={[
          "/app/question-bank?from=learning-path&entrySource=concept-learning&taskTitle=%E5%8F%98%E9%87%8F%E4%B8%8E%E7%B1%BB%E5%9E%8B&taskId=task-001&pathId=path-1&version=2&chapterId=day-1&chapterTitle=%E5%8F%98%E9%87%8F%E4%B8%8E%E7%B1%BB%E5%9E%8B&subjectKey=python&groupId=group-concept-1&returnTo=%2Fapp%2Fconcept-learning%2Ftask-001%3FpathId%3Dpath-1%26day%3D1",
        ]}
      >
        <Routes>
          <Route path="/app/question-bank" element={<QuestionBank />} />
          <Route path="/app/concept-learning/:taskId" element={<div>ConceptDocMock</div>} />
        </Routes>
      </MemoryRouter>
    )

    await user.click(await screen.findByRole("button", { name: "完成练习" }))

    expect(await screen.findByRole("button", { name: "返回文档" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "返回文档" }))

    expect(await screen.findByText("ConceptDocMock")).toBeInTheDocument()
  })
})
