import { useEffect, useState, useRef, useCallback } from "react"
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
  type Node,
  type Edge,
  ReactFlowProvider,
  Panel,
  Position,
  useReactFlow,
  MiniMap,
  Controls,
  type ReactFlowInstance,
} from "reactflow"
import "reactflow/dist/style.css"
import dagre from "dagre"

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  const isHorizontal = direction === 'LR'
  // Increase separation to avoid cramping
  dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 200 })

  nodes.forEach((node) => {
    // Our AchievementNode is roughly min-w-[200px] and h-[100px]
    // Giving it a bit more width in dagre for breathing room
    dagreGraph.setNode(node.id, { width: 250, height: 100 })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    node.targetPosition = isHorizontal ? Position.Left : Position.Top
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom

    // We are shifting the dagre node position (anchor=center center) to the top left
    // to match React Flow's default positioning
    node.position = {
      x: nodeWithPosition.x - 250 / 2,
      y: nodeWithPosition.y - 100 / 2,
    }

    // Add CSS transition for smooth repositioning
    node.style = { ...node.style, transition: 'transform 0.5s ease-in-out, opacity 0.5s ease-in-out' }

    return node
  })

  return { nodes, edges }
}

import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/auth"
import AchievementNode, { type TreeNodeData } from "./AchievementNode"
import { Loader2, Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw, History, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface TreeNode {
  id: string
  code: string
  title: string
  difficulty: number
  prerequisites: string[]
  chapter_code: string | null
  status: "locked" | "unlocked" | "learning" | "mastered"
  mastery: number
}

interface Chapter {
  id: string
  code: string
  title: string
  order_index: number
  nodes: TreeNode[]
}

interface AchievementTreeResponse {
  subject_id: string
  subject_name: string
  subject_icon: string
  chapters: Chapter[]
  total_nodes: number
  mastered_nodes: number
  learning_nodes: number
  unlocked_nodes: number
  locked_nodes: number
}

interface RebuildTreeResponse {
  success: boolean
  message: string
  total_nodes: number
}

type ExpansionSource = "persisted" | "ai_generated" | "local_recall"

interface ExpansionHistoryItem {
  parentCode: string
  parentNodeId: string
  parentTitle: string
  childCodes: string[]
  childTitles: string[]
  source: ExpansionSource
  updatedAt: number
}

interface FullKnowledgeGraphProps {
  subjectId: string
}

const nodeTypes = {
  achievement: AchievementNode,
}

const edgeTypes = {}

function GraphContent({ subjectId }: FullKnowledgeGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<TreeNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [expandingHint, setExpandingHint] = useState<string | null>(null)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [expansionHistory, setExpansionHistory] = useState<ExpansionHistoryItem[]>([])
  const userId = useAuthStore((state) => state.profile?.user_id)

  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const [initialFocusNodes, setInitialFocusNodes] = useState<Node[]>([])

  // Store all predefined nodes and edges for local expand/collapse
  const allNodesRef = useRef<Node<TreeNodeData>[]>([])
  const allEdgesRef = useRef<Edge[]>([])
  const expansionMetaRef = useRef<Map<string, { source: ExpansionSource; updatedAt: number }>>(new Map())

  // Function to apply initial view
  const applyInitialView = useCallback((instance: ReactFlowInstance) => {
    if (initialFocusNodes.length > 0) {
      window.requestAnimationFrame(() => {
        instance.fitView({
          padding: 0.2,
          duration: 1200,
          nodes: initialFocusNodes,
          maxZoom: 1.0,
          minZoom: 0.8
        });
      });
    }
  }, [initialFocusNodes]);

  // State for subject info
  const [graphInfo, setGraphInfo] = useState<{ name: string; icon: string } | null>(null)

  const updateExpansionMeta = useCallback((parentCode: string, source: ExpansionSource) => {
    expansionMetaRef.current.set(parentCode, {
      source,
      updatedAt: Date.now(),
    })
  }, [])

  const buildExpansionHistory = useCallback((allGraphNodes: Node<TreeNodeData>[], allGraphEdges: Edge[], fallbackUpdatedAt = Date.now()) => {
    const nodeByCode = new Map<string, Node<TreeNodeData>>(
      allGraphNodes.map((node) => [node.id, node])
    )
    const grouped = new Map<string, ExpansionHistoryItem>()

    allGraphEdges.forEach((edge) => {
      if (typeof edge.source !== "string" || typeof edge.target !== "string") return
      if (!edge.target.startsWith(`${edge.source}.`)) return

      const parentNode = nodeByCode.get(edge.source)
      const childNode = nodeByCode.get(edge.target)
      if (!parentNode || !childNode) return
      const meta = expansionMetaRef.current.get(parentNode.id) ?? {
        source: "persisted" as ExpansionSource,
        updatedAt: fallbackUpdatedAt,
      }
      if (!expansionMetaRef.current.has(parentNode.id)) {
        expansionMetaRef.current.set(parentNode.id, meta)
      }

      const existing = grouped.get(edge.source)
      if (existing) {
        if (!existing.childCodes.includes(childNode.id)) {
          existing.childCodes.push(childNode.id)
          existing.childTitles.push(childNode.data.title)
        }
        return
      }

      grouped.set(edge.source, {
        parentCode: parentNode.id,
        parentNodeId: parentNode.data.id,
        parentTitle: parentNode.data.title,
        childCodes: [childNode.id],
        childTitles: [childNode.data.title],
        source: meta.source,
        updatedAt: meta.updatedAt,
      })
    })

    return Array.from(grouped.values()).sort((a, b) => {
      if (b.updatedAt !== a.updatedAt) {
        return b.updatedAt - a.updatedAt
      }
      if (b.childCodes.length !== a.childCodes.length) {
        return b.childCodes.length - a.childCodes.length
      }
      return a.parentTitle.localeCompare(b.parentTitle, "zh-CN")
    })
  }, [])

  const computeInitialVisibleGraph = useCallback((allGraphNodes: Node<TreeNodeData>[], allGraphEdges: Edge[]) => {
    // Find root nodes (nodes that are not the target of any edge)
    const targetNodeIds = new Set(allGraphEdges.map((edge) => edge.target))
    const rootNodes = allGraphNodes.filter((node) => !targetNodeIds.has(node.id))

    // Fallbacks:
    // 1) If backend data has cycles (no true root), show currently unlocked/learning/mastered nodes.
    // 2) If all are locked, still show a small starter set to avoid a blank canvas.
    const progressNodes = allGraphNodes.filter((node) => node.data.status !== "locked")
    const initialVisibleNodes = rootNodes.length > 0
      ? rootNodes
      : progressNodes.length > 0
        ? progressNodes
        : allGraphNodes.slice(0, Math.min(allGraphNodes.length, 6))
    const initialVisibleNodeIds = new Set(initialVisibleNodes.map((node) => node.id))
    const initialVisibleEdges = allGraphEdges.filter(
      (edge) => initialVisibleNodeIds.has(edge.source) && initialVisibleNodeIds.has(edge.target)
    )
    const normalizedInitialNodes = initialVisibleNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isExpanded: false,
        isExpanding: false,
      },
    }))

    return {
      nodes: normalizedInitialNodes,
      edges: initialVisibleEdges,
    }
  }, [])

  const handleRefreshGraph = useCallback(async () => {
    if (!subjectId || !userId) {
      setErrorMessage(!userId ? "请先登录后查看技能树" : "请选择学科")
      return
    }

    setIsRefreshing(true)
    setErrorMessage(null)
    try {
      const { data } = await api.post<RebuildTreeResponse>(
        "/api/achievement-tree/rebuild",
        null,
        { params: { subject_id: subjectId, user_id: userId } }
      )
      if (!data.success) {
        setErrorMessage(data.message || "图谱重建失败，请稍后重试")
      }
      setReloadToken((value) => value + 1)
    } catch (error) {
      console.error("Refresh graph error:", error)
      setErrorMessage("刷新图谱失败，请稍后重试")
    } finally {
      setIsRefreshing(false)
    }
  }, [subjectId, userId])

  // --- Node Expansion Logic ---
  // Helper to find all descendant nodes recursively
  const getDescendants = useCallback((startNodeId: string, currentEdges: Edge[]): string[] => {
    let descendants = new Set<string>();
    let queue = [startNodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      // Find all edges where source is currentId
      const outgoingEdges = currentEdges.filter(e => e.source === currentId);
      for (const edge of outgoingEdges) {
        if (!descendants.has(edge.target)) {
          descendants.add(edge.target);
          queue.push(edge.target);
        }
      }
    }
    return Array.from(descendants);
  }, []);

  const handleExpandNode = useCallback(async (nodeId: string) => {
    if (!subjectId || !userId) return;

    // 1. Check current expansion state
    const targetNode = nodes.find(n => n.data.id === nodeId);
    if (!targetNode) return;
    const targetNodeCode = targetNode.id;
    const targetNodeTitle = targetNode.data.title;

    // --- COLLAPSE LOGIC ---
    if (targetNode.data.isExpanded) {
      const descendants = getDescendants(targetNode.id, edges);
      console.log(`Collapsing node ${targetNode.id}, found descendants:`, descendants);

      const nextNodes = nodes
        .filter(n => !descendants.includes(n.id))
        .map(n => n.data.id === nodeId ? { ...n, data: { ...n.data, isExpanded: false } } : n);

      const nextEdges = edges
        .filter(e => !descendants.includes(e.source) && !descendants.includes(e.target));

      // Re-layout the remaining graph
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nextNodes, nextEdges);

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      // We do NOT fitView here, so the screen doesn't unexpectedly zoom out making text small.
      // The nodes will smoothly glide up into place!
      return;
    }

    // --- EXPAND LOGIC ---
    // First, check if there are local hidden children in allEdgesRef
    const localChildEdges = allEdgesRef.current.filter(e => e.source === targetNodeCode);
    const localChildIds = localChildEdges.map(e => e.target);
    const localChildNodes = allNodesRef.current.filter(n => localChildIds.includes(n.id));

    if (localChildNodes.length > 0) {
      // Local children found! Reveal them without calling the API.
      const nextNodes = nodes.map(n => n.data.id === nodeId ? { ...n, data: { ...n.data, isExpanded: true } } : n);

      const existingNodeIds = new Set(nextNodes.map(n => n.id));
      const nodesToAdd = localChildNodes.filter(n => !existingNodeIds.has(n.id));

      // Critical: Ensure each newly revealed node has the click handler attached
      const preppedNodesToAdd = nodesToAdd.map(n => ({
        ...n,
        data: {
          ...n.data,
          isExpanded: false, // reset their state to collapsed
          onExpand: handleExpandNode
        }
      }));

      const allNextNodes = [...nextNodes, ...preppedNodesToAdd];

      const existingEdgeIds = new Set(edges.map(e => e.id));
      const edgesToAdd = localChildEdges.filter(e => !existingEdgeIds.has(e.id));
      const allNextEdges = [...edges, ...edgesToAdd];

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(allNextNodes, allNextEdges);

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      updateExpansionMeta(targetNodeCode, "local_recall")
      setExpansionHistory(buildExpansionHistory(allNodesRef.current, allEdgesRef.current))

      // Focus on the newly expanded area
      setTimeout(() => fitView({ padding: 0.2, duration: 800, maxZoom: 1, nodes: [{ id: targetNode.id }, ...preppedNodesToAdd] }), 50);
      return;
    }

    // 2. No local children found. Set expanding state and call AI API to generate new concepts.
    setExpandingHint(`正在为「${targetNodeTitle}」生成发散知识点...`)
    setNodes((nds) =>
      nds.map((n) => {
        if (n.data.id === nodeId) {
          return { ...n, data: { ...n.data, isExpanding: true } };
        }
        return n;
      })
    );

    try {
      // 2. Call API
      const { data } = await api.get<{ success: boolean; new_nodes: any[]; message: string }>(
        `/api/achievement-tree/${nodeId}/expand`,
        { params: { user_id: userId } }
      );

      if (!data.success || !data.new_nodes || data.new_nodes.length === 0) {
        setErrorMessage(data.message || "展开失败");
        setTimeout(() => setErrorMessage(null), 3000);
        setNodes((nds) =>
          nds.map((n) => {
            if (n.data.id === nodeId) {
              return { ...n, data: { ...n.data, isExpanding: false } };
            }
            return n;
          })
        );
        return;
      }

      // 3. Find parent position to place new nodes
      const parentNode = nodes.find(n => n.data.id === nodeId);
      const parentX = parentNode?.position.x || 0;
      const parentY = parentNode?.position.y || 0;

      // 4. Create new nodes and edges
      const newNodes: Node<TreeNodeData>[] = [];
      const newEdges: Edge[] = [];
      const SPACING_X = 350;
      const SPACING_Y = 120;

      data.new_nodes.forEach((node, idx) => {
        const xOffset = SPACING_X;
        // Spread vertically relative to parent
        const yOffset = (idx - Math.floor(data.new_nodes.length / 2)) * SPACING_Y;

        const newNode: Node<TreeNodeData> = {
          id: node.code,
          type: "achievement",
          position: { x: parentX + xOffset, y: parentY + yOffset },
          data: {
            id: node.id,
            code: node.code,
            title: node.title,
            difficulty: node.difficulty,
            prerequisites: node.prerequisites,
            chapter_code: node.chapter_code,
            status: node.status,
            mastery: node.mastery,
            onExpand: handleExpandNode,
            isExpanding: false,
            isExpanded: false
          },
          // Trigger animation for the new node
          className: "animate-in zoom-in fade-in duration-500",
        };
        newNodes.push(newNode);

        node.prerequisites.forEach((prereqCode: string) => {
          newEdges.push({
            id: `${prereqCode}-${node.code}`,
            source: prereqCode,
            target: node.code,
            type: "smoothstep",
            animated: true, // Make expansion edges animated naturally
            style: {
              stroke: "#3b82f6",
              strokeWidth: 3,
              opacity: 0.9,
              transition: 'all 0.3s ease'
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
          });
        });
      });

      // 5. Update state WITH global relayout
      const updatedOldNodes = nodes.map((n) => {
        if (n.data.id === nodeId) {
          return { ...n, data: { ...n.data, isExpanded: true, isExpanding: false } };
        }
        return n;
      });

      const allNextNodes = [...updatedOldNodes, ...newNodes];
      const allNextEdges = [...edges, ...newEdges];

      // Save new nodes/edges to refs so they can be collapsed and re-expanded locally later!
      allNodesRef.current = [...allNodesRef.current, ...newNodes];
      allEdgesRef.current = [...allEdgesRef.current, ...newEdges];
      updateExpansionMeta(targetNodeCode, "ai_generated")
      setExpansionHistory(buildExpansionHistory(allNodesRef.current, allEdgesRef.current))

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(allNextNodes, allNextEdges);

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      // Focus on the newly expanded area using ReactFlow's node IDs
      setTimeout(() => fitView({ padding: 0.2, duration: 800, maxZoom: 1, nodes: [{ id: targetNode.id }, ...newNodes] }), 50);

    } catch (error) {
      console.error("Expand node error:", error);
      setErrorMessage("生成扩展节点失败，请检查网络或 AI 配置");
      setNodes((nds) =>
        nds.map((n) => {
          if (n.data.id === nodeId) {
            return { ...n, data: { ...n.data, isExpanding: false } };
          }
          return n;
        })
      );
    } finally {
      setExpandingHint(null)
    }
  }, [subjectId, userId, nodes, edges, fitView, buildExpansionHistory, updateExpansionMeta]);

  const handleRecallHistory = useCallback(async (item: ExpansionHistoryItem) => {
    const parentNode = allNodesRef.current.find((node) => node.id === item.parentCode)
    if (!parentNode) {
      setErrorMessage("历史节点不存在，可能已被重建覆盖")
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }

    await handleExpandNode(parentNode.data.id)
    setTimeout(() => {
      fitView({
        padding: 0.2,
        duration: 700,
        maxZoom: 1,
        nodes: [{ id: item.parentCode }, ...item.childCodes.map((code) => ({ id: code }))],
      })
    }, 90)
  }, [fitView, handleExpandNode])

  const handleExpandAll = useCallback(() => {
    if (allNodesRef.current.length === 0) {
      setErrorMessage("暂无可展开的图谱节点")
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }

    const sourceIds = new Set(allEdgesRef.current.map((edge) => edge.source))
    const normalizedNodes = allNodesRef.current.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onExpand: handleExpandNode,
        isExpanded: sourceIds.has(node.id),
        isExpanding: false,
      },
    }))
    const normalizedEdges = [...allEdgesRef.current]
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(normalizedNodes, normalizedEdges)

    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
    setTimeout(() => fitView({ padding: 0.2, duration: 700, maxZoom: 1 }), 60)
  }, [fitView, handleExpandNode, setNodes, setEdges])

  const handleCollapseAll = useCallback(() => {
    if (allNodesRef.current.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    const initialGraph = computeInitialVisibleGraph(allNodesRef.current, allEdgesRef.current)
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialGraph.nodes, initialGraph.edges)

    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
    setTimeout(() => fitView({ padding: 0.2, duration: 600, maxZoom: 1 }), 60)
  }, [fitView, setNodes, setEdges, computeInitialVisibleGraph])

  useEffect(() => {
    let cancelled = false

    const fetchTree = async () => {
      if (!subjectId || !userId) {
        setIsLoading(false)
        setNodes([])
        setEdges([])
        setExpansionHistory([])
        expansionMetaRef.current.clear()
        setErrorMessage(!userId ? "请先登录后查看技能树" : "请选择学科")
        return
      }
      setIsLoading(true)
      setErrorMessage(null)
      try {
        const { data } = await api.get<AchievementTreeResponse>("/api/achievement-tree", {
          params: { subject_id: subjectId, user_id: userId },
        })

        if (!data || !data.chapters || data.chapters.length === 0) {
          setErrorMessage("该学科暂无知识点数据")
          setExpansionHistory([])
          expansionMetaRef.current.clear()
          return
        }

        // Save subject info
        if (!cancelled) {
          setGraphInfo({ name: data.subject_name, icon: data.subject_icon })
        }

        const newNodes: Node<TreeNodeData>[] = []
        const newEdges: Edge[] = []
        const CHAPTER_SPACING = 350
        const NODE_VERTICAL_SPACING = 140

        const allCodes = new Set<string>()
        data.chapters.forEach((chapter) => {
          chapter.nodes.forEach((node) => allCodes.add(node.code))
        })

        data.chapters.forEach((chapter, chapterIndex) => {
          chapter.nodes.forEach((node, nodeIndex) => {
            // Add some randomness to avoid straight lines
            const xOffset = (nodeIndex % 2 === 0 ? 0 : 40)
            const x = chapterIndex * CHAPTER_SPACING + xOffset
            const y = nodeIndex * NODE_VERTICAL_SPACING

            newNodes.push({
              id: node.code,
              type: "achievement",
              position: { x, y },
              data: {
                id: node.id,
                code: node.code,
                title: node.title,
                difficulty: node.difficulty,
                prerequisites: node.prerequisites,
                chapter_code: node.chapter_code,
                status: node.status,
                mastery: node.mastery,
                onExpand: handleExpandNode,
              },
            })

            node.prerequisites.forEach((prereqCode) => {
              if (allCodes.has(prereqCode)) {
                newEdges.push({
                  id: `${prereqCode}-${node.code}`,
                  source: prereqCode,
                  target: node.code,
                  type: "smoothstep",
                  animated: node.status === "learning" || node.status === "mastered",
                  style: {
                    stroke: node.status === "locked" ? "#e2e8f0" : node.status === "mastered" ? "#34d399" : "#60a5fa",
                    strokeWidth: node.status === "mastered" || node.status === "learning" ? 3 : 2,
                    opacity: node.status === "locked" ? 0.4 : 0.9,
                    transition: 'all 0.3s ease',
                  },
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: node.status === "locked" ? "#e2e8f0" : node.status === "mastered" ? "#34d399" : "#60a5fa"
                  },
                })
              }
            })
          })
        })

        if (newNodes.length === 0) {
          if (!cancelled) {
            setErrorMessage("该学科暂无可展示知识点")
            setNodes([])
            setEdges([])
            setExpansionHistory([])
            expansionMetaRef.current.clear()
          }
          return
        }

        // Store everything in refs for local expand/collapse
        allNodesRef.current = newNodes;
        allEdgesRef.current = newEdges;
        const initialGraph = computeInitialVisibleGraph(newNodes, newEdges)

        if (!cancelled) {
          const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            initialGraph.nodes,
            initialGraph.edges
          )

          setNodes(layoutedNodes)
          setEdges(layoutedEdges)
          setExpansionHistory(buildExpansionHistory(newNodes, newEdges))

          // Save the focus nodes for when ReactFlow initializes
          setInitialFocusNodes(layoutedNodes);
        }
      } catch (error) {
        console.error("Fetch graph error:", error)
        if (!cancelled) {
          setErrorMessage("暂无数据或连接失败，请稍后刷新")
          setExpansionHistory([])
          expansionMetaRef.current.clear()
          setIsLoading(false) // Force stop loading
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchTree()
    return () => { cancelled = true }
  }, [subjectId, userId, reloadToken, setNodes, setEdges, buildExpansionHistory, computeInitialVisibleGraph]) // Removed fitView dependency

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true))
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false))
    }
  }, [])

  // Listen for fullscreen changes (ESC key etc)
  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", handleChange)
    return () => document.removeEventListener("fullscreenchange", handleChange)
  }, [])

  const sourceLabelMap: Record<ExpansionSource, string> = {
    persisted: "已持久化",
    ai_generated: "新生成",
    local_recall: "本地回显",
  }

  const sourceClassMap: Record<ExpansionSource, string> = {
    persisted: "bg-slate-100 text-slate-600",
    ai_generated: "bg-emerald-100 text-emerald-700",
    local_recall: "bg-blue-100 text-blue-700",
  }

  const formatHistoryTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).replace(/\//g, "-")
  }

  // --- End Node Expansion Logic ---

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-50/50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-slate-500 animate-pulse">AI 正在构建知识图谱...</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn("h-full w-full relative group bg-slate-50", isFullscreen && "bg-white")}>

      {/* Absolute Error Alert */}
      {errorMessage && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-50 text-red-600 px-4 py-2 flex items-center gap-2 rounded-xl shadow-lg border border-red-100 animate-in fade-in slide-in-from-top-4">
          <span className="text-sm font-bold">{errorMessage}</span>
        </div>
      )}

      {expandingHint && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-blue-50 text-blue-700 px-4 py-2 flex items-center gap-2 rounded-xl shadow-lg border border-blue-100 animate-in fade-in slide-in-from-top-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-semibold">{expandingHint}</span>
        </div>
      )}

      <ReactFlow
        nodes={nodes.map(n => ({ ...n, data: { ...n.data, onExpand: handleExpandNode } }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={applyInitialView}
        fitView={false} // Disable auto fitView on load, we handle it manually
        minZoom={0.2}
        maxZoom={2}
        defaultViewport={{ x: 300, y: 100, zoom: 0.8 }} // Start with a decent zoom and position
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        className="bg-slate-50/50"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={2}
          color="#e2e8f0"
          className="opacity-50"
        />

        {/* Title Panel */}
        {graphInfo && (
          <Panel position="top-left" className="m-4">
            <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg border border-white/50 ring-1 ring-black/5">
              <span className="text-2xl shadow-sm filter drop-shadow-sm">{graphInfo.icon}</span>
              <div className="flex flex-col">
                <h2 className="text-lg font-bold text-slate-800 tracking-tight leading-none">{graphInfo.name}</h2>
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-1">Knowledge Graph</span>
              </div>
            </div>
          </Panel>
        )}

        {/* Custom Toolbar */}
        <Panel position="top-right" className="flex flex-col gap-2 p-2">
          <div className="flex flex-col gap-1 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-sm p-1">
            <button onClick={() => zoomIn()} className="p-2 hover:bg-slate-100 rounded-md text-slate-600 transition-colors" title="Zoom In">
              <ZoomIn className="h-4 w-4" />
            </button>
            <button onClick={() => zoomOut()} className="p-2 hover:bg-slate-100 rounded-md text-slate-600 transition-colors" title="Zoom Out">
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={handleExpandAll}
              disabled={isRefreshing || isLoading}
              className="p-2 hover:bg-slate-100 rounded-md text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="全部展开"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              onClick={handleCollapseAll}
              disabled={isRefreshing || isLoading}
              className="p-2 hover:bg-slate-100 rounded-md text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="全部收起"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={handleRefreshGraph}
              disabled={isRefreshing || isLoading}
              className="p-2 hover:bg-slate-100 rounded-md text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="刷新并重建图谱"
            >
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setShowHistoryPanel((prev) => !prev)}
              className={cn(
                "p-2 rounded-md text-slate-600 transition-colors hover:bg-slate-100",
                showHistoryPanel && "bg-slate-100 text-primary"
              )}
              title="回顾发散历史"
            >
              <History className="h-4 w-4" />
            </button>
            <div className="h-px bg-slate-200 my-1 mx-2" />
            <button onClick={toggleFullscreen} className="p-2 hover:bg-slate-100 rounded-md text-slate-600 transition-colors" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </Panel>

        {showHistoryPanel && (
          <Panel position="top-right" className="mt-4 mr-20 w-80 max-h-[420px]">
            <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl overflow-hidden ring-1 ring-black/5">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">发散历史</h3>
                  <p className="text-xs text-slate-500 mt-0.5">可回顾已生成的次级图谱</p>
                </div>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {expansionHistory.length}
                </span>
              </div>
              <div className="max-h-[340px] overflow-y-auto p-3 space-y-2">
                {expansionHistory.length === 0 ? (
                  <div className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-4 text-center">
                    暂无发散记录。先点击节点上的“发散”按钮生成次级图谱。
                  </div>
                ) : (
                  expansionHistory.map((item) => (
                    <button
                      key={item.parentCode}
                      onClick={() => void handleRecallHistory(item)}
                      className="w-full text-left rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-800 truncate">{item.parentTitle}</span>
                        <span className="text-[11px] font-medium text-blue-600 shrink-0">
                          {item.childCodes.length} 节点
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", sourceClassMap[item.source])}>
                          {sourceLabelMap[item.source]}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatHistoryTime(item.updatedAt)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        {item.childTitles.slice(0, 3).join("、")}
                        {item.childTitles.length > 3 ? " ..." : ""}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </Panel>
        )}

        {/* Navigation Enhancements */}
        <MiniMap
          nodeStrokeColor={(n) => {
            if (n.data?.status === "mastered") return "#10b981";
            if (n.data?.status === "learning") return "#f59e0b";
            if (n.data?.status === "locked") return "#cbd5e1";
            return "#3b82f6";
          }}
          nodeColor={(n) => {
            if (n.data?.status === "mastered") return "#d1fae5";
            if (n.data?.status === "learning") return "#fef3c7";
            if (n.data?.status === "locked") return "#f1f5f9";
            return "#dbeafe";
          }}
          nodeBorderRadius={8}
          className="!bg-white/80 !backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden"
          maskColor="rgba(248, 250, 252, 0.7)"
          position="bottom-left"
        />

        <Controls
          showZoom={false}
          showFitView={false}
          showInteractive={false}
          className="!flex !flex-col !gap-1 !bg-transparent !border-0 !shadow-none"
        />

        {/* Legend */}
        <Panel position="bottom-left" className="m-4">
          <div className="bg-white/90 backdrop-blur-md border border-slate-200/50 p-3 rounded-xl shadow-lg ring-1 ring-black/5">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                <span className="text-xs font-medium text-slate-600">已掌握</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)] animate-pulse" />
                <span className="text-xs font-medium text-slate-600">学习中</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span className="text-xs font-medium text-slate-600">已解锁</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="text-xs font-medium text-slate-400">未解锁</span>
              </div>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}

export function FullKnowledgeGraph(props: FullKnowledgeGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphContent {...props} />
    </ReactFlowProvider>
  )
}
