import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Login from '../Login'

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
    useLocation: () => ({ state: null }),
  }
})

const renderLogin = () => {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  )
}

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form', () => {
    renderLogin()
    expect(screen.getByLabelText(/邮箱/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/密码/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /登录/i })).toBeInTheDocument()
  })

  it('shows email validation error on blur with invalid email', async () => {
    renderLogin()
    const emailInput = screen.getByLabelText(/邮箱/i)

    await userEvent.type(emailInput, 'invalid-email')
    fireEvent.blur(emailInput)

    await waitFor(() => {
      expect(screen.getByText(/邮箱格式不正确/i)).toBeInTheDocument()
    })
  })

  it('shows password validation error on blur with short password', async () => {
    renderLogin()
    const passwordInput = screen.getByLabelText(/密码/i)

    await userEvent.type(passwordInput, '123')
    fireEvent.blur(passwordInput)

    await waitFor(() => {
      expect(screen.getByText(/密码至少 6 位/i)).toBeInTheDocument()
    })
  })

  it('disables submit button when form is invalid', () => {
    renderLogin()
    const submitButton = screen.getByRole('button', { name: /登录/i })
    expect(submitButton).toBeDisabled()
  })

  it('enables submit button when form is valid', async () => {
    renderLogin()
    const emailInput = screen.getByLabelText(/邮箱/i)
    const passwordInput = screen.getByLabelText(/密码/i)

    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(passwordInput, 'password123')

    const submitButton = screen.getByRole('button', { name: /登录/i })
    expect(submitButton).not.toBeDisabled()
  })

  it('opens forgot password modal when clicking forgot password link', async () => {
    renderLogin()
    const forgotPasswordLink = screen.getByText(/忘记密码/i)

    await userEvent.click(forgotPasswordLink)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /找回密码/i })).toBeInTheDocument()
    })
  })

  it('navigates to register page when clicking register link', async () => {
    renderLogin()
    const registerLink = screen.getByText(/立即注册/i)

    await userEvent.click(registerLink)

    expect(mockNavigate).toHaveBeenCalledWith('/register')
  })
})
