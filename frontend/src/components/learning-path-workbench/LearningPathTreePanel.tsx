import { type MouseEvent, useCallback, useMemo, useEffect, useState } from "react"
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  useNodesState, 
  useEdgesState, 
  Node, 
  Edge,
  MarkerType,
  ConnectionLineType,
  Position,
  useReactFlow,
  ReactFlowProvider
} from "reactflow"
import "reactflow/dist/style.css"
import { ChevronDown, ChevronUp } from "lucide-react"
import dagre from "dagre"

import type { LearningPathMap, SkillTreeNode } from "@/lib/learningPathWorkbench"

import { Button } from "@/components/ui/button"
import type { NodePreference } from "@/stores/learning-path-workbench"
import { getNodePreference } from "@/stores/learning-path-workbench"
import SkillNode from "./SkillNode"

const dagreGraph = new dagre.graphlib.Graph()
dagreGraph.setDefaultEdgeLabel(() => ({}))

type LayoutMode = "compact" | "expanded"
type ViewportBehavior = "fit" | "preserve"

const LAYOUT_CONFIGS: Record<LayoutMode, { direction: "TB" | "LR"; ranksep: number; nodesep: number; padding: number }> = {
  compact: {
    direction: "TB",
    ranksep: 52,
    nodesep: 28,
    padding: 0.24,
  },
  expanded: {
    direction: "TB",
    ranksep: 90,
    nodesep: 52,
    padding: 0.2,
  },
}

const COMPACT_NODE_WIDTH = 200
const COMPACT_NODE_HEIGHT = 60

function getCompactLayoutedElements(nodes: Node[], edges: Edge[]) {
  if (nodes.length === 0) return { nodes, edges }

  const targetIds = new Set(edges.map((edge) => edge.target))
  const rootId = nodes.find((node) => !targetIds.has(node.id))?.id ?? nodes[0].id

  const childrenBySource = new Map<string, string[]>()
  for (const edge of edges) {
    const next = childrenBySource.get(edge.source) ?? []
    next.push(edge.target)
    childrenBySource.set(edge.source, next)
  }

  const subtreeWidthCache = new Map<string, number>()
  const childGap = 96
  const verticalGap = 148

  const getSubtreeWidth = (nodeId: string): number => {
    const cached = subtreeWidthCache.get(nodeId)
    if (cached !== undefined) return cached

    const childIds = childrenBySource.get(nodeId) ?? []
    if (childIds.length === 0) {
      subtreeWidthCache.set(nodeId, COMPACT_NODE_WIDTH)
      return COMPACT_NODE_WIDTH
    }

    const totalChildrenWidth =
      childIds.reduce((sum, childId) => sum + getSubtreeWidth(childId), 0) +
      childGap * Math.max(0, childIds.length - 1)
    const width = Math.max(COMPACT_NODE_WIDTH, totalChildrenWidth)
    subtreeWidthCache.set(nodeId, width)
    return width
  }

  const levelById = new Map<string, number>([[rootId, 0]])
  const queue = [rootId]
  while (queue.length > 0) {
    const currentId = queue.shift()!
    const currentLevel = levelById.get(currentId) ?? 0
    for (const childId of childrenBySource.get(currentId) ?? []) {
      if (!levelById.has(childId)) {
        levelById.set(childId, currentLevel + 1)
        queue.push(childId)
      }
    }
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  const placeNode = (nodeId: string, leftBound: number, level: number) => {
    const node = nodeById.get(nodeId)
    if (!node) return

    const subtreeWidth = getSubtreeWidth(nodeId)
    const centerX = leftBound + subtreeWidth / 2
    node.targetPosition = Position.Top
    node.sourcePosition = Position.Bottom
    node.position = {
      x: centerX - COMPACT_NODE_WIDTH / 2,
      y: level * verticalGap - COMPACT_NODE_HEIGHT / 2,
    }

    const childIds = childrenBySource.get(nodeId) ?? []
    if (childIds.length === 0) return

    const totalChildrenWidth =
      childIds.reduce((sum, childId) => sum + getSubtreeWidth(childId), 0) +
      childGap * Math.max(0, childIds.length - 1)
    let childLeft = centerX - totalChildrenWidth / 2

    childIds.forEach((childId) => {
      const childWidth = getSubtreeWidth(childId)
      placeNode(childId, childLeft, level + 1)
      childLeft += childWidth + childGap
    })
  }

  placeNode(rootId, -getSubtreeWidth(rootId) / 2, 0)

  return { nodes, edges }
}

const getLayoutedElements = (nodes: Node[], edges: Edge[], mode: LayoutMode) => {
  if (mode === "compact") {
    return getCompactLayoutedElements(nodes, edges)
  }

  const { direction, ranksep, nodesep } = LAYOUT_CONFIGS[mode]
  const isHorizontal = direction === 'LR'
  dagreGraph.setGraph({ rankdir: direction, align: 'DL', ranksep, nodesep })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 200, height: 60 })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    node.targetPosition = isHorizontal ? 'left' : 'top' as any
    node.sourcePosition = isHorizontal ? 'right' : 'bottom' as any

    node.position = {
      x: nodeWithPosition.x - 200 / 2,
      y: nodeWithPosition.y - 60 / 2,
    }

    return node
  })

  return { nodes, edges }
}

