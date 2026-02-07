import { useState } from 'react'
import { ArrowRight, Trash2, Shield, Pencil } from 'lucide-react'
import type { StateNode, TransitionEdge } from '../../../lib/machine-builder/types'
import { GuardBuilderModal } from '../../guard-builder'

interface TransitionPropertiesProps {
  edge: TransitionEdge
  nodes: StateNode[]
  onUpdateEvent: (event: string) => void
  onUpdateGuard: (guard: string | undefined) => void
  onDelete: () => void
}

function TransitionPropertiesContent({
  edge,
  nodes,
  onUpdateEvent,
  onUpdateGuard,
  onDelete,
}: TransitionPropertiesProps) {
  const [event, setEvent] = useState(edge.data?.event || '')
  const [guard, setGuard] = useState(edge.data?.guard || '')
  const [isGuardModalOpen, setIsGuardModalOpen] = useState(false)

  const handleEventBlur = () => {
    if (event.trim() && event !== edge.data?.event) {
      onUpdateEvent(event.trim())
    } else if (!event.trim()) {
      setEvent(edge.data?.event || 'event')
    }
  }

  const handleEventKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleEventBlur()
    if (e.key === 'Escape') setEvent(edge.data?.event || '')
  }

  const handleGuardSave = (value: string | undefined) => {
    setGuard(value || '')
    onUpdateGuard(value)
  }

  const sourceNode = nodes.find((n) => n.id === edge.source)
  const targetNode = nodes.find((n) => n.id === edge.target)

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">
        Transition Properties
      </h3>

      {/* Transition Overview */}
      <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-lg text-sm">
        <span className="font-medium">{sourceNode?.data.label || edge.source}</span>
        <ArrowRight className="w-4 h-4 text-muted" />
        <span className="font-medium">{targetNode?.data.label || edge.target}</span>
      </div>

      {/* Event Name */}
      <div>
        <label className="block text-sm font-medium mb-1">Event Name</label>
        <input
          type="text"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          onBlur={handleEventBlur}
          onKeyDown={handleEventKeyDown}
          placeholder="event_name"
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="mt-1 text-xs text-muted">
          The event that triggers this transition
        </p>
      </div>

      {/* Guard Expression */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium mb-2">
          <Shield className="w-4 h-4 text-warning" />
          Guard Expression
        </label>

        {guard ? (
          <div className="space-y-2">
            <div className="px-3 py-2 bg-background border border-border rounded-lg">
              <code className="text-sm font-mono text-foreground break-all">{guard}</code>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsGuardModalOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-surface transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => handleGuardSave(undefined)}
                className="px-3 py-2 text-sm text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsGuardModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm border border-dashed border-border rounded-lg hover:bg-surface hover:border-primary/50 transition-colors text-muted hover:text-foreground"
          >
            <Shield className="w-4 h-4" />
            Add Guard Condition
          </button>
        )}

        <p className="mt-2 text-xs text-muted">
          Optional condition that must be true for the transition to occur
        </p>
      </div>

      {/* Delete Button */}
      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/20 transition-colors text-sm"
      >
        <Trash2 className="w-4 h-4" />
        Delete Transition
      </button>

      {/* Guard Builder Modal */}
      <GuardBuilderModal
        isOpen={isGuardModalOpen}
        onClose={() => setIsGuardModalOpen(false)}
        value={guard || undefined}
        onSave={handleGuardSave}
      />
    </div>
  )
}

export function TransitionProperties(props: TransitionPropertiesProps) {
  // Use key to reset state when edge changes
  return <TransitionPropertiesContent key={props.edge.id} {...props} />
}
