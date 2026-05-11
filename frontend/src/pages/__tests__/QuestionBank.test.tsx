import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import QuestionBank from '../QuestionBank'

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}))

// Mock the auth store
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      profile: { user_id: 'test-user-id' },
    }
    return selector(state)
  }),
}))

// Mock the subject store
vi.mock('@/stores/subject', () => ({
  useSubjectStore: vi.fn((selector) => {
    const subject = {
      id: 'test-subject-id',
      name: 'Python',
      key: 'python',
      icon: '🐍',
      onboarding_status: 'completed',
    }
    const state = {
      currentSubjectId: 'test-subject-id',
      subjects: [subject],
      getCurrentSubject: () => subject,
    }
    return selector(state)
  }),
}))

// Mock the API
vi.mock('@/lib/api', () => ({
  api: {
    get: mockApiGet,
    post: mockApiPost,
    delete: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
  getApiErrorMessage: vi.fn((err) => err.message || 'Error'),
}))

const renderQuestionBank = (initialEntry = '/app/question-bank') => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QuestionBank />
    </MemoryRouter>
  )
}

describe('QuestionBank Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
    mockApiGet.mockResolvedValue({
      data: {
        success: true,
        groups: [],
      },
    })
    mockApiPost.mockResolvedValue({
      data: {
        success: true,
        questions: [
          {
            id: 'q1',
            question_type: 'mcq',
            stem: 'Test question?',
            options: [
              { label: 'A', text: 'Option A', is_correct: false },
              { label: 'B', text: 'Option B', is_correct: true },
            ],
            answer_key: 'B',
            difficulty: 2,
            source_annotation: 'Python',
          },
        ],
        source: 'template',
      },
    })
  })

  it('renders question bank page with title', async () => {
    renderQuestionBank()
    await waitFor(() => {
      expect(screen.getByText(/智能题库/i)).toBeInTheDocument()
    })
  })

  it('renders search input', async () => {
    renderQuestionBank()
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/搜索章节或题组标题/i)).toBeInTheDocument()
    })
  })

  it('renders source filter options', async () => {
    renderQuestionBank()
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /全部来源/i })).toBeInTheDocument()
    })
  })

  it('groups learning-path question groups by version and chapter source', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: {
        success: true,
        groups: [
          {
            id: 'group-v2-day1',
            title: '理解事件循环',
            description: '学习 asyncio 的基本执行模型',
            source_type: 'concept_learning',
            source_task_id: 'task-1',
            source_annotation: '异步基础',
            learning_path_id: 'path-1',
            learning_path_version: 2,
            learning_path_version_name: '学习计划 v2',
            source_day: 1,
            source_chapter_id: 'chapter-async',
            source_chapter_title: '异步基础',
            source_task_title: '理解事件循环',
            item_count: 3,
            progress: {
              attempts_count: 0,
              correct_count: 0,
              wrong_count: 0,
              accuracy_rate: 0,
              completed_count: 0,
              total_count: 3,
              last_practiced_at: null,
            },
          },
          {
            id: 'group-v3-day2',
            title: '异步练习题',
            description: '通过题目巩固 asyncio 基础',
            source_type: 'ai_generated',
            source_task_id: 'task-2',
            source_annotation: '实战刷题',
            learning_path_id: 'path-2',
            learning_path_version: 3,
            learning_path_version_name: '学习计划 v3',
            source_day: 2,
            source_chapter_id: 'chapter-practice',
            source_chapter_title: '实战刷题',
            source_task_title: '异步练习题',
            item_count: 5,
            progress: {
              attempts_count: 0,
              correct_count: 0,
              wrong_count: 0,
              accuracy_rate: 0,
              completed_count: 0,
              total_count: 5,
              last_practiced_at: null,
            },
          },
        ],
      },
    })

    renderQuestionBank()

    const versionTwoHeader = await screen.findByRole('heading', { name: '学习计划 v2' })
    const versionTwoSection = versionTwoHeader.closest('section')
    expect(versionTwoSection).not.toBeNull()
    expect(within(versionTwoSection as HTMLElement).getByRole('heading', { name: '异步基础' })).toBeInTheDocument()

    const versionThreeHeader = screen.getByRole('heading', { name: '学习计划 v3' })
    const versionThreeSection = versionThreeHeader.closest('section')
    expect(versionThreeSection).not.toBeNull()
    expect(within(versionThreeSection as HTMLElement).getByRole('heading', { name: '实战刷题' })).toBeInTheDocument()
  })

  it('reuses existing concept-learning group when arriving from concept page', async () => {
    mockApiGet
      .mockResolvedValueOnce({
        data: {
          success: true,
          groups: [
            {
              id: 'group-concept-1',
              title: '布尔类型练习',
              description: '概念学习后生成的题目',
              source_type: 'concept_learning',
              source_task_id: 'task-001',
              source_annotation: '变量与类型',
              learning_path_id: 'path-1',
              learning_path_version: 2,
              learning_path_version_name: '学习计划 v2',
              source_day: 1,
              source_chapter_id: 'chapter-1',
              source_chapter_title: '变量与类型',
              source_task_title: '复习Python变量和基本数据类型',
              item_count: 3,
              progress: {
                attempts_count: 0,
                correct_count: 0,
                wrong_count: 0,
                accuracy_rate: 0,
                completed_count: 0,
                total_count: 3,
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
              id: 'q1',
              question_type: 'mcq',
              stem: 'bool 类型只有哪两个取值？',
              options: [
                { label: 'A', text: '0 和 1' },
                { label: 'B', text: 'True 和 False', is_correct: true },
              ],
              difficulty: 1,
            },
          ],
        },
      })

    renderQuestionBank('/app/question-bank?from=learning-path&taskTitle=%E5%A4%8D%E4%B9%A0Python%E5%8F%98%E9%87%8F%E5%92%8C%E5%9F%BA%E6%9C%AC%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B&taskId=task-001&pathId=path-1&version=2&chapterId=chapter-1&chapterTitle=%E5%8F%98%E9%87%8F%E4%B8%8E%E7%B1%BB%E5%9E%8B&subjectKey=python')

    await waitFor(() => {
      expect(screen.getByText('bool 类型只有哪两个取值？')).toBeInTheDocument()
    })
    expect(mockApiPost).not.toHaveBeenCalled()
  })

  it('renders option buttons when question payload includes options but question_type is inconsistent', async () => {
    mockApiGet
      .mockResolvedValueOnce({
        data: {
          success: true,
          groups: [
            {
              id: 'group-inconsistent-1',
              title: '变量命名与赋值',
              description: '检查题型字段与题目内容不一致时的渲染',
              source_type: 'ai_generated',
              source_task_id: 'task-inconsistent-1',
              source_annotation: '变量与类型',
              learning_path_id: 'path-1',
              learning_path_version: 2,
              learning_path_version_name: '学习计划 v2',
              source_day: 1,
              source_chapter_id: 'chapter-1',
              source_chapter_title: '变量与类型',
              source_task_title: '变量命名与赋值',
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
              id: 'q-inconsistent-1',
              question_type: 'short_answer',
              stem: '以下哪段代码会引发错误？',
              options: ['x = 1', '1x = 1', 'name = "Tom"', 'age = 18'],
              answer_key: 'B',
              difficulty: 2,
            },
          ],
        },
      })

    renderQuestionBank()

    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByText('变量命名与赋值')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '开始练习' }))

    await waitFor(() => {
      expect(screen.getByText('以下哪段代码会引发错误？')).toBeInTheDocument()
    })

    expect(screen.getAllByText('选择题').length).toBeGreaterThan(0)
    expect(screen.getByText('x = 1')).toBeInTheDocument()
    expect(screen.getByText('1x = 1')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('请输入你的答案...')).not.toBeInTheDocument()
  })

  it('prioritizes explicit concept-learning group id and keeps object options as mcq', async () => {
    mockApiGet
      .mockResolvedValueOnce({
        data: {
          success: true,
          groups: [
            {
              id: 'group-concept-1',
              title: '变量命名与赋值',
              description: '概念学习后生成的题目',
              source_type: 'concept_learning',
              source_task_id: 'task-other',
              source_annotation: '变量与类型',
              learning_path_id: 'path-other',
              learning_path_version: 9,
              learning_path_version_name: '学习计划 v2',
              source_day: 9,
              source_chapter_id: 'chapter-other',
              source_chapter_title: '变量与类型',
              source_task_title: '变量命名与赋值',
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
              id: 'q-concept-1',
              question_type: 'short_answer',
              stem: '**变量命名与赋值**\n\n以下哪段代码会引发错误？请选择会导致语法错误或运行时错误的选项。',
              options: [
                { label: 'A', text: 'name = "Tom"' },
                { label: 'B', text: '1name = "Tom"' },
                { label: 'C', text: 'age = 18' },
                { label: 'D', text: 'score = 95' },
              ],
              answer_key: 'B',
              difficulty: 2,
            },
          ],
        },
      })

    renderQuestionBank('/app/question-bank?from=learning-path&taskTitle=%E5%8F%98%E9%87%8F%E5%91%BD%E5%90%8D%E4%B8%8E%E8%B5%8B%E5%80%BC&taskId=task-001&pathId=path-1&version=2&chapterId=chapter-1&chapterTitle=%E5%8F%98%E9%87%8F%E4%B8%8E%E7%B1%BB%E5%9E%8B&subjectKey=python&groupId=group-concept-1')

    await waitFor(() => {
      expect(screen.getByText('以下哪段代码会引发错误？请选择会导致语法错误或运行时错误的选项。')).toBeInTheDocument()
    })

    expect(mockApiPost).not.toHaveBeenCalled()
    expect(screen.getAllByText('选择题').length).toBeGreaterThan(0)
    expect(screen.getByText('name = "Tom"')).toBeInTheDocument()
    expect(screen.getByText('1name = "Tom"')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('请输入你的答案...')).not.toBeInTheDocument()
  })

  it('extracts inline options from stem and renders them as choice cards', async () => {
    mockApiGet
      .mockResolvedValueOnce({
        data: {
          success: true,
          groups: [
            {
              id: 'group-inline-options-1',
              title: '变量命名与赋值',
              description: '检查题干内嵌选项时的渲染',
              source_type: 'ai_generated',
              source_task_id: 'task-inline-options-1',
              source_annotation: '变量与类型',
              learning_path_id: 'path-1',
              learning_path_version: 2,
              learning_path_version_name: '学习计划 v2',
              source_day: 1,
              source_chapter_id: 'chapter-1',
              source_chapter_title: '变量与类型',
              source_task_title: '变量命名与赋值',
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
              id: 'q-inline-options-1',
              question_type: 'short_answer',
              stem: '以下哪段代码会导致错误？请选择所有会导致错误的选项。 A. 3var = 10 B. _score = 95.5 C. class = "Python" D. user_name = "Alice" E. my-var = 42',
              answer_key: 'A,C,E',
              difficulty: 2,
            },
          ],
        },
      })

    renderQuestionBank()

    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByText('变量命名与赋值')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '开始练习' }))

    await waitFor(() => {
      expect(screen.getByText(/以下哪段代码会导致错误/)).toBeInTheDocument()
    })

    expect(screen.getByText('3var = 10')).toBeInTheDocument()
    expect(screen.getByText('_score = 95.5')).toBeInTheDocument()
    expect(screen.getByText('class = "Python"')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('请输入你的答案...')).not.toBeInTheDocument()
  })

  it('loads explicit concept-learning group directly when the group list lookup misses it', async () => {
    mockApiGet
      .mockResolvedValueOnce({
        data: {
          success: true,
          groups: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          items: [
            {
              id: 'q-direct-1',
              question_type: 'mcq',
              stem: '逻辑回归通常用于解决哪类问题？',
              options: [
                { label: 'A', text: '分类问题', is_correct: true },
                { label: 'B', text: '聚类问题' },
              ],
              answer_key: 'A',
              difficulty: 2,
            },
          ],
        },
      })

    renderQuestionBank('/app/question-bank?from=learning-path&entrySource=concept-learning&taskTitle=%E7%90%86%E8%A7%A3%E9%80%BB%E8%BE%91%E5%9B%9E%E5%BD%92&taskId=task-ml-1&pathId=path-ml-1&version=1&chapterId=chapter-ml-1&chapterTitle=%E7%BB%8F%E5%85%B8%E7%9B%91%E7%9D%A3%E5%AD%A6%E4%B9%A0&subjectKey=machine_learning&groupId=group-ml-concept-1')

    await waitFor(() => {
      expect(screen.getByText('逻辑回归通常用于解决哪类问题？')).toBeInTheDocument()
    })

    expect(mockApiGet).toHaveBeenNthCalledWith(
      2,
      '/api/question-bank/groups/group-ml-concept-1/items',
      { params: { user_id: 'test-user-id' } }
    )
    expect(screen.queryByText('未找到对应题组，请返回概念学习页后重试')).not.toBeInTheDocument()
    expect(mockApiPost).not.toHaveBeenCalled()
  })
})
