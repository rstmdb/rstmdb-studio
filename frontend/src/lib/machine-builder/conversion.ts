import type { XYPosition } from '@xyflow/react'
import type { MachineDefinition } from '../api'
import type {
  StateNode,
  TransitionEdge,
  StateNodeData,
  TransitionEdgeData,
  BuilderPositions,
} from './types'

// Default node spacing for grid layout
const NODE_SPACING_X = 180
const NODE_SPACING_Y = 100

// Generate a unique ID for new nodes
export function generateNodeId(): string {
  return `state_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

// Generate a unique ID for new edges
export function generateEdgeId(from: string, to: string, event: string): string {
  return `${from}-${event}-${to}`
}

// Extract stored positions from machine meta
function getStoredPositions(definition: MachineDefinition): BuilderPositions {
  return (definition.meta?._builderPositions as BuilderPositions) || {}
}

// Calculate default positions in a grid layout
function calculateDefaultPositions(states: string[]): BuilderPositions {
  const positions: BuilderPositions = {}
  const cols = Math.ceil(Math.sqrt(states.length))

  states.forEach((state, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    positions[state] = {
      x: col * NODE_SPACING_X + 50,
      y: row * NODE_SPACING_Y + 50,
    }
  })

  return positions
}

// Convert MachineDefinition to React Flow nodes and edges
export function definitionToFlow(definition: MachineDefinition): {
  nodes: StateNode[]
  edges: TransitionEdge[]
} {
  const storedPositions = getStoredPositions(definition)
  const defaultPositions = calculateDefaultPositions(definition.states)

  // Create nodes for each state
  const nodes: StateNode[] = definition.states.map((state) => {
    const position: XYPosition = storedPositions[state] || defaultPositions[state] || { x: 0, y: 0 }

    return {
      id: state,
      type: 'state',
      position,
      data: {
        label: state,
        isInitial: state === definition.initial,
      } satisfies StateNodeData,
    }
  })

  // Create edges for each transition
  const edges: TransitionEdge[] = []
  const edgeMap = new Map<string, TransitionEdge>()

  definition.transitions.forEach((transition) => {
    const fromStates = Array.isArray(transition.from) ? transition.from : [transition.from]

    fromStates.forEach((fromState) => {
      const edgeId = generateEdgeId(fromState, transition.to, transition.event)

      // Check for existing edge with same from/to (for multi-event transitions)
      const existingKey = `${fromState}->${transition.to}`
      const existing = edgeMap.get(existingKey)

      if (existing) {
        // Append event to existing edge (rare case)
        existing.data = {
          ...existing.data,
          event: `${existing.data?.event}, ${transition.event}`,
          fromStates: [...(existing.data?.fromStates || []), fromState],
        } as TransitionEdgeData
      } else {
        const edge: TransitionEdge = {
          id: edgeId,
          source: fromState,
          target: transition.to,
          type: 'transition',
          data: {
            event: transition.event,
            guard: transition.guard,
            fromStates: [fromState],
          } satisfies TransitionEdgeData,
        }
        edgeMap.set(existingKey, edge)
        edges.push(edge)
      }
    })
  })

  return { nodes, edges }
}

// Convert React Flow nodes and edges back to MachineDefinition
export function flowToDefinition(
  nodes: StateNode[],
  edges: TransitionEdge[],
  existingMeta?: Record<string, unknown>
): MachineDefinition {
  // Extract states from nodes
  const states = nodes.map((node) => node.data.label)

  // Find initial state
  const initialNode = nodes.find((node) => node.data.isInitial)
  const initial = initialNode?.data.label || states[0] || ''

  // Build transitions from edges
  const transitions: MachineDefinition['transitions'] = []
  const transitionMap = new Map<string, { fromStates: string[]; event: string; to: string; guard?: string }>()

  edges.forEach((edge) => {
    const fromNode = nodes.find((n) => n.id === edge.source)
    const toNode = nodes.find((n) => n.id === edge.target)

    if (!fromNode || !toNode || !edge.data) return

    const key = `${edge.data.event}->${toNode.data.label}`
    const existing = transitionMap.get(key)

    if (existing) {
      // Multiple source states for same event/target
      if (!existing.fromStates.includes(fromNode.data.label)) {
        existing.fromStates.push(fromNode.data.label)
      }
    } else {
      transitionMap.set(key, {
        fromStates: [fromNode.data.label],
        event: edge.data.event,
        to: toNode.data.label,
        guard: edge.data.guard,
      })
    }
  })

  // Convert to final transition format
  transitionMap.forEach((t) => {
    transitions.push({
      from: t.fromStates.length === 1 ? t.fromStates[0] : t.fromStates,
      event: t.event,
      to: t.to,
      ...(t.guard ? { guard: t.guard } : {}),
    })
  })

  // Store positions in meta
  const builderPositions: BuilderPositions = {}
  nodes.forEach((node) => {
    builderPositions[node.data.label] = node.position
  })

  const meta: Record<string, unknown> = {
    ...(existingMeta || {}),
    _builderPositions: builderPositions,
  }

  return {
    states,
    initial,
    transitions,
    meta,
  }
}

// Create a new state node
export function createStateNode(
  name: string,
  position: XYPosition,
  isInitial: boolean = false
): StateNode {
  return {
    id: name,
    type: 'state',
    position,
    data: {
      label: name,
      isInitial,
    },
  }
}

// Create a new transition edge
export function createTransitionEdge(
  sourceId: string,
  targetId: string,
  event: string,
  guard?: string
): TransitionEdge {
  return {
    id: generateEdgeId(sourceId, targetId, event),
    source: sourceId,
    target: targetId,
    type: 'transition',
    data: {
      event,
      guard,
      fromStates: [sourceId],
    },
  }
}

// Validate the current builder state
export function validateBuilderState(
  nodes: StateNode[],
  edges: TransitionEdge[]
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  // Check for empty state machine
  if (nodes.length === 0) {
    errors.push('State machine must have at least one state')
    return { valid: false, errors, warnings }
  }

  // Check for initial state
  const hasInitial = nodes.some((n) => n.data.isInitial)
  if (!hasInitial) {
    errors.push('State machine must have an initial state')
  }

  // Check for multiple initial states
  const initialCount = nodes.filter((n) => n.data.isInitial).length
  if (initialCount > 1) {
    errors.push('State machine can only have one initial state')
  }

  // Check for duplicate state names
  const names = nodes.map((n) => n.data.label)
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index)
  if (duplicates.length > 0) {
    errors.push(`Duplicate state names: ${[...new Set(duplicates)].join(', ')}`)
  }

  // Check for empty state names
  const emptyNames = nodes.filter((n) => !n.data.label.trim())
  if (emptyNames.length > 0) {
    errors.push('All states must have a name')
  }

  // Check for orphan states (no incoming or outgoing transitions, except initial)
  const connectedStates = new Set<string>()
  edges.forEach((edge) => {
    connectedStates.add(edge.source)
    connectedStates.add(edge.target)
  })

  nodes.forEach((node) => {
    if (!node.data.isInitial && !connectedStates.has(node.id)) {
      warnings.push(`State "${node.data.label}" has no transitions`)
    }
  })

  // Check for transitions without events
  edges.forEach((edge) => {
    if (!edge.data?.event?.trim()) {
      errors.push(`Transition from "${edge.source}" to "${edge.target}" has no event name`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
