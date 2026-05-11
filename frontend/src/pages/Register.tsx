import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, getApiErrorMessage } from "@/lib/api"
import type { AuthResponse } from "@/lib/backendTypes"
import { useAuthStore } from "@/stores/auth"

export default function Register() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState({ email: false, password: false, confirmPassword: false })
  const [duplicateModal, setDuplicateModal] = useState<{ open: boolean; message: string }>({ open: false, message: "" })
  const navigate = useNavigate()
  const setToken = useAuthStore((s) => s.setToken)
  const setProfile = useAuthStore((s) => s.setProfile)

  const normalizedEmail = email.trim()
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  const emailError = touched.email && (!normalizedEmail ? "请输入邮箱" : !emailValid ? "邮箱格式不正确" : null)
  const passwordError = touched.password && password.length < 6 ? "密码至少 6 位" : null
  const confirmError = touched.confirmPassword && password !== confirmPassword ? "两次输入的密码不一致" : null
  const canSubmit = normalizedEmail && emailValid && password.length >= 6 && password === confirmPassword && !loading

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true, password: true, confirmPassword: true })

    if (!canSubmit) return

    setLoading(true)
    setError(null)
    try {
      if (normalizedEmail !== email) setEmail(normalizedEmail)

      const res = await api.post<AuthResponse>("/api/auth/register", {
        email: normalizedEmail,
        password,
      })

      setToken(res.data.access_token)
      setProfile(res.data.user)
      navigate("/login")
    } catch (err: any) {
      if (err.response?.status === 409) {
        const errorData = err.response?.data?.detail
        const message = typeof errorData === "object" ? errorData.message : "该邮箱已被注册"
        setDuplicateModal({ open: true, message })
      } else {
        setError(getApiErrorMessage(err))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoToLogin = () => {
    setDuplicateModal({ open: false, message: "" })
    navigate("/login", { state: { email, password, message: "您的账号已填充，请直接登录" } })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-900 font-sans selection:bg-[oklch(92%_0.05_165)] selection:text-slate-900">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(91%_0.05_165_/_0.18),transparent_28%),radial-gradient(circle_at_top_right,oklch(92%_0.04_220_/_0.14),transparent_24%),radial-gradient(circle_at_bottom_left,oklch(93%_0.04_80_/_0.10),transparent_24%)]"
      />

      <button
        onClick={() => navigate("/")}
        className="absolute left-6 top-6 z-30 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-[0_14px_32px_rgba(15,23,42,0.05)] transition-colors hover:text-slate-900 md:left-10 md:top-8"
      >
        <ArrowLeft className="h-4 w-4" />
        返回首页
      </button>

      <main className="relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[30rem] rounded-2xl border border-slate-200/80 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-9">
          <div className="flex flex-col justify-center">
            <div className="mb-8 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
                  <img src="/logo1.png" alt="Logo" className="h-full w-full object-contain p-0.5" />
                </div>
                <div className="text-2xl font-semibold tracking-tight text-slate-900 font-display">
                  智辙 <span className="font-['Audiowide'] text-[0.7em] font-normal tracking-normal text-slate-500">A-TRACK</span>
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">创建你的学习空间</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  从今天开始，用更清晰的主线组织你的学习节奏。
                </p>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-5">
              {error && (
                <div className="rounded-2xl border border-[oklch(88%_0.03_20)] bg-[oklch(98%_0.014_20)] px-4 py-3 text-sm text-[oklch(52%_0.12_20)]">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="ml-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">邮箱</Label>
                <div className="group relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[oklch(47%_0.09_165)]" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                    className="h-13 rounded-2xl border-[oklch(89%_0.016_220)] bg-white pl-12 text-slate-900 placeholder:text-slate-400 focus:border-[oklch(82%_0.05_165)] focus:ring-[oklch(90%_0.03_165)]"
                  />
                </div>
                {emailError && <div className="ml-1 text-xs text-[oklch(52%_0.12_20)]">{emailError}</div>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="ml-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">密码</Label>
                <div className="group relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[oklch(47%_0.09_165)]" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                    className="h-13 rounded-2xl border-[oklch(89%_0.016_220)] bg-white pl-12 pr-12 text-slate-900 placeholder:text-slate-400 focus:border-[oklch(82%_0.05_165)] focus:ring-[oklch(90%_0.03_165)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {passwordError && <div className="ml-1 text-xs text-[oklch(52%_0.12_20)]">{passwordError}</div>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="ml-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">确认密码</Label>
                <div className="group relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[oklch(47%_0.09_165)]" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
                    className="h-13 rounded-2xl border-[oklch(89%_0.016_220)] bg-white pl-12 pr-12 text-slate-900 placeholder:text-slate-400 focus:border-[oklch(82%_0.05_165)] focus:ring-[oklch(90%_0.03_165)]"
                  />
                </div>
                {confirmError && <div className="ml-1 text-xs text-[oklch(52%_0.12_20)]">{confirmError}</div>}
              </div>

              <Button
                type="submit"
                disabled={!canSubmit}
                className="h-[54px] w-full rounded-2xl bg-[linear-gradient(135deg,oklch(31%_0.035_215),oklch(38%_0.05_165))] text-white shadow-[0_18px_40px_rgba(15,23,42,0.14)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:opacity-100 disabled:hover:brightness-100"
              >
                {loading ? (
                  "注册中..."
                ) : (
                  <span className="flex items-center gap-2">
                    立即注册 <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-slate-500">
                已有账号?{" "}
                <button
                  onClick={() => navigate("/login")}
                  className="font-medium text-[oklch(44%_0.08_220)] underline decoration-[oklch(88%_0.03_220)] underline-offset-4 transition-colors hover:text-[oklch(40%_0.09_220)]"
                >
                  去登录
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>

      {duplicateModal.open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/18 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-[30rem] rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
            <button
              onClick={() => setDuplicateModal({ open: false, message: "" })}
              className="absolute right-4 top-4 text-slate-400 transition-colors hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-xl font-semibold text-slate-900">邮箱已注册</h3>
            <p className="mt-4 text-sm leading-7 text-slate-600">{duplicateModal.message}</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              你可以直接跳转到登录页面，账号和密码会自动填充。
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setDuplicateModal({ open: false, message: "" })
                  setError(`${duplicateModal.message}，请使用其他邮箱注册`)
                }}
                className="flex-1 rounded-2xl border-[oklch(89%_0.016_220)] bg-white text-slate-700 hover:bg-slate-50"
              >
                继续注册
              </Button>
              <Button
                onClick={handleGoToLogin}
                className="flex-1 rounded-2xl bg-[linear-gradient(135deg,oklch(31%_0.035_215),oklch(38%_0.05_165))] text-white hover:brightness-105"
              >
                去登录
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
