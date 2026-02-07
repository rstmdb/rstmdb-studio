import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { MachineDefinition } from '../../lib/api'
import type { ViewMode } from '../../lib/machine-builder/types'
import { BuilderCanvas } from './canvas/BuilderCanvas'
import { ToolbarPanel } from './panels/ToolbarPanel'
import { PropertiesPanel } from './panels/PropertiesPanel'
import { useMachineBuilder } from './hooks/useMachineBuilder'

interface MachineBuilderProps {
  definition?: MachineDefinition
  onChange?: (definition: MachineDefinition) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export function MachineBuilder({
  definition,
  onChange,
  viewMode,
  onViewModeChange,
}: MachineBuilderProps) {
  // Track view mode and the definition we last sent via onChange
  const prevViewModeRef = useRef(viewMode)
  const lastSentDefinitionRef = useRef<string | null>(null)

  // Wrap onChange to track what we send
  const wrappedOnChange = useCallback(
    (def: MachineDefinition) => {
      lastSentDefinitionRef.current = JSON.stringify(def)
      onChange?.(def)
    },
    [onChange]
  )

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selection,
    selectedNode,
    selectedEdge,
    clearSelection,
    addState,
    deleteSelected,
    renameState,
    setInitialState,
    updateTransitionEvent,
    updateTransitionGuard,
    autoLayout,
    loadDefinition,
    validate,
  } = useMachineBuilder({
    initialDefinition: definition,
    onChange: wrappedOnChange,
  })

  // Load definition on:
  // 1. External definition change (definition differs from what we last sent)
  // 2. Switching FROM json TO visual view
  useEffect(() => {
    if (!definition) return

    const isSwitchingToVisual = prevViewModeRef.current === 'json' && viewMode === 'visual'
    const definitionJson = JSON.stringify(definition)
    const isExternalChange = lastSentDefinitionRef.current !== definitionJson

    if (isExternalChange || isSwitchingToVisual) {
      // Apply auto-layout for external loads (loadDefinition handles the position check internally)
      loadDefinition(definition, true)
    }

    prevViewModeRef.current = viewMode
  }, [viewMode, definition, loadDefinition])

  // Validation
  const validation = useMemo(() => validate(), [validate])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected element
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.type !== 'none') {
        // Don't delete if user is typing in an input
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA'
        ) {
          return
        }
        e.preventDefault()
        deleteSelected()
      }

      // Escape to clear selection
      if (e.key === 'Escape') {
        clearSelection()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selection, deleteSelected, clearSelection])

  const handleAddState = useCallback(() => {
    addState()
  }, [addState])

  const handleAutoLayout = useCallback(() => {
    autoLayout('LR')
  }, [autoLayout])

  const handleDelete = useCallback(() => {
    deleteSelected()
  }, [deleteSelected])

  const handlePaneClick = useCallback(() => {
    clearSelection()
  }, [clearSelection])

  const handleNodeRename = useCallback(
    (nodeId: string, newName: string) => {
      renameState(nodeId, newName)
    },
    [renameState]
  )

  const canDelete = selection.type !== 'none'

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border border-border overflow-hidden">
      {/* Toolbar */}
      <ToolbarPanel
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        onAddState={handleAddState}
        onAutoLayout={handleAutoLayout}
        onDelete={handleDelete}
        hasSelection={selection.type !== 'none'}
        canDelete={canDelete}
      />

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div className="flex-1 relative">
          <BuilderCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneClick={handlePaneClick}
            onNodeRename={handleNodeRename}
          />
        </div>

        {/* Properties Panel */}
        <PropertiesPanel
          selection={selection}
          nodes={nodes}
          edges={edges}
          selectedNode={selectedNode ?? null}
          selectedEdge={selectedEdge ?? null}
          onClose={clearSelection}
          onRenameState={renameState}
          onSetInitial={setInitialState}
          onUpdateTransitionEvent={updateTransitionEvent}
          onUpdateTransitionGuard={updateTransitionGuard}
          onDelete={deleteSelected}
          validationErrors={validation.errors}
          validationWarnings={validation.warnings}
        />
      </div>
    </div>
  )
}
