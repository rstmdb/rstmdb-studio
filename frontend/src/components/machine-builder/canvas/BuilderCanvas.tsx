import { useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeTypes } from '../nodes/nodeTypes'
import { edgeTypes } from '../edges/edgeTypes'
import type { StateNode, TransitionEdge } from '../../../lib/machine-builder/types'
import type { NodeChange, EdgeChange, Connection } from '@xyflow/react'

interface BuilderCanvasProps {
  nodes: StateNode[]
  edges: TransitionEdge[]
  onNodesChange: (changes: NodeChange<StateNode>[]) => void
  onEdgesChange: (changes: EdgeChange<TransitionEdge>[]) => void
  onConnect: (connection: Connection) => void
  onPaneClick?: () => void
  onNodeRename?: (nodeId: string, newName: string) => void
}

function BuilderCanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onPaneClick,
  onNodeRename,
}: BuilderCanvasProps) {
  const { fitView } = useReactFlow()

  // Listen for state rename events from StateNode
  useEffect(() => {
    const handleRename = (e: Event) => {
      const customEvent = e as CustomEvent<{ nodeId: string; newName: string }>
      onNodeRename?.(customEvent.detail.nodeId, customEvent.detail.newName)
    }

    window.addEventListener('stateRename', handleRename)
    return () => window.removeEventListener('stateRename', handleRename)
  }, [onNodeRename])

  // Fit view when nodes change significantly
  useEffect(() => {
    if (nodes.length > 0) {
      const timer = setTimeout(() => fitView({ padding: 0.2 }), 50)
      return () => clearTimeout(timer)
    }
  }, [nodes.length, fitView])

  const handlePaneClick = useCallback(() => {
    onPaneClick?.()
  }, [onPaneClick])

  return (
    <div className="w-full h-full bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: 'transition',
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        snapToGrid
        snapGrid={[10, 10]}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={['Meta', 'Shift']}
        className="bg-background"
      >
        {/* Arrow marker definition */}
        <svg>
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted" />
            </marker>
          </defs>
        </svg>

        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          className="!bg-background"
          color="var(--color-border)"
        />

        <Controls
          className="!bg-surface !border-border !rounded-lg !shadow-lg"
          showInteractive={false}
        />

        <MiniMap
          className="!bg-surface !border-border !rounded-lg"
          nodeColor={(node) =>
            (node as StateNode).data?.isInitial ? 'var(--color-secondary)' : 'var(--color-primary)'
          }
          maskColor="rgba(0, 0, 0, 0.5)"
        />
      </ReactFlow>
    </div>
  )
}

export function BuilderCanvas(props: BuilderCanvasProps) {
  return (
    <ReactFlowProvider>
      <BuilderCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