type Props = {
  map: LearningPathMap | null
  selectedNodeId: string | null
  preferences: {
    known_node_ids: string[]
    target_node_ids: string[]
    avoid_node_ids: string[]
    free_text_notes?: string | null
  }
  readOnly?: boolean
  onSelectNode: (nodeId: string | null, anchor?: { clientX: number; clientY: number }) => void
  onSetPreference: (nodeId: string, preference: NodePreference) => void
}

const nodeTypes = {
  skillNode: SkillNode,
}



function collectAllExpandableNodeIds(node: SkillTreeNode): string[] {
  const ids: string[] = []
  const walk = (current: SkillTreeNode) => {
    if (current.children.length > 0) {
      ids.push(current.id)
      current.children.forEach(walk)
    }
  }
  walk(node)
  return ids
}

function collectDefaultExpandedNodeIds(tree: SkillTreeNode): string[] {
  return [tree.id]
}

function findAncestorPath(node: SkillTreeNode, targetId: string, path: string[] = []): string[] | null {
  if (node.id === targetId) {
    return path
  }

  for (const child of node.children) {
    const found = findAncestorPath(child, targetId, [...path, node.id])
    if (found) return found
  }

  return null
}

function TreeCanvas({ 
  initialNodes, 
  initialEdges, 
  onSelectNode,
  layoutMode,
  viewportBehavior,
  selectedNodeId,
}: { 
  initialNodes: Node[], 
  initialEdges: Edge[], 
  onSelectNode: (id: string | null, anchor?: { clientX: number; clientY: number }) => void,
  layoutMode: LayoutMode,
  viewportBehavior: ViewportBehavior,
  selectedNodeId: string | null,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const { fitView, setCenter, getViewport } = useReactFlow()
  const canRenderMiniMap =
    typeof window !== "undefined" &&
    typeof (window as Window & { DOMMatrixReadOnly?: unknown }).DOMMatrixReadOnly === "function"

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
    if (viewportBehavior === "fit") {
      const nodeTargets = initialNodes.map((node) => ({ id: node.id }))
      window.setTimeout(() => {
        fitView({
          padding: LAYOUT_CONFIGS[layoutMode].padding,
          duration: 420,
          nodes: nodeTargets,
        })
      }, 120)
    }
  }, [fitView, initialEdges, initialNodes, layoutMode, setEdges, setNodes, viewportBehavior])

  useEffect(() => {
    if (selectedNodeId && viewportBehavior === "preserve") {
      const node = initialNodes.find(n => n.id === selectedNodeId)
      if (node && node.position) {
        // Node width is 200, height is 60. Center is position + half dimensions.
        const centerX = node.position.x + 100
        const centerY = node.position.y + 30
        const currentZoom = getViewport().zoom
        const targetZoom = Math.max(currentZoom, 1.2) // Ensure a decent zoom level when focusing

        // We delay centering slightly to allow React Flow to naturally update internal states
        // especially when the node tree just got expanded.
        window.setTimeout(() => {
          setCenter(centerX, centerY, { zoom: targetZoom, duration: 600 })
        }, 50)
      }
    }
  }, [selectedNodeId, initialNodes, viewportBehavior, setCenter, getViewport])

  const onNodeClick = useCallback((event: MouseEvent, node: Node) => {
    onSelectNode(node.id, { clientX: event.clientX, clientY: event.clientY })
  }, [onSelectNode])

  const onPaneClick = useCallback(() => {
    onSelectNode(null)
  }, [onSelectNode])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
      data-testid="learning-path-tree-canvas"
      className="bg-transparent"
    >
      <Background color="#94a3b8" gap={24} size={2} className="opacity-40" />
      <Controls className="!bottom-6 !left-6 !top-auto flex flex-row gap-1 border-slate-200 bg-white/80 backdrop-blur-md" />
      {canRenderMiniMap && (
        <MiniMap
          pannable
          zoomable
          className="!bottom-6 !right-6 !left-auto !top-auto overflow-hidden rounded-xl border border-slate-200 bg-white/85"
        />
      )}
    </ReactFlow>
  )
}

