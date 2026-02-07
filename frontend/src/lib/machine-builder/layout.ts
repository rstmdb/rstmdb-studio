import dagre from 'dagre'
import type { StateNode, TransitionEdge, LayoutDirection } from './types'

const NODE_WIDTH = 120
const NODE_HEIGHT = 48

export function applyAutoLayout(
  nodes: StateNode[],
  edges: TransitionEdge[],
  direction: LayoutDirection = 'LR'
): StateNode[] {
  if (nodes.length === 0) return nodes

  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    marginx: 50,
    marginy: 50,
  })

  // Add nodes to dagre
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })

  // Add edges to dagre
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  // Run the layout algorithm
  dagre.layout(dagreGraph)

  // Apply positions to nodes
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    if (!nodeWithPosition) return node

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    }
  })
}
