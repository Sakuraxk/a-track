import { useEffect, useState, useMemo, useCallback } from "react"
import { Trophy, ArrowRight, Loader2, BookOpen } from "lucide-react"
import { SubjectIcon } from "@/components/ui/SubjectIcon"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Modal, ModalHeader, ModalBody } from "@/components/ui/modal"
import { LearningPathTreePanel } from "@/components/learning-path-workbench/LearningPathTreePanel"
import { useAuthStore } from "@/stores/auth"
import { useSubjectStore } from "@/stores/subject"
import { useLearningPathWorkbenchStore, type NodePreference } from "@/stores/learning-path-workbench"
import { fetchLearningPathMap, type SkillTreeNode, type LearningPathMap } from "@/lib/learningPathWorkbench"

/** Recursively count all leaf + branch nodes in the tree (excluding the root). */
function countTreeNodes(node: SkillTreeNode): number {
  if (node.children.length === 0) return 1
  return 1 + node.children.reduce((sum, child) => sum + countTreeNodes(child), 0)
}

/** Count nodes at depth >= 1 (i.e. everything under root). */
function countDescendants(root: SkillTreeNode): number {
  return root.children.reduce((sum, child) => sum + countTreeNodes(child), 0)
}

export function AchievementTreeCard() {
  const [map, setMap] = useState<LearningPathMap | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const userId = useAuthStore((state) => state.profile?.user_id)
  const currentSubjectId = useSubjectStore((state) => state.currentSubjectId)
  const subjects = useSubjectStore((state) => state.subjects)
  const currentSubject = subjects.find((s) => s.id === currentSubjectId)
  const subjectKey = currentSubject?.key

  // Read workbench preferences (synced with the star map page)
  const preferences = useLearningPathWorkbenchStore((s) => s.preferences)

  // Selected node state for the modal tree panel (local to this component)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const loadMap = async () => {
      if (!subjectKey || !userId) {
        setMap(null)
        setErrorMessage(null)
        return
      }
      setIsLoading(true)
      setErrorMessage(null)
      try {
        const data = await fetchLearningPathMap(subjectKey, userId)
        setMap(data)
      } catch (error) {
        console.error("Failed to fetch learning path map for skill tree card:", error)
        setMap(null)
        setErrorMessage("加载失败")
      } finally {
        setIsLoading(false)
      }
    }

    loadMap()
  }, [subjectKey, userId])

  const summary = useMemo(() => {
    if (!map) return null
    const totalNodes = countDescendants(map.tree)
    const masteredNodes = preferences.known_node_ids.length
    const learningNodes = preferences.target_node_ids.length
    const progressPercent = totalNodes > 0 ? Math.round((masteredNodes / totalNodes) * 100) : 0
    return {
      subjectName: currentSubject?.name || "加载中...",
      subjectIcon: currentSubject?.icon || "📚",
      totalNodes,
      masteredNodes,
      learningNodes,
      progressPercent: Math.max(0, Math.min(100, progressPercent)),
    }
  }, [map, preferences.known_node_ids.length, preferences.target_node_ids.length, currentSubject])

  // No-op preference setter for the read-only modal view
  const handleSetPreference = useCallback((_nodeId: string, _preference: NodePreference) => {
    // Read-only view in the dashboard modal
  }, [])

  if (!currentSubjectId) return null

  const progressPercent = summary?.progressPercent ?? 0
  const canOpenTree = Boolean(userId && map && !isLoading && !errorMessage)

  return (
    <>
      <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-slate-500">
            技能树
          </CardTitle>
          <Trophy className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden">
                  <SubjectIcon subject={currentSubject} className="w-10 h-10" />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-800">
                    {summary?.subjectName || "加载中..."}
                  </div>
                  <div className="text-xs text-slate-500">
                    已掌握 {summary?.masteredNodes || 0} / {summary?.totalNodes || 0} 个技能
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-600">
                  <span>学习进度</span>
                  <span>{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2 bg-slate-100" />
              </div>

              <Button
                onClick={() => setIsModalOpen(true)}
                variant="outline"
                className="w-full gap-2 border-slate-200 hover:bg-white hover:text-primary hover:border-primary/30 group"
                disabled={!canOpenTree}
              >
                <BookOpen className="h-4 w-4 text-slate-400 group-hover:text-primary" />
                查看完整技能树
                <ArrowRight className="h-4 w-4 ml-auto text-slate-300 group-hover:text-primary transition-transform group-hover:translate-x-1" />
              </Button>
              {errorMessage && <div className="text-xs text-red-500 text-center">{errorMessage}</div>}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="max-w-[90vw] w-[1200px] h-[85vh] p-0 overflow-hidden"
      >
        <ModalHeader className="border-b bg-slate-50/80 backdrop-blur pb-4 pt-6 px-6">
          <div className="flex items-center gap-3">
            <span className="inline-block"><SubjectIcon subject={currentSubject} className="w-8 h-8" showBackground={false} /></span>
            <h2 className="text-xl font-bold text-slate-800">
              {summary?.subjectName || "技能树"} 学习星图
            </h2>
          </div>
        </ModalHeader>
        <ModalBody className="p-0 h-[calc(85vh-80px)] overflow-hidden bg-slate-50">
          <LearningPathTreePanel
            map={map}
            selectedNodeId={selectedNodeId}
            searchTerm={searchTerm}
            preferences={preferences}
            readOnly
            onSearchChange={setSearchTerm}
            onSelectNode={setSelectedNodeId}
            onSetPreference={handleSetPreference}
          />
        </ModalBody>
      </Modal>
    </>
  )
}