export function LearningPathTreePanel({
  map,
  selectedNodeId,
  preferences,
  readOnly,
  onSelectNode,
}: Props) {
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set())
  const [isCompactMode, setIsCompactMode] = useState(true)
  const [viewportBehavior, setViewportBehavior] = useState<ViewportBehavior>("fit")

  useEffect(() => {
    if (!map) return
    setExpandedNodeIds((previous) => {
      if (previous.size > 0) {
        return previous
      }
      return new Set(collectDefaultExpandedNodeIds(map.tree))
    })
    setIsCompactMode(true)
    setViewportBehavior("fit")
  }, [map])

  useEffect(() => {
    if (!map || !selectedNodeId) return
    if (isCompactMode) return
    const ancestors = findAncestorPath(map.tree, selectedNodeId)
    if (!ancestors) return
    setExpandedNodeIds((previous) => {
      const next = new Set(previous)
      ancestors.forEach((ancestorId) => next.add(ancestorId))
      return next
    })
  }, [isCompactMode, map, selectedNodeId])

  const layoutMode = useMemo<LayoutMode>(() => {
    return isCompactMode ? "compact" : "expanded"
  }, [isCompactMode])

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!map) return { initialNodes: [], initialEdges: [] }
    
    const nodes: Node[] = []
    const edges: Edge[] = []
    
    const traverse = (n: SkillTreeNode, level: number, parentVisible: boolean, currentStageIndex?: number) => {
      const isVisible = level === 0 || parentVisible
      if (!isVisible) return

      const preference = getNodePreference(n.id, preferences)
      
      const isSelected = n.id === selectedNodeId

      nodes.push({
        id: n.id,
        type: "skillNode",
        position: { x: 0, y: 0 },
        style: {
          transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
        },
        data: { 
          label: n.label, 
          description: n.description,
          preference,
          selected: isSelected,
          isUserGenerated: n.tags.includes("user-generated"),
          readOnly: !!readOnly,
        },
      })

      const shouldExpandChildren = expandedNodeIds.has(n.id)
      n.children.forEach(child => {
        if (shouldExpandChildren) {
          edges.push({
            id: `e-${n.id}-${child.id}`,
            source: n.id,
            target: child.id,
            type: ConnectionLineType.SmoothStep,
            animated: preference === 'known' || preference === 'target',
            style: { 
              stroke: preference === 'known' ? '#10b981' : preference === 'target' ? '#0ea5e9' : '#cbd5e1', 
              strokeWidth: 2 
            },
            markerEnd: { 
              type: MarkerType.ArrowClosed, 
              color: preference === 'known' ? '#10b981' : preference === 'target' ? '#0ea5e9' : '#cbd5e1' 
            },
          })
          traverse(child, level + 1, shouldExpandChildren, currentStageIndex)
        }
      })
    }

    traverse(map.tree, 0, true)
    
    // Auto layout using dagre
    const layouted = getLayoutedElements(nodes, edges, layoutMode)
    return { initialNodes: layouted.nodes, initialEdges: layouted.edges }
  }, [layoutMode, map, preferences, expandedNodeIds, selectedNodeId])

  const handleNodeSelect = useCallback((nodeId: string | null, anchor?: { clientX: number; clientY: number }) => {
    if (nodeId === null) {
      onSelectNode(null)
      return
    }
    onSelectNode(nodeId, anchor)
    if (!map) return
    const targetNode = (() => {
      const walk = (node: SkillTreeNode): SkillTreeNode | null => {
        if (node.id === nodeId) return node
        for (const child of node.children) {
          const found = walk(child)
          if (found) return found
        }
        return null
      }
      return walk(map.tree)
    })()
    if (!targetNode || targetNode.children.length === 0) return

    setExpandedNodeIds((previous) => {
      const next = new Set(previous)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
    setViewportBehavior("preserve")
  }, [map, onSelectNode])

  const handleExpandAll = useCallback(() => {
    if (!map) return
    setExpandedNodeIds(new Set(collectAllExpandableNodeIds(map.tree)))
    setIsCompactMode(false)
    setViewportBehavior("fit")
  }, [map])

  const handleCollapseAll = useCallback(() => {
    if (!map) return
    setExpandedNodeIds(new Set([map.tree.id]))
    setIsCompactMode(true)
    setViewportBehavior("fit")
  }, [map])

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden bg-transparent"
      data-testid="learning-path-tree-panel"
      data-layout-mode={layoutMode}
    >
      {!readOnly && (
        <div className="absolute right-6 top-6 z-10 flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/85 p-1 backdrop-blur-md">
            <Button type="button" variant="ghost" size="sm" className="rounded-xl px-3 text-xs" onClick={handleExpandAll}>
              <ChevronDown className="mr-1 h-3.5 w-3.5" />
              全部展开
            </Button>
            <Button type="button" variant="ghost" size="sm" className="rounded-xl px-3 text-xs" onClick={handleCollapseAll}>
              <ChevronUp className="mr-1 h-3.5 w-3.5" />
              全部收起
            </Button>
          </div>
        </div>
      )}

      <div className="h-full w-full">
        <ReactFlowProvider>
          <div data-testid="learning-path-minimap" className="sr-only">minimap</div>
          <TreeCanvas 
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            onSelectNode={handleNodeSelect}
            layoutMode={layoutMode}
            viewportBehavior={viewportBehavior}
            selectedNodeId={selectedNodeId}
          />
        </ReactFlowProvider>
      </div>
    </div>
  )
}
