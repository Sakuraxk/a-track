import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Register from '../Register'

// Mock the auth store
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      setToken: vi.fn(),
      setProfile: vi.fn(),
    }
    return selector(state)
  }),
}))

// Mock the API
vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
  },
  getApiErrorMessage: vi.fn((err) => err.message || 'Error'),
}))

// Mock react-router-dom navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const renderRegister = () => {
  return render(
    <BrowserRouter>
      <Register />
    </BrowserRouter>
  )
}

describe('Register Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders register form', () => {
    renderRegister()
    expect(screen.getByLabelText(/邮箱/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^密码$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/确认密码/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /立即注册/i })).toBeInTheDocument()
  })

  it('shows email validation error on blur with invalid email', async () => {
    renderRegister()
    const emailInput = screen.getByLabelText(/邮箱/i)

    await userEvent.type(emailInput, 'invalid-email')
    fireEvent.blur(emailInput)

    await waitFor(() => {
      expect(screen.getByText(/邮箱格式不正确/i)).toBeInTheDocument()
    })
  })

  it('shows password validation error on blur with short password', async () => {
    renderRegister()
    const passwordInput = screen.getByLabelText(/^密码$/i)

    await userEvent.type(passwordInput, '123')
    fireEvent.blur(passwordInput)

    await waitFor(() => {
      expect(screen.getByText(/密码至少 6 位/i)).toBeInTheDocument()
    })
  })

  it('shows confirm password error when passwords do not match', async () => {
    renderRegister()
    const passwordInput = screen.getByLabelText(/^密码$/i)
    const confirmInput = screen.getByLabelText(/确认密码/i)

    await userEvent.type(passwordInput, 'password123')
    await userEvent.type(confirmInput, 'different')
    fireEvent.blur(confirmInput)

    await waitFor(() => {
      expect(screen.getByText(/两次输入的密码不一致/i)).toBeInTheDocument()
    })
  })

  it('disables submit button when form is invalid', () => {
    renderRegister()
    const submitButton = screen.getByRole('button', { name: /立即注册/i })
    expect(submitButton).toBeDisabled()
  })

  it('enables submit button when form is valid', async () => {
    renderRegister()
    const emailInput = screen.getByLabelText(/邮箱/i)
    const passwordInput = screen.getByLabelText(/^密码$/i)
    const confirmInput = screen.getByLabelText(/确认密码/i)

    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(passwordInput, 'password123')
    await userEvent.type(confirmInput, 'password123')

    const submitButton = screen.getByRole('button', { name: /立即注册/i })
    expect(submitButton).not.toBeDisabled()
  })

  it('navigates to login page when clicking login link', async () => {
    renderRegister()
    const loginLink = screen.getByText(/去登录/i)

    await userEvent.click(loginLink)

    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })
})
