import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useEffect, useMemo, useState } from "react"

import OnboardingModal from "@/components/onboarding/OnboardingModal"
import { SubjectSwitcher } from "@/components/navigation/SubjectSwitcher"
import NotificationPanel from "@/components/navigation/NotificationPanel"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/Icon"
import { useAIPanelAnchor } from "@/lib/aiPanelAnchor"
import { useAuthStore } from "@/stores/auth"
import { useChatStore } from "@/stores/chat"
import { useLearningPathStore } from "@/stores/learning-path"
import { useLearningPathWorkbenchStore } from "@/stores/learning-path-workbench"
import { useSubjectStore } from "@/stores/subject"

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const logout = useAuthStore((s) => s.logout)
  const profile = useAuthStore((s) => s.profile)
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted)
  const setOnboardingCompleted = useAuthStore((s) => s.setOnboardingCompleted)
  const hideGlobalButton = useChatStore((s) => s.hideGlobalButton)
  const setChatOpen = useChatStore((s) => s.setOpen)
  const setPanelCollapsed = useChatStore((s) => s.setPanelCollapsed)
  const currentSubjectId = useSubjectStore((s) => s.currentSubjectId)
  const subjects = useSubjectStore((s) => s.subjects)
  const fetchSubjects = useSubjectStore((s) => s.fetchSubjects)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isDesktopViewport, setIsDesktopViewport] = useState(
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : true
  )
  const desktopHeaderRef = useAIPanelAnchor<HTMLElement>(isDesktopViewport)
  const mobileHeaderRef = useAIPanelAnchor<HTMLElement>(!isDesktopViewport)
  const canCollapseSidebar = location.pathname.startsWith("/app/ai-learning-path")
  const isWorkbenchRoute = location.pathname.startsWith("/app/ai-learning-path")
  const isInteractiveLearning = location.pathname.startsWith("/app/interactive-learning")
  const isChapterView = !!location.pathname.match(/\/app\/interactive-learning\/[^/]+\/ch\d+/)
  const currentSubject = subjects.find((subject) => subject.id === currentSubjectId)
  const currentSubjectKey = currentSubject?.key || "python"
  const activeLearningPath = useLearningPathStore((s) => s.pathsBySubject[currentSubjectKey] ?? null)
  const workbenchReady = useLearningPathWorkbenchStore((s) => s.ready?.ready ?? false)


  useEffect(() => {
    if (!canCollapseSidebar && isSidebarCollapsed) {
      setIsSidebarCollapsed(false)
    }
  }, [canCollapseSidebar, isSidebarCollapsed])

  useEffect(() => {
    const updateViewportMode = () => {
      setIsDesktopViewport(window.matchMedia("(min-width: 768px)").matches)
    }

    updateViewportMode()
    window.addEventListener("resize", updateViewportMode)
    return () => window.removeEventListener("resize", updateViewportMode)
  }, [])

  // Ensure subjects are loaded on mount so sidebar nav items are always available
  useEffect(() => {
    if (profile?.user_id) {
      fetchSubjects()
    }
  }, [profile?.user_id, fetchSubjects])

  const learningStage = useMemo(() => {
    const stageMap: Record<string, string> = {
      beginner: "初学者",
      elementary: "基础档",
      intermediate: "进阶档",
      advanced: "精通档"
    }
    return stageMap[profile?.portrait?.learning_stage as string] || "探索者"
  }, [profile?.portrait?.learning_stage])

  const showOnboarding = !!(profile && !onboardingCompleted && profile.portrait?.onboarding_completed !== "true")

  const navItems = [
    {
      path: "/app/dashboard",
      label: "学习主页",
      icon: "solar:graph-bold-duotone",
      tint: "bg-[oklch(97%_0.018_165)] text-[oklch(49%_0.11_165)]",
      activeTint: "bg-[oklch(77%_0.11_165_/_0.18)] text-[oklch(93%_0.02_165)]",
    },
    ...(currentSubjectId
      ? [
        {
          path: "/app/subjects",
          label: "我的科目",
          icon: "solar:book-bookmark-bold-duotone",
          tint: "bg-[oklch(97%_0.02_80)] text-[oklch(57%_0.12_80)]",
          activeTint: "bg-[oklch(78%_0.10_80_/_0.16)] text-[oklch(95%_0.015_80)]",
        },
        {
          path: `/app/studio/${currentSubjectId}`,
          label: "学习工作台",
          icon: "solar:magic-stick-3-bold-duotone",
          tint: "bg-[oklch(97%_0.02_220)] text-[oklch(52%_0.10_220)]",
          activeTint: "bg-[oklch(76%_0.09_220_/_0.18)] text-[oklch(94%_0.015_220)]",
        },
      ]
      : []),
    ...(import.meta.env.DEV
      ? [{
        path: "/app/prompt-lab",
        label: "提示词实验室",
        icon: "solar:settings-bold-duotone",
        tint: "bg-[oklch(97%_0.02_300)] text-[oklch(52%_0.10_300)]",
        activeTint: "bg-[oklch(77%_0.10_300_/_0.18)] text-[oklch(95%_0.015_300)]",
      }]
      : []),
    {
      path: "/app/profile",
      label: "个人中心",
      icon: "solar:user-circle-bold-duotone",
      tint: "bg-[oklch(97%_0.014_20)] text-[oklch(51%_0.09_20)]",
      activeTint: "bg-[oklch(77%_0.08_20_/_0.18)] text-[oklch(95%_0.015_20)]",
    },
    {
      path: "/app/interactive-learning",
      label: "交互式学习",
      icon: "solar:play-circle-bold-duotone",
      tint: "bg-[oklch(97%_0.02_260)] text-[oklch(52%_0.12_260)]",
      activeTint: "bg-[oklch(78%_0.10_260_/_0.18)] text-[oklch(94%_0.015_260)]",
    },
  ]

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const isPractice = location.pathname.startsWith("/practice")

  if (isPractice) {
    return <Outlet />
  }

  const railLabel = location.pathname.startsWith("/app/studio")
    ? "学习工作台"
    : location.pathname.startsWith("/app/ai-learning-path")
      ? "学习路线"
      : "学习空间"

  const userName = profile?.portrait?.nickname || "新用户"

  return (
    <div className={`relative flex h-screen overflow-hidden font-body text-slate-800 selection:bg-primary/20 selection:text-slate-900 ${isWorkbenchRoute ? "bg-white" : "bg-[linear-gradient(180deg,oklch(98%_0.01_95)_0%,oklch(97.5%_0.012_185)_48%,oklch(98.5%_0.008_210)_100%)]"}`}>
      {!isWorkbenchRoute && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(84%_0.07_165_/_0.20),transparent_32%),radial-gradient(circle_at_top_right,oklch(82%_0.05_220_/_0.18),transparent_28%),radial-gradient(circle_at_bottom_right,oklch(88%_0.05_80_/_0.14),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.55),rgba(255,255,255,0))]"
        />
      )}
      <aside
        data-testid="main-sidebar"
        data-surface="learning-rail"
        data-collapsed={isSidebarCollapsed ? "true" : "false"}
        className={`relative z-10 my-4 ml-4 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-slate-700 shadow-[0_24px_80px_rgba(15,23,42,0.08)] transition-all duration-300 ${isSidebarCollapsed ? "w-24" : "w-52"
          } ${isChapterView ? "hidden" : "hidden lg:flex"}`}
      >
        <div className={`border-b border-slate-200/80 ${isSidebarCollapsed ? "px-3 py-5" : "px-5 py-6"}`}>
          <div className={`flex items-center ${isSidebarCollapsed ? "justify-center" : "justify-between"}`}>
            <div className={`flex items-center ${isSidebarCollapsed ? "justify-center" : "gap-4"}`}>
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                <img src="/logo1.png" alt="A-Track Logo" className="w-full h-full object-contain p-1" />
              </div>
              {!isSidebarCollapsed && (
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[oklch(55%_0.05_165)]">
                    {railLabel}
                  </p>
                  <h1 className="mt-1 text-xl font-semibold leading-none text-slate-900 font-display">
                    智辙
                  </h1>
                  <span className="mt-1 block text-[11px] font-medium tracking-[0.16em] text-slate-500 uppercase">
                    A-Track
                  </span>
                </div>
              )}
            </div>
            {canCollapseSidebar && !isSidebarCollapsed && (
              <button
                type="button"
                aria-label="折叠主菜单"
                onClick={() => setIsSidebarCollapsed(true)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                <Icon icon="solar:double-alt-arrow-left-bold-duotone" className="w-5 h-5" />
              </button>
            )}
            {canCollapseSidebar && isSidebarCollapsed && (
              <button
                type="button"
                aria-label="展开主菜单"
                onClick={() => setIsSidebarCollapsed(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                <Icon icon="solar:double-alt-arrow-right-bold-duotone" className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <nav className={`flex-1 space-y-2 overflow-y-auto py-6 no-scrollbar ${isSidebarCollapsed ? "px-3" : "px-4"}`}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={isSidebarCollapsed ? item.label : undefined}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={`group flex w-full items-center rounded-2xl px-3 py-2 transition-all duration-200 ${isActive
                  ? "bg-[linear-gradient(135deg,oklch(28%_0.025_215),oklch(32%_0.03_165))] text-white shadow-[0_18px_40px_rgba(15,23,42,0.16)]"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
                  } ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl transition-colors ${isActive
                    ? item.activeTint
                    : `${item.tint} group-hover:brightness-[0.98]`
                    }`}
                >
                  <Icon icon={item.icon} className="w-5 h-5" />
                </div>
                {!isSidebarCollapsed && (
                  <div className="min-w-0 text-left">
                    <div className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>{item.label}</div>
                  </div>
                )}
              </button>
            )
          })}
        </nav>

        <div className={`border-t border-slate-200/80 ${isSidebarCollapsed ? "p-3" : "p-4"}`}>
          {isSidebarCollapsed ? (
            <div className="space-y-2">
              <button
                type="button"
                title={userName}
                onClick={() => navigate("/app/profile")}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,23,42,0.14)] overflow-hidden"
              >
                {profile?.portrait?.avatar_url ? (
                  <img
                    src={profile.portrait.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement
                      img.style.display = "none"
                      const fallback = img.parentElement?.querySelector(".collapsed-avatar-fallback") as HTMLElement | null
                      if (fallback) fallback.style.display = "flex"
                    }}
                  />
                ) : null}
                {!profile?.portrait?.avatar_url && (
                  <span className="collapsed-avatar-fallback flex items-center justify-center">
                    {userName.charAt(0) || profile?.user_id?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                )}
                {profile?.portrait?.avatar_url && (
                  <span className="collapsed-avatar-fallback flex items-center justify-center" style={{ display: "none" }}>
                    {userName.charAt(0) || profile?.user_id?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                )}
              </button>
              <button
                onClick={handleLogout}
                className="flex h-10 w-full items-center justify-center rounded-2xl bg-rose-50 text-rose-500 transition hover:bg-rose-100 hover:text-rose-700"
              >
                <Icon icon="solar:logout-2-bold-duotone" className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-2.5">
                <div
                  className="flex flex-1 cursor-pointer items-center gap-2.5 overflow-hidden transition-opacity hover:opacity-80"
                  onClick={() => navigate("/app/profile")}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white bg-slate-900 text-sm font-bold text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)]">
                    {profile?.portrait?.avatar_url ? (
                      <img
                        key={profile.portrait.avatar_url}
                        src={profile.portrait.avatar_url}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement
                          img.style.display = "none"
                          const fallback = img.parentElement?.querySelector(".sidebar-avatar-fallback") as HTMLElement | null
                          if (fallback) fallback.style.display = "flex"
                        }}
                      />
                    ) : null}
                    {!profile?.portrait?.avatar_url && (
                      <span className="sidebar-avatar-fallback flex items-center justify-center">
                        {userName.charAt(0) || profile?.user_id?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                    )}
                    {profile?.portrait?.avatar_url && (
                      <span className="sidebar-avatar-fallback flex items-center justify-center" style={{ display: "none" }}>
                        {userName.charAt(0) || profile?.user_id?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                    )}
                  </div>
                  <div className="overflow-hidden flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 line-clamp-2 leading-tight break-all">
                      {userName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{learningStage}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 transition hover:bg-rose-100 hover:text-rose-700"
                  title="退出登录"
                >
                  <Icon icon="solar:logout-2-bold-duotone" className="w-[18px] h-[18px]" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        {!isInteractiveLearning && <header
          ref={mobileHeaderRef}
          className="sticky top-0 z-30 mx-4 mt-4 flex h-16 items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)] md:hidden"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
              <img src="/logo1.png" alt="Logo" className="w-full h-full object-contain p-0.5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[oklch(56%_0.05_165)]">学习空间</p>
              <span className="text-sm font-semibold tracking-tight text-slate-900">智辙</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Icon icon="solar:hamburger-menu-bold-duotone" className="h-6 w-6 text-slate-700" />
            </Button>
          </div>
        </header>}

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-slate-950/18 px-4 pb-6 pt-24 backdrop-blur-sm md:hidden">
            <nav className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path)
                      setIsMobileMenuOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all ${isActive ? "bg-[linear-gradient(135deg,oklch(28%_0.025_215),oklch(32%_0.03_165))] text-white shadow-[0_18px_40px_rgba(15,23,42,0.16)]" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isActive ? "bg-[oklch(78%_0.11_165_/_0.18)]" : "bg-[linear-gradient(135deg,oklch(97%_0.018_165),oklch(97.5%_0.016_220))]"}`}>
                      <Icon icon={item.icon} className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{item.label}</div>
                    </div>
                  </button>
                )
              })}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-2xl bg-rose-50 px-4 py-4 text-sm font-medium text-rose-600 transition-all hover:bg-rose-100"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white">
                  <Icon icon="solar:logout-2-bold-duotone" className="w-5 h-5" />
                </div>
                <div>
                  <div>退出登录</div>
                  <div className="mt-1 text-xs text-rose-400">离开当前学习空间</div>
                </div>
              </button>
            </nav>
          </div>
        )}

        {!isInteractiveLearning && <header
          ref={desktopHeaderRef}
          className={`relative z-20 mx-4 mt-4 hidden flex-shrink-0 items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-6 shadow-[0_18px_60px_rgba(15,23,42,0.07)] md:flex ${isWorkbenchRoute ? "h-[72px]" : "h-20"}`}
        >
          <div className="flex items-center gap-4">
            {isWorkbenchRoute && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                title="返回"
              >
                <Icon icon="solar:alt-arrow-left-line-duotone" className="w-5 h-5" />
              </button>
            )}
            {!(location.pathname.startsWith("/app/profile") || location.pathname.startsWith("/app/dashboard") || location.pathname.startsWith("/app/prompt-lab")) && (
              <SubjectSwitcher />
            )}
          </div>

          <div className="ml-6 flex items-center gap-3">
            {!isWorkbenchRoute && <NotificationPanel />}

            {!hideGlobalButton && !isWorkbenchRoute && (
              <button
                onClick={() => {
                  setChatOpen(true)
                  setPanelCollapsed(false)
                }}
                className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                title="打开 AI 助手"
              >
                <Icon icon="solar:magic-stick-3-bold-duotone" className="w-5 h-5 text-emerald-500 transition-transform group-hover:rotate-6" />
                <span className="hidden xl:inline text-sm font-medium">AI 助手</span>
              </button>
            )}
          </div>
        </header>}

        <main
          className={`flex-1 ${isWorkbenchRoute ? "overflow-hidden px-4 pb-4 pt-4 md:px-4 md:pb-4 md:pt-4" : "overflow-y-auto px-4 pb-6 pt-4 md:px-6 md:pb-8 md:pt-6"}`}
        >
          <div
            data-testid="main-content-shell"
            data-immersive={isWorkbenchRoute ? "true" : "false"}
            className={`mx-auto w-full ${isWorkbenchRoute ? "h-full max-w-none" : "max-w-[100rem]"}`}
          >
            <Outlet />
          </div>
        </main>
      </div>

      <OnboardingModal
        open={showOnboarding}
        onComplete={() => setOnboardingCompleted(true)}
      />
    </div>
  )
}
