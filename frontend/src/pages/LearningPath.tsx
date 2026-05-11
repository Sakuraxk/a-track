import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Sparkles, Zap, BookOpen, CheckCircle2 } from "lucide-react"

import { api, getApiErrorMessage } from "@/lib/api"
import type { LearningPathItem, UserNodeState } from "@/lib/backendTypes"
import { useAuthStore } from "@/stores/auth"

const fallbackNodes: Node[] = [
  { id: '1', position: { x: 250, y: 0 }, data: { label: 'Python 基础' }, type: 'input', style: { background: '#1e293b', color: 'white', border: '1px solid #a855f7', borderRadius: '12px', padding: '10px', width: 150, textAlign: 'center', boxShadow: '0 0 15px rgba(168, 85, 247, 0.4)' } },
  { id: '2', position: { x: 100, y: 150 }, data: { label: '变量与类型' }, style: { background: '#1e293b', color: 'white', border: '1px solid #3b82f6', borderRadius: '12px', padding: '10px', width: 150, textAlign: 'center' } },
  { id: '3', position: { x: 400, y: 150 }, data: { label: '数据结构' }, style: { background: '#1e293b', color: 'white', border: '1px solid #3b82f6', borderRadius: '12px', padding: '10px', width: 150, textAlign: 'center' } },
  { id: '4', position: { x: 250, y: 300 }, data: { label: '流程控制' }, style: { background: '#1e293b', color: 'white', border: '1px solid #3b82f6', borderRadius: '12px', padding: '10px', width: 150, textAlign: 'center' } },
  { id: '5', position: { x: 250, y: 450 }, data: { label: '函数' }, style: { background: '#1e293b', color: 'white', border: '1px solid #3b82f6', borderRadius: '12px', padding: '10px', width: 150, textAlign: 'center' } },
];

const fallbackEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#a855f7' } },
  { id: 'e1-3', source: '1', target: '3', animated: true, style: { stroke: '#a855f7' } },
  { id: 'e2-4', source: '2', target: '4', style: { stroke: '#64748b' } },
  { id: 'e3-4', source: '3', target: '4', style: { stroke: '#64748b' } },
  { id: 'e4-5', source: '4', target: '5', style: { stroke: '#64748b' } },
];

