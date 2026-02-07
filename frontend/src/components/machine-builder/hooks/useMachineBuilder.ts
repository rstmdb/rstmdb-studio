import { useState, useCallback, useRef } from 'react'
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react'
import type { MachineDefinition } from '../../../lib/api'
import type { StateNode, TransitionEdge, Selection } from '../../../lib/machine-builder/types'
import {
  definitionToFlow,
  flowToDefinition,
  createStateNode,
  createTransitionEdge,
  validateBuilderState,
} from '../../../lib/machine-builder/conversion'
import { applyAutoLayout } from '../../../lib/machine-builder/layout'

interface UseMachineBuilderOptions {
  initialDefinition?: MachineDefinition
  onChange?: (definition: MachineDefinition) => void
}

export function useMachineBuilder(options: UseMachineBuilderOptions = {}) {
  const { initialDefinition, onChange } = options

  // Initialize from definition
  const initialFlow = initialDefinition
    ? definitionToFlow(initialDefinition)
    : { nodes: [], edges: [] }

  const [nodes, setNodes, onNodesChange] = useNodesState<StateNode>(initialFlow.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<TransitionEdge>(initialFlow.edges)
  const [selection, setSelection] = useState<Selection>({ type: 'none', id: null })

  // Track meta for position storage
  const metaRef = useRef<Record<string, unknown> | undefined>(initialDefinition?.meta)

  // Helper to notify parent of changes
  const notifyChange = useCallback(
    (newNodes: StateNode[], newEdges: TransitionEdge[]) => {
      if (onChange) {
        const definition = flowToDefinition(newNodes, newEdges, metaRef.current)
        onChange(definition)
      }
    },
    [onChange]
  )

  // Handle node selection
  const handleNodesChange = useCallback(
    (changes: NodeChange<StateNode>[]) => {
      onNodesChange(changes)

      // Update selection based on selection changes
      changes.forEach((change) => {
        if (change.type === 'select' && change.selected) {
          setSelection({ type: 'state', id: change.id })
        }
      })

      // Notify on position changes (drag)
      const hasPositionChange = changes.some((c) => c.type === 'position' && c.dragging === false)
      if (hasPositionChange) {
        // Use setTimeout to get updated nodes after the change is applied
        setTimeout(() => {
          setNodes((currentNodes) => {
            notifyChange(currentNodes, edges)
            return currentNodes
          })
        }, 0)
      }
    },
    [onNodesChange, edges, notifyChange, setNodes]
  )

  // Handle edge selection
  const handleEdgesChange = useCallback(
    (changes: EdgeChange<TransitionEdge>[]) => {
      onEdgesChange(changes)

      // Update selection based on selection changes
      changes.forEach((change) => {
        if (change.type === 'select' && change.selected) {
          setSelection({ type: 'transition', id: change.id })
        }
      })
    },
    [onEdgesChange]
  )

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return

      const newEdge = createTransitionEdge(
        connection.source,
        connection.target,
        'event' // Default event name
      )

      setEdges((eds) => {
        const newEdges = addEdge(newEdge, eds) as TransitionEdge[]
        // Notify after state update
        setTimeout(() => notifyChange(nodes, newEdges), 0)
        return newEdges
      })
      setSelection({ type: 'transition', id: newEdge.id })
    },
    [setEdges, nodes, notifyChange]
  )

  // Add a new state
  const addState = useCallback(
    (name?: string) => {
      const existingNames = nodes.map((n) => n.data.label)
      let newName = name || 'new_state'
      let counter = 1

      while (existingNames.includes(newName)) {
        newName = `${name || 'new_state'}_${counter}`
        counter++
      }

      // Calculate position (center of viewport or offset from last node)
      const lastNode = nodes[nodes.length - 1]
      const position = lastNode
        ? { x: lastNode.position.x + 180, y: lastNode.position.y }
        : { x: 100, y: 100 }

      const isInitial = nodes.length === 0
      const newNode = createStateNode(newName, position, isInitial)

      setNodes((nds) => {
        const newNodes = [...nds, newNode]
        setTimeout(() => notifyChange(newNodes, edges), 0)
        return newNodes
      })
      setSelection({ type: 'state', id: newNode.id })

      return newNode
    },
    [nodes, setNodes, edges, notifyChange]
  )

  // Delete selected element
  const deleteSelected = useCallback(() => {
    if (selection.type === 'state' && selection.id) {
      setNodes((nds) => {
        const newNodes = nds.filter((n) => n.id !== selection.id)
        setEdges((eds) => {
          const newEdges = eds.filter(
            (e) => e.source !== selection.id && e.target !== selection.id
          )
          setTimeout(() => notifyChange(newNodes, newEdges), 0)
          return newEdges
        })
        return newNodes
      })
      setSelection({ type: 'none', id: null })
    } else if (selection.type === 'transition' && selection.id) {
      setEdges((eds) => {
        const newEdges = eds.filter((e) => e.id !== selection.id)
        setTimeout(() => notifyChange(nodes, newEdges), 0)
        return newEdges
      })
      setSelection({ type: 'none', id: null })
    }
  }, [selection, setNodes, setEdges, nodes, notifyChange])

  // Rename a state
  const renameState = useCallback(
    (nodeId: string, newName: string) => {
      const trimmedName = newName.trim()
      if (!trimmedName) return

      // Check for duplicates
      const existingNames = nodes.filter((n) => n.id !== nodeId).map((n) => n.data.label)
      if (existingNames.includes(trimmedName)) return

      setNodes((nds) => {
        const newNodes = nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              id: trimmedName,
              data: { ...node.data, label: trimmedName },
            }
          }
          return node
        })

        // Update edges to point to new node id
        setEdges((eds) => {
          const newEdges = eds.map((edge) => ({
            ...edge,
            source: edge.source === nodeId ? trimmedName : edge.source,
            target: edge.target === nodeId ? trimmedName : edge.target,
            id:
              edge.source === nodeId || edge.target === nodeId
                ? `${edge.source === nodeId ? trimmedName : edge.source}-${edge.data?.event || 'event'}-${edge.target === nodeId ? trimmedName : edge.target}`
                : edge.id,
          }))
          setTimeout(() => notifyChange(newNodes, newEdges), 0)
          return newEdges
        })

        return newNodes
      })

      // Update selection if this node was selected
      if (selection.id === nodeId) {
        setSelection({ type: 'state', id: trimmedName })
      }
    },
    [nodes, setNodes, setEdges, selection, notifyChange]
  )

  // Set initial state
  const setInitialState = useCallback(
    (nodeId: string) => {
      setNodes((nds) => {
        const newNodes = nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            isInitial: node.id === nodeId,
          },
        }))
        setTimeout(() => notifyChange(newNodes, edges), 0)
        return newNodes
      })
    },
    [setNodes, edges, notifyChange]
  )

  // Update transition event
  const updateTransitionEvent = useCallback(
    (edgeId: string, event: string) => {
      setEdges((eds) => {
        const newEdges = eds.map((edge) => {
          if (edge.id === edgeId) {
            return {
              ...edge,
              data: { ...edge.data, event } as TransitionEdge['data'],
            }
          }
          return edge
        })
        setTimeout(() => notifyChange(nodes, newEdges), 0)
        return newEdges
      })
    },
    [setEdges, nodes, notifyChange]
  )

  // Update transition guard
  const updateTransitionGuard = useCallback(
    (edgeId: string, guard: string | undefined) => {
      setEdges((eds) => {
        const newEdges = eds.map((edge) => {
          if (edge.id === edgeId) {
            return {
              ...edge,
              data: { ...edge.data, guard } as TransitionEdge['data'],
            }
          }
          return edge
        })
        setTimeout(() => notifyChange(nodes, newEdges), 0)
        return newEdges
      })
    },
    [setEdges, nodes, notifyChange]
  )

  // Apply auto layout
  const autoLayout = useCallback(
    (direction: 'LR' | 'TB' = 'LR') => {
      const layoutedNodes = applyAutoLayout(nodes, edges, direction)
      setNodes(layoutedNodes)
      setTimeout(() => notifyChange(layoutedNodes, edges), 0)
    },
    [nodes, edges, setNodes, notifyChange]
  )

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelection({ type: 'none', id: null })
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
    setEdges((eds) => eds.map((e) => ({ ...e, selected: false })))
  }, [setNodes, setEdges])

  // Load from definition (does NOT trigger onChange to prevent loops)
  const loadDefinition = useCallback(
    (definition: MachineDefinition, applyLayout: boolean = false) => {
      let { nodes: newNodes, edges: newEdges } = definitionToFlow(definition)
      metaRef.current = definition.meta

      // Apply auto-layout if requested and no saved positions exist
      if (applyLayout && !definition.meta?._builderPositions) {
        newNodes = applyAutoLayout(newNodes, newEdges, 'LR')
      }

      setNodes(newNodes)
      setEdges(newEdges)
      setSelection({ type: 'none', id: null })
    },
    [setNodes, setEdges]
  )

  // Get current definition
  const getDefinition = useCallback((): MachineDefinition => {
    return flowToDefinition(nodes, edges, metaRef.current)
  }, [nodes, edges])

  // Validate current state
  const validate = useCallback(() => {
    return validateBuilderState(nodes, edges)
  }, [nodes, edges])

  // Get selected node
  const selectedNode = selection.type === 'state' ? nodes.find((n) => n.id === selection.id) : null

  // Get selected edge
  const selectedEdge =
    selection.type === 'transition' ? edges.find((e) => e.id === selection.id) : null

  return {
    // React Flow state
    nodes,
    edges,
    onNodesChange: handleNodesChange,
    onEdgesChange: handleEdgesChange,
    onConnect,

    // Selection
    selection,
    selectedNode,
    selectedEdge,
    clearSelection,

    // Actions
    addState,
    deleteSelected,
    renameState,
    setInitialState,
    updateTransitionEvent,
    updateTransitionGuard,
    autoLayout,

    // Definition sync
    loadDefinition,
    getDefinition,
    validate,
  }
}
