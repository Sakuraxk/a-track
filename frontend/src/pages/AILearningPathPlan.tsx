import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Play,
  Loader2,
  RefreshCw,
  Sparkles,
  AlertTriangle,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { SubjectGate } from "@/components/navigation/SubjectGate"
import { LearningPathVersionHeader } from "@/components/learning-path-workbench/LearningPathVersionHeader"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { api, getApiErrorMessage } from "@/lib/api"
import type { LearningPath, VersionSummary } from "@/stores/learning-path"
import { useLearningPathStore } from "@/stores/learning-path"
import { useAuthStore } from "@/stores/auth"
import { useSubjectStore } from "@/stores/subject"
import { useNotificationStore } from "@/stores/notification"
import type { NotificationType } from "@/stores/notification"

type VersionsResponse = {
  success: boolean
  versions: VersionSummary[]
  active_version: VersionSummary | null
}

type ActivateResponse = {
  success: boolean
  message: string
  path: LearningPath
}

const taskTypeLabel: Record<string, string> = {
  concept: "概念学习",
  exercise: "练习题",
  project: "项目实战",
  review: "复习回顾",
}

export default function AILearningPathPlan() {
  const navigate = useNavigate()
  const { pathId } = useParams<{ pathId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const profile = useAuthStore((state) => state.profile)
  const currentSubjectId = useSubjectStore((state) => state.currentSubjectId)
  const subjects = useSubjectStore((state) => state.subjects)
  const currentSubject = subjects.find((subject) => subject.id === currentSubjectId)
  const currentSubjectKey = currentSubject?.key || "python"

  const {
    pathsBySubject,
    setPathForSubject,
    updateTaskCompletion,
    setVersionsForSubject,
  } = useLearningPathStore()

  const cachedPathForCurrentSubject = useMemo(
    () => pathsBySubject[currentSubjectKey] ?? null,
    [currentSubjectKey, pathsBySubject],
  )
  const cachedPathMatchesRoute = cachedPathForCurrentSubject?.id === pathId
  const [path, setPath] = useState<LearningPath | null>(
    cachedPathMatchesRoute ? (cachedPathForCurrentSubject as LearningPath) : null,
  )
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [extending, setExtending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const selectedDayValue = Number(searchParams.get("day") || path?.current_day || "1")
  const selectedDay = selectedDayValue > 0 ? selectedDayValue : 1
  const [versionToDelete, setVersionToDelete] = useState<number | null>(null)

  useEffect(() => {
    setPath(cachedPathMatchesRoute ? (cachedPathForCurrentSubject as LearningPath) : null)
  }, [cachedPathForCurrentSubject, cachedPathMatchesRoute])

  const syncSelectedDay = useCallback(
    (day: number) => {
      const normalized = Math.max(1, Math.floor(day))
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (next.get("day") !== String(normalized)) {
            next.set("day", String(normalized))
            return next
          }
          return prev
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const fetchVersions = useCallback(async () => {
    if (!profile?.user_id) return

    const response = await api.get<VersionsResponse>(
      `/api/ai-learning-path/user/${profile.user_id}/versions`,
      { params: { subject_key: currentSubjectKey } },

    )

    if (response.data.success) {
      setVersions(response.data.versions)
      setVersionsForSubject(currentSubjectKey, response.data.versions)
    }
    return response.data
  }, [currentSubjectKey, profile?.user_id, setVersionsForSubject])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!profile?.user_id || !pathId) return

      setLoading(true)
      setErrorMessage(null)

      try {
        const versionsPayload = await fetchVersions()
        const matchedVersion = versionsPayload?.versions.find((version) => version.id === pathId)

        if (!matchedVersion) {
          if (!cancelled) {
            const nextPathId = versionsPayload?.active_version?.id
            navigate(nextPathId ? `/app/ai-learning-path/plan/${nextPathId}` : "/app/ai-learning-path", { replace: true })
          }
          return
        }

        if (cachedPathMatchesRoute && cachedPathForCurrentSubject) {
          let cachedPath = cachedPathForCurrentSubject as LearningPath
          if (matchedVersion && (!cachedPath.version || !cachedPath.version_name)) {
            cachedPath = {
              ...cachedPath,
              version: matchedVersion.version,
              version_name: matchedVersion.version_name || `学习计划 v${matchedVersion.version}`,
            }
            setPathForSubject(currentSubjectKey, cachedPath)
          }
          if (!cancelled) {
            setPath(cachedPath)
            const urlDay = Number(searchParams.get("day") || "0")
            if (urlDay === 0) {
              syncSelectedDay(cachedPath.current_day || 1)
            }
          }
        } else {
          const response = await api.get<LearningPath>(`/api/ai-learning-path/${pathId}`)
          let fetchedPath = response.data
          if (matchedVersion && (!fetchedPath.version || !fetchedPath.version_name)) {
            fetchedPath = {
              ...fetchedPath,
              version: matchedVersion.version,
              version_name: matchedVersion.version_name || `学习计划 v${matchedVersion.version}`,
            }
          }
          if (!cancelled) {
            setPath(fetchedPath)
            setPathForSubject(currentSubjectKey, fetchedPath)
            const urlDay = Number(searchParams.get("day") || "0")
            if (urlDay === 0) {
              syncSelectedDay(fetchedPath.current_day || 1)
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getApiErrorMessage(error))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [
    cachedPathForCurrentSubject,
    cachedPathMatchesRoute,
    currentSubjectKey,
    fetchVersions,
    navigate,
    pathId,
    profile?.user_id,
    searchParams,
    setPathForSubject,
    syncSelectedDay,
  ])

  const handleSwitchVersion = useCallback(
    async (version: number) => {
      if (!profile?.user_id) return

      const response = await api.post<ActivateResponse>(
        `/api/ai-learning-path/user/${profile.user_id}/activate`,
        { subject_key: currentSubjectKey, version },
      )

      if (response.data.success) {
        setPath(response.data.path)
        setPathForSubject(currentSubjectKey, response.data.path)
        syncSelectedDay(response.data.path.current_day || 1)
        await fetchVersions()
        navigate(`/app/ai-learning-path/plan/${response.data.path.id}`)
      }
    },
    [currentSubjectKey, fetchVersions, navigate, profile?.user_id, setPathForSubject, syncSelectedDay],
  )

  const handleTaskToggle = useCallback(
    async (day: number, taskId: string, completed: boolean) => {
      if (!path) return

      const updatedDays = path.days.map((item) =>
        item.day === day
          ? {
              ...item,
              tasks: item.tasks.map((task) => (task.id === taskId ? { ...task, completed } : task)),
            }
          : item,
      )
      const totalTasks = updatedDays.reduce((sum, item) => sum + item.tasks.length, 0)
      const completedTasks = updatedDays.reduce((sum, item) => sum + item.tasks.filter((task) => task.completed).length, 0)

      const updatedPath = {
        ...path,
        days: updatedDays,
        progress_percent: (completedTasks / Math.max(totalTasks, 1)) * 100,
      }

      setPath(updatedPath)
      setPathForSubject(currentSubjectKey, updatedPath)
      updateTaskCompletion(currentSubjectKey, day, taskId, completed)

      // 标记完成时发送鼓励通知
      if (completed) {
        const task = path.days
          .find((d) => d.day === day)
          ?.tasks.find((t) => t.id === taskId)
        const typeMap: Record<string, NotificationType> = {
          concept: "chapter_complete",
          exercise: "exercise_complete",
          review: "review_complete",
          project: "exercise_complete",
        }
        const notifType = typeMap[task?.type || ""] || "general"
        useNotificationStore.getState().addNotification(notifType)
      }

      try {
        await api.put(`/api/ai-learning-path/${path.id}/progress`, {
          day,
          task_id: taskId,
          completed,
        })
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error))
      }
    },
    [currentSubjectKey, path, setPathForSubject, updateTaskCompletion],
  )

  const handleDeleteVersion = useCallback((versionToDel: number) => {
    setVersionToDelete(versionToDel)
  }, [])

  const confirmDeleteVersion = useCallback(async () => {
    if (!profile?.user_id || versionToDelete === null) return

    setLoading(true)
    setErrorMessage(null)

    try {
      const response = await api.delete<{ success: boolean; message: string }>(
        `/api/ai-learning-path/user/${profile.user_id}/version`,
        {
          data: {
            subject_key: currentSubjectKey,
            version: versionToDelete,
            permanent: true,
          },
        }
      )

      if (response.data.success) {
        const versionsPayload = await fetchVersions()
        const nextPathId = versionsPayload?.active_version?.id
        
        if (path?.version === versionToDelete) {
          if (nextPathId) {
            navigate(`/app/ai-learning-path/plan/${nextPathId}`, { replace: true })
          } else {
            setPath(null)
            setPathForSubject(currentSubjectKey, null)
            navigate("/app/ai-learning-path", { replace: true })
          }
        }
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setLoading(false)
      setVersionToDelete(null)
    }
  }, [currentSubjectKey, fetchVersions, navigate, path?.version, profile?.user_id, setPathForSubject, versionToDelete])

  const handleExtendPath = useCallback(async () => {
    if (!path) return
    setExtending(true)
    setErrorMessage(null)

    try {
      const response = await api.post<{ success: boolean; path: LearningPath | null }>(
        `/api/ai-learning-path/${path.id}/extend`,
        { chunk_days: path.phase_size ?? 7 },
      )

      if (response.data.success && response.data.path) {
        setPath(response.data.path)
        setPathForSubject(currentSubjectKey, response.data.path)
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    } finally {
      setExtending(false)
    }
  }, [currentSubjectKey, path, setPathForSubject])

  const currentDayData = useMemo(
    () => path?.days.find((day) => day.day === selectedDay) ?? path?.days[0] ?? null,
    [path, selectedDay],
  )
  const generatedDays = path?.generated_days ?? path?.days.length ?? 0
  const canExtend = Boolean(path && generatedDays < path.total_days)

  return (
    <SubjectGate featureName="AI 学习计划">
      <div className="h-full w-full overflow-y-auto space-y-8 pb-16 pr-2">
        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full px-0 text-slate-600 hover:bg-transparent hover:text-slate-900"
            onClick={() => navigate(-1)}
          >
            返回上一级
          </Button>
        </div>
        <LearningPathVersionHeader
          subjectName={currentSubject?.name ?? "当前学科"}
          mapVersion={null}
          sessionStatus={path ? "generated" : "--"}
          readyCheck={{
            session_id: path?.id ?? "plan",
            ready: true,
            missing_items: [],
            summary: path ? `当前版本已生成，可继续查看 ${path.total_days} 天学习计划。` : "等待加载学习计划。",
          }}
          path={path}
          versions={versions}
          onSwitchVersion={handleSwitchVersion}
          onDeleteVersion={handleDeleteVersion}
          isDeleting={loading || extending}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-white/15 bg-white/10 text-white hover:bg-white/20"
                onClick={() => navigate("/app/ai-learning-path")}
              >
                重新进行规划
              </Button>
            </>
          }
        />

        {errorMessage && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
              正在加载学习计划...
            </span>
          </div>
        )}

        {path ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.5)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1 max-w-xl">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-600">Version Summary</div>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">{path.version_name ?? "学习计划"}</h2>
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm font-medium text-slate-600">
                    <span>当前进度 {Math.round(path.progress_percent)}%</span>
                    <span>第 {path.current_day} 天 / 共 {path.total_days} 天</span>
                  </div>
                  <Progress value={path.progress_percent} className="h-2 w-full bg-slate-100" />
                  {generatedDays < path.total_days && (
                    <p className="mt-1 text-xs text-amber-600">
                      📋 分阶段学习：当前已解锁 {generatedDays} 天，可随时解锁后续内容
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                  当前节奏：{path.daily_minutes} 分钟/天
                </div>
                {canExtend && (
                  <Button
                    type="button"
                    onClick={handleExtendPath}
                    disabled={extending}
                    className="rounded-full bg-slate-950 text-white hover:bg-slate-800"
                  >
                    {extending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    解锁后续阶段
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
              <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">学习日程</div>
                <div className="mt-4 space-y-2">
                  {path.days.map((day) => (
                    <button
                      key={day.day}
                      type="button"
                      onClick={() => syncSelectedDay(day.day)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${currentDayData?.day === day.day ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">第 {day.day} 天</div>
                          <div className="mt-1 text-xs text-slate-500">{day.theme}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </aside>

              <div
                key={currentDayData?.day ?? "empty-day"}
                className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm ring-1 ring-slate-100 shrink-0"
              >
                {currentDayData ? (
                  <>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 whitespace-nowrap">
                          <Clock3 className="h-3.5 w-3.5 shrink-0" />
                          {currentDayData.total_minutes} 分钟
                        </div>
                        <h3 className="mt-3 text-2xl font-semibold text-slate-950">{currentDayData.theme}</h3>
                        <p className="mt-2 text-sm text-slate-500">{currentDayData.date}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm leading-6 text-white md:max-w-xs lg:max-w-sm shrink-0">
                        <span className="font-medium text-cyan-300">路线目标</span>
                        <p className="mt-1 text-slate-200">{path.goal}</p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-4">
                      {currentDayData.tasks.map((task) => (
                        <article
                          key={task.id}
                          className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                                <BookOpen className="h-3.5 w-3.5" />
                                {taskTypeLabel[task.type] || task.type}
                              </div>
                              <h4 className="mt-3 text-xl font-semibold text-slate-950">{task.title}</h4>
                              <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
                              {!!task.resources.length && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {task.resources.map((resource) => (
                                    <span key={resource} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500">
                                      {resource}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-3 lg:mt-0 lg:shrink-0">
                              <Button
                                type="button"
                                variant={task.completed ? "default" : "outline"}
                                className={`rounded-full ${task.completed ? "bg-emerald-500 text-white hover:bg-emerald-500/90" : ""}`}
                                onClick={() => handleTaskToggle(currentDayData.day, task.id, !task.completed)}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                {task.completed ? "已完成" : "标记完成"}
                              </Button>

                              {!task.completed && task.type === "concept" && (
                                <Button
                                  type="button"
                                  className="rounded-full bg-blue-500 text-white hover:bg-blue-600"
                                  onClick={() => {
                                    const params = new URLSearchParams({
                                      title: task.title,
                                      description: task.description,
                                      subject: currentSubject?.name || "Python",
                                      duration: String(task.duration_minutes),
                                      resources: task.resources.join(","),
                                      pathId: path.id,
                                      version: String(path.version ?? ""),
                                      versionName: path.version_name ?? "",
                                      chapterId: `day-${selectedDay}`,
                                      chapterTitle: currentDayData.theme,
                                      day: String(selectedDay),
                                      subjectKey: currentSubjectKey,
                                    })
                                    navigate(`/app/concept-learning/${task.id}?${params.toString()}`)
                                  }}
                                >
                                  <BookOpen className="mr-2 h-4 w-4" />
                                  开始学习
                                </Button>
                              )}

                              {!task.completed && task.type === "exercise" && (
                                <Button
                                  type="button"
                                  className="rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
                                  onClick={() => {
                                    const params = new URLSearchParams({
                                      from: "learning-path",
                                      taskTitle: task.title,
                                      taskDescription: task.description,
                                      day: String(selectedDay),
                                      taskId: task.id,
                                      pathId: path.id,
                                      version: String(path.version ?? ""),
                                      versionName: path.version_name ?? "",
                                      chapterId: `day-${selectedDay}`,
                                      chapterTitle: currentDayData.theme,
                                      subjectKey: currentSubjectKey,
                                    })
                                    navigate(`/app/question-bank?${params.toString()}`)
                                  }}
                                >
                                  <Play className="mr-2 h-4 w-4" />
                                  开始做题
                                </Button>
                              )}

                              {!task.completed && task.type === "review" && (
                                <Button
                                  type="button"
                                  className="rounded-full bg-amber-500 text-white hover:bg-amber-600"
                                  onClick={() => {
                                    const params = new URLSearchParams({
                                      from: "learning-path",
                                      taskTitle: task.title,
                                      taskDescription: task.description,
                                      day: String(selectedDay),
                                      taskId: task.id,
                                      pathId: path.id,
                                      version: String(path.version ?? ""),
                                      versionName: path.version_name ?? "",
                                      chapterId: `day-${selectedDay}`,
                                      chapterTitle: currentDayData.theme,
                                      subjectKey: currentSubjectKey,
                                    })
                                    navigate(`/app/question-bank?${params.toString()}`)
                                  }}
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  开始复习
                                </Button>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    当前版本还没有可展示的学习日程。
                  </div>
                )}
              </div>
            </div>


          </section>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">暂时没有可展示的学习计划</h3>
            <p className="mt-2 text-sm text-slate-500">
              请先回到 AI 规划页生成一份新的学习计划版本。
            </p>
            <Button
              type="button"
              className="mt-5 rounded-full bg-slate-950 text-white hover:bg-slate-800"
              onClick={() => navigate("/app/ai-learning-path")}
            >
              返回规划页
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={versionToDelete !== null} onOpenChange={(open) => { if (!open) setVersionToDelete(null) }}>
        <AlertDialogContent className="rounded-2xl border-slate-100 p-0 overflow-hidden shadow-2xl max-w-md">
          <div className="bg-rose-50/50 p-6 flex flex-col items-center justify-center border-b border-rose-100/50">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 mb-4 shadow-sm ring-4 ring-rose-50">
              <AlertTriangle className="h-7 w-7 text-rose-600" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900">确定要删除此计划版本吗？</AlertDialogTitle>
            <AlertDialogDescription className="mt-2 text-center text-[15px] leading-relaxed text-slate-600 px-2">
              你即将删除“<span className="font-semibold text-slate-900">{versions.find(v => v.version === versionToDelete)?.version_name ?? `学习计划 v${versionToDelete}`}</span>”。此操作 <span className="font-semibold text-rose-600">不可恢复</span>，确认继续？
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className="p-6 sm:justify-center gap-3 bg-white">
            <AlertDialogCancel className="w-full sm:w-1/2 rounded-full h-11 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-900 m-0">
              取消返回
            </AlertDialogCancel>
            <AlertDialogAction
              className="w-full sm:w-1/2 rounded-full h-11 bg-rose-600 hover:bg-rose-700 text-white font-semibold m-0 shadow-sm transition-all shadow-rose-600/20 hover:shadow-rose-600/40"
              onClick={(e) => {
                e.preventDefault()
                void confirmDeleteVersion()
              }}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              确定删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SubjectGate>
  )
}
