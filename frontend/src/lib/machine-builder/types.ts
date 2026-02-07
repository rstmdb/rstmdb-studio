import type { Node, Edge, XYPosition } from '@xyflow/react'
import type { MachineDefinition } from '../api'

// Re-export for convenience
export type { MachineDefinition }

// Position storage in machine meta
export interface BuilderPositions {
  [stateId: string]: XYPosition
}

// Custom node data for state nodes
export interface StateNodeData {
  label: string
  isInitial: boolean
  [key: string]: unknown
}

// Custom edge data for transition edges
export interface TransitionEdgeData {
  event: string
  guard?: string
  fromStates: string[]
  [key: string]: unknown
}

// Typed versions of React Flow Node and Edge
export type StateNode = Node<StateNodeData, 'state'>
export type TransitionEdge = Edge<TransitionEdgeData>

// Builder state
export interface BuilderState {
  nodes: StateNode[]
  edges: TransitionEdge[]
  selectedNodeId: string | null
  selectedEdgeId: string | null
}

// Selection types
export type SelectionType = 'none' | 'state' | 'transition'

export interface Selection {
  type: SelectionType
  id: string | null
}

// Validation
export interface BuilderValidationError {
  type: 'error' | 'warning'
  message: string
  nodeId?: string
  edgeId?: string
}

// View mode for the machine detail page
export type ViewMode = 'visual' | 'json'

// Layout direction
export type LayoutDirection = 'LR' | 'TB'
