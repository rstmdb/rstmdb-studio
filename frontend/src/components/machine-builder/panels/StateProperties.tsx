import { useState } from 'react'
import { Circle, Trash2 } from 'lucide-react'
import type { StateNode, TransitionEdge } from '../../../lib/machine-builder/types'

interface StatePropertiesProps {
  node: StateNode
  edges: TransitionEdge[]
  onRename: (newName: string) => void
  onSetInitial: () => void
  onDelete: () => void
}

function StatePropertiesContent({
  node,
  edges,
  onRename,
  onSetInitial,
  onDelete,
}: StatePropertiesProps) {
  const [name, setName] = useState(node.data.label)

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
  }

  const handleNameBlur = () => {
    if (name.trim() && name !== node.data.label) {
      onRename(name.trim())
    } else {
      setName(node.data.label)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameBlur()
    } else if (e.key === 'Escape') {
      setName(node.data.label)
    }
  }

  // Get transitions for this state
  const outgoingTransitions = edges.filter((e) => e.source === node.id)
  const incomingTransitions = edges.filter((e) => e.target === node.id)

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">
        State Properties
      </h3>

      {/* State Name */}
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          onBlur={handleNameBlur}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Initial State Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-2">
          <Circle className={`w-4 h-4 ${node.data.isInitial ? 'text-secondary fill-secondary' : 'text-muted'}`} />
          Initial State
        </label>
        <button
          onClick={onSetInitial}
          disabled={node.data.isInitial}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            node.data.isInitial
              ? 'bg-secondary/20 text-secondary cursor-not-allowed'
              : 'bg-background border border-border hover:bg-surface'
          }`}
        >
          {node.data.isInitial ? 'Current' : 'Set Initial'}
        </button>
      </div>

      {/* Transitions Summary */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted">Transitions</h4>

        {outgoingTransitions.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-muted">Outgoing:</span>
            {outgoingTransitions.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 px-2 py-1 bg-background rounded text-xs"
              >
                <span className="font-medium text-primary">{t.data?.event}</span>
                <span className="text-muted">→</span>
                <span>{t.target}</span>
              </div>
            ))}
          </div>
        )}

        {incomingTransitions.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-muted">Incoming:</span>
            {incomingTransitions.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 px-2 py-1 bg-background rounded text-xs"
              >
                <span>{t.source}</span>
                <span className="text-muted">→</span>
                <span className="font-medium text-primary">{t.data?.event}</span>
              </div>
            ))}
          </div>
        )}

        {outgoingTransitions.length === 0 && incomingTransitions.length === 0 && (
          <p className="text-xs text-muted italic">No transitions</p>
        )}
      </div>

      {/* Delete Button */}
      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/20 transition-colors text-sm"
      >
        <Trash2 className="w-4 h-4" />
        Delete State
      </button>
    </div>
  )
}

export function StateProperties(props: StatePropertiesProps) {
  // Use key to reset state when node changes
  return <StatePropertiesContent key={props.node.id} {...props} />
}
