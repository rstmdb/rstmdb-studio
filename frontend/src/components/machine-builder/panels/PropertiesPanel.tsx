import { X, Box, GitBranch, AlertCircle, CheckCircle } from 'lucide-react'
import type { StateNode, TransitionEdge, Selection } from '../../../lib/machine-builder/types'
import { StateProperties } from './StateProperties'
import { TransitionProperties } from './TransitionProperties'

interface PropertiesPanelProps {
  selection: Selection
  nodes: StateNode[]
  edges: TransitionEdge[]
  selectedNode: StateNode | null
  selectedEdge: TransitionEdge | null
  onClose: () => void
  onRenameState: (nodeId: string, newName: string) => void
  onSetInitial: (nodeId: string) => void
  onUpdateTransitionEvent: (edgeId: string, event: string) => void
  onUpdateTransitionGuard: (edgeId: string, guard: string | undefined) => void
  onDelete: () => void
  validationErrors: string[]
  validationWarnings: string[]
}

export function PropertiesPanel({
  selection,
  nodes,
  edges,
  selectedNode,
  selectedEdge,
  onClose,
  onRenameState,
  onSetInitial,
  onUpdateTransitionEvent,
  onUpdateTransitionGuard,
  onDelete,
  validationErrors,
  validationWarnings,
}: PropertiesPanelProps) {
  const hasValidation = validationErrors.length > 0 || validationWarnings.length > 0

  return (
    <div className="w-72 bg-surface border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Properties</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-background rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {selection.type === 'state' && selectedNode && (
          <StateProperties
            node={selectedNode}
            edges={edges}
            onRename={(newName) => onRenameState(selectedNode.id, newName)}
            onSetInitial={() => onSetInitial(selectedNode.id)}
            onDelete={onDelete}
          />
        )}

        {selection.type === 'transition' && selectedEdge && (
          <TransitionProperties
            edge={selectedEdge}
            nodes={nodes}
            onUpdateEvent={(event) => onUpdateTransitionEvent(selectedEdge.id, event)}
            onUpdateGuard={(guard) => onUpdateTransitionGuard(selectedEdge.id, guard)}
            onDelete={onDelete}
          />
        )}

        {selection.type === 'none' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">
              Machine Overview
            </h3>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="px-3 py-2 bg-background rounded-lg">
                <div className="flex items-center gap-2 text-muted mb-1">
                  <Box className="w-4 h-4" />
                  <span className="text-xs">States</span>
                </div>
                <span className="text-lg font-semibold">{nodes.length}</span>
              </div>
              <div className="px-3 py-2 bg-background rounded-lg">
                <div className="flex items-center gap-2 text-muted mb-1">
                  <GitBranch className="w-4 h-4" />
                  <span className="text-xs">Transitions</span>
                </div>
                <span className="text-lg font-semibold">{edges.length}</span>
              </div>
            </div>

            {/* Initial State */}
            {nodes.length > 0 && (
              <div className="px-3 py-2 bg-background rounded-lg">
                <div className="text-xs text-muted mb-1">Initial State</div>
                <span className="font-medium">
                  {nodes.find((n) => n.data.isInitial)?.data.label || 'Not set'}
                </span>
              </div>
            )}

            {/* States List */}
            {nodes.length > 0 && (
              <div>
                <div className="text-xs text-muted mb-2">States</div>
                <div className="space-y-1">
                  {nodes.map((node) => (
                    <div
                      key={node.id}
                      className="flex items-center gap-2 px-2 py-1 bg-background rounded text-sm"
                    >
                      {node.data.isInitial && (
                        <span className="w-2 h-2 rounded-full bg-secondary" />
                      )}
                      <span className={node.data.isInitial ? 'font-medium' : ''}>
                        {node.data.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Validation Status */}
            {hasValidation && (
              <div className="space-y-2">
                <div className="text-xs text-muted">Validation</div>

                {validationErrors.map((error, i) => (
                  <div
                    key={`error-${i}`}
                    className="flex items-start gap-2 px-2 py-1.5 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive"
                  >
                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                ))}

                {validationWarnings.map((warning, i) => (
                  <div
                    key={`warning-${i}`}
                    className="flex items-start gap-2 px-2 py-1.5 bg-warning/10 border border-warning/30 rounded text-xs text-warning"
                  >
                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}

            {!hasValidation && nodes.length > 0 && (
              <div className="flex items-center gap-2 px-2 py-1.5 bg-secondary/10 border border-secondary/30 rounded text-xs text-secondary">
                <CheckCircle className="w-3 h-3" />
                <span>Machine is valid</span>
              </div>
            )}

            {/* Help */}
            <div className="text-xs text-muted space-y-1 pt-4 border-t border-border">
              <p><strong>Tips:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Click and drag between states to create transitions</li>
                <li>Double-click a state to rename it</li>
                <li>Select a state or transition to edit its properties</li>
                <li>Press Delete or Backspace to remove selected items</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
