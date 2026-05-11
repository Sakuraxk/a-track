import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { Toaster } from "sonner"
import Login from "@/pages/Login"
import Register from "@/pages/Register"
import Dashboard from "@/pages/Dashboard"
import AILearningPath from "@/pages/AILearningPath"
import AILearningPathPlan from "@/pages/AILearningPathPlan"
import QuestionBank from "@/pages/QuestionBank"
import Landing from "@/pages/Landing"
import Practice from "@/pages/Practice"
import Assessment from "@/pages/Assessment"
import MainLayout from "@/components/layout/MainLayout"
import ProblemList from "@/pages/ProblemList"
import Stats from "@/pages/Stats"
import Profile from "@/pages/Profile"
import SubjectDetail from "@/pages/SubjectDetail"
import ConceptLearning from "@/pages/ConceptLearning"
import LearningStudio from "@/pages/LearningStudio"
import PromptLab from "@/pages/PromptLab"
import SubjectSwitch from "@/pages/SubjectSwitch"
import InteractiveLearning from "@/pages/InteractiveLearning"
import CourseDetail from "@/pages/CourseDetail"
import ChapterDetail from "@/pages/ChapterDetail"
import { RequireAuth } from "@/components/auth/RequireAuth"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import UnifiedAIPanel from "@/components/ai-chat/UnifiedAIPanel"
import { useAIPanelTopOffset } from "@/lib/aiPanelAnchor"
import { useChatStore } from "@/stores/chat"

export function RoutedUnifiedAIPanel() {
  const location = useLocation()
  const pathname = location.pathname
  const topOffset = useAIPanelTopOffset(pathname)
  const hideGlobalButton = useChatStore((s) => s.hideGlobalButton)

  if (pathname === "/" || pathname === "/login" || pathname === "/app/ai-learning-path") {
    return null
  }

  // When a scoped AI surface is active (e.g. PracticeSession's AI 助教),
  // suppress the global panel so users don't see two AI entry points.
  if (hideGlobalButton) {
    return null
  }

  return <UnifiedAIPanel topOffset={topOffset} bottomOffset={16} />
}

function App() {
  return (
    <>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Assessment Route (standalone for new users) */}
          <Route
            path="/assessment"
            element={
              <RequireAuth>
                <Assessment />
              </RequireAuth>
            }
          />

          {/* Protected App Routes */}
          <Route
            path="/app"
            element={
              <RequireAuth>
                <MainLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="subjects" element={<SubjectSwitch />} />
            <Route path="subject/:subjectId" element={<SubjectDetail />} />
            <Route path="studio/:subjectId" element={<LearningStudio />} />
            {import.meta.env.DEV && <Route path="prompt-lab" element={<PromptLab />} />}
            <Route path="ai-learning-path" element={<ErrorBoundary fallbackMessage="学习路线页面出现异常"><AILearningPath /></ErrorBoundary>} />
            <Route path="ai-learning-path/plan/:pathId" element={<ErrorBoundary fallbackMessage="学习计划页面出现异常"><AILearningPathPlan /></ErrorBoundary>} />
            <Route path="question-bank" element={<QuestionBank />} />
            <Route path="problems" element={<ProblemList />} />
            <Route path="stats" element={<Stats />} />
            <Route path="profile" element={<Profile />} />
            <Route path="interactive-learning" element={<InteractiveLearning />} />
            <Route path="interactive-learning/:courseId" element={<CourseDetail />} />
            <Route path="interactive-learning/:courseId/:chapterId" element={<ChapterDetail />} />
            <Route path="assessment" element={<Assessment />} />
          </Route>

          {/* Standalone Concept Learning Route (for immersive experience) */}
          <Route
            path="/app/concept-learning/:taskId"
            element={
              <RequireAuth>
                <ConceptLearning />
              </RequireAuth>
            }
          />

          {/* Standalone Practice Route (for immersive experience) */}
          <Route
            path="/practice/:topic"
            element={
              <RequireAuth>
                <Practice />
              </RequireAuth>
            }
          />
          <Route
            path="/learn/:topic"
            element={
              <RequireAuth>
                <Practice />
              </RequireAuth>
            }
          />

          {/* Legacy Redirects */}
          <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="/learning-path" element={<Navigate to="/app/ai-learning-path" replace />} />
        </Routes>
        <RoutedUnifiedAIPanel />
      </Router>
      <Toaster
        position="top-center"
        richColors
        expand={false}
        duration={3000}
      />
    </>
  )
}

export default App