export default function LearningPath() {
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)

  const [nodes, setNodes, onNodesChange] = useNodesState(fallbackNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(fallbackEdges)

  const [items, setItems] = useState<LearningPathItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusedCode, setFocusedCode] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.user_id) return

    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .get<LearningPathItem[]>(`/api/graph/user/${profile.user_id}`)
      .then((res) => {
        if (cancelled) return
        setItems(res.data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(getApiErrorMessage(err))
        setItems(null)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [profile?.user_id])

  const buildFlowFromItems = useCallback((data: LearningPathItem[]) => {
    const itemByCode = new Map<string, LearningPathItem>()
    for (const item of data) itemByCode.set(item.node.code, item)

    const codes = [...itemByCode.keys()]
    const levelByCode = new Map<string, number>()
    for (const code of codes) levelByCode.set(code, 0)

    for (let i = 0; i < codes.length; i++) {
      let changed = false
      for (const code of codes) {
        const item = itemByCode.get(code)
        if (!item) continue
        const prereqs = item.node.prerequisites ?? []
        for (const prereqCode of prereqs) {
          const prereqLevel = levelByCode.get(prereqCode) ?? 0
          const nextLevel = prereqLevel + 1
          if ((levelByCode.get(code) ?? 0) < nextLevel) {
            levelByCode.set(code, nextLevel)
            changed = true
          }
        }
      }
      if (!changed) break
    }

    const codesByLevel = new Map<number, string[]>()
    for (const code of codes) {
      const level = levelByCode.get(code) ?? 0
      const list = codesByLevel.get(level) ?? []
      list.push(code)
      codesByLevel.set(level, list)
    }

    const sortedLevels = [...codesByLevel.keys()].sort((a, b) => a - b)
    const builtNodes: Node[] = []
    const builtEdges: Edge[] = []

    for (const level of sortedLevels) {
      const codesInLevel = codesByLevel.get(level) ?? []
      codesInLevel.sort()
      for (let index = 0; index < codesInLevel.length; index++) {
        const code = codesInLevel[index]
        const item = itemByCode.get(code)
        if (!item) continue

        const mastery = item.status?.mastery ?? 0
        const status = item.status?.status ?? "not_started"
        const isCompleted = status === "completed" || mastery >= 100
        const isStarted = status === "in_progress"

        let borderColor = '#64748b' // slate-500
        let boxShadow = 'none'
        
        if (isCompleted) {
          borderColor = '#22c55e' // green-500
          boxShadow = '0 0 15px rgba(34, 197, 94, 0.3)'
        } else if (isStarted) {
          borderColor = '#a855f7' // purple-500
          boxShadow = '0 0 15px rgba(168, 85, 247, 0.3)'
        }

        builtNodes.push({
          id: code,
          position: { x: 80 + index * 280, y: 40 + level * 180 },
          data: { label: `${item.node.title} (${mastery}%)` },
          style: {
            background: '#1e293b', // slate-800
            color: 'white',
            border: `2px solid ${borderColor}`,
            borderRadius: '16px',
            padding: '12px',
            width: 180,
            textAlign: 'center',
            boxShadow: boxShadow,
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.3s ease'
          },
        })

        for (const prereqCode of item.node.prerequisites ?? []) {
          if (!itemByCode.has(prereqCode)) continue
          builtEdges.push({
            id: `e-${prereqCode}-${code}`,
            source: prereqCode,
            target: code,
            animated: isStarted || isCompleted,
            style: { stroke: isCompleted ? '#22c55e' : '#64748b', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: isCompleted ? '#22c55e' : '#64748b' },
          })
        }
      }
    }

    return { builtNodes, builtEdges }
  }, [])

  useEffect(() => {
    if (!items?.length) return
    const { builtNodes, builtEdges } = buildFlowFromItems(items)
    setNodes(builtNodes)
    setEdges(builtEdges)

    if (!focusedCode) {
      const next =
        items.find((i) => (i.status?.status ?? "not_started") !== "completed")?.node.code ??
        items[0]?.node.code ??
        null
      setFocusedCode(next)
    }
  }, [buildFlowFromItems, focusedCode, items, setEdges, setNodes])

  const focusedItem = useMemo(() => {
    if (!items?.length) return null
    if (focusedCode) return items.find((i) => i.node.code === focusedCode) ?? null
    return items[0] ?? null
  }, [focusedCode, items])

  const onNodeClick = useCallback((_e: unknown, node: Node) => {
    setFocusedCode(node.id)
  }, [])

  const updateState = useCallback(
    async (next: UserNodeState) => {
      if (!profile?.user_id) return
      try {
        const res = await api.post<UserNodeState>(`/api/graph/user/${profile.user_id}/state`, next)
        const returned = res.data
        setItems((prev) => {
          if (!prev) return prev
          return prev.map((it) =>
            it.node.code === returned.node_code ? { ...it, status: returned } : it,
          )
        })
      } catch (err) {
        setError(getApiErrorMessage(err))
      }
    },
    [profile?.user_id],
  )

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-display flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-600" />
            知识图谱
          </h2>
          <p className="text-slate-500 mt-1">可视化你的学习路径，点亮每一个知识节点。</p>
        </div>
        {loading && <div className="text-sm text-emerald-600 animate-pulse">正在同步神经元数据...</div>}
        {error && <div className="text-sm text-red-500 bg-red-50 px-3 py-1 rounded-lg">{error}</div>}
      </div>
      
      <div className="flex-1 border-2 border-slate-200 rounded-2xl overflow-hidden bg-slate-900 relative shadow-inner">
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          className="bg-transparent"
        >
          <Background color="#334155" gap={20} size={1} />
          <Controls className="bg-white border-slate-200 text-slate-900" />
          <MiniMap 
            nodeStrokeColor={(n) => {
              if (n.style?.background) return n.style.background as string;
              return '#eee';
            }}
            nodeColor={(n) => {
              if (n.style?.background) return n.style.background as string;
              return '#fff';
            }}
            maskColor="rgba(30, 41, 59, 0.8)"
            className="bg-slate-800 border border-slate-700 rounded-lg"
          />
        </ReactFlow>
        
        {/* Floating Glass Card for Current Focus */}
        <div className="absolute top-4 right-4 w-80">
          <Card className="shadow-2xl border-white/10 bg-slate-900/80 backdrop-blur-xl text-white ring-1 ring-white/20">
            <CardHeader className="pb-3 border-b border-white/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                当前节点
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {focusedItem ? (
                <>
                  <h3 className="text-xl font-bold mb-1 text-emerald-400">{focusedItem.node.title}</h3>
                  <div className="text-sm text-slate-300 space-y-2 mb-6">
                    <div className="flex justify-between">
                      <span>难度系数</span>
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className={`w-1.5 h-3 rounded-sm ${i < focusedItem.node.difficulty ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span>预计时长</span>
                      <span className="font-mono">{focusedItem.node.duration_minutes} min</span>
                    </div>
                    {focusedItem.node.prerequisites?.length > 0 && (
                      <div className="text-xs text-slate-500 mt-2">
                        前置：{focusedItem.node.prerequisites.join(", ")}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <Button
                      className="w-full bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white"
                      onClick={() => navigate(`/learn/${focusedItem.node.code}`)}
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      开始学习
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                      onClick={() =>
                        updateState({
                          node_code: focusedItem.node.code,
                          status: "completed",
                          mastery: 100,
                          latest_errors: [],
                        })
                      }
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      标记已掌握
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>点击图谱中的节点</p>
                  <p className="text-xs mt-1">查看详细信息</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
