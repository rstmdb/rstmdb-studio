import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { StateNodeData } from '../../../lib/machine-builder/types'

interface StateNodeProps extends NodeProps {
  data: StateNodeData
}

function StateNodeComponent({ id, data, selected }: StateNodeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(data.label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleDoubleClick = useCallback(() => {
    setEditValue(data.label)
    setIsEditing(true)
  }, [data.label])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    // Emit custom event for the builder to handle
    const event = new CustomEvent('stateRename', {
      detail: { nodeId: id, newName: editValue.trim() || data.label },
    })
    window.dispatchEvent(event)
  }, [id, editValue, data.label])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleBlur()
      } else if (e.key === 'Escape') {
        setEditValue(data.label)
        setIsEditing(false)
      }
    },
    [handleBlur, data.label]
  )

  return (
    <div
      className={`
        relative px-4 py-3 rounded-lg border-2 min-w-[120px] text-center
        transition-all duration-150
        ${selected
          ? 'border-primary bg-primary/20 shadow-lg shadow-primary/20'
          : 'border-border bg-surface hover:border-muted'
        }
        ${data.isInitial ? 'ring-2 ring-secondary ring-offset-2 ring-offset-background' : ''}
      `}
      onDoubleClick={handleDoubleClick}
    >
      {/* Initial state indicator */}
      {data.isInitial && (
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-secondary" />
      )}

      {/* State name */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-center text-sm font-medium outline-none border-b border-primary"
        />
      ) : (
        <span className="text-sm font-medium text-foreground truncate block">
          {data.label}
        </span>
      )}

      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-muted !border-2 !border-surface hover:!bg-primary transition-colors"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-muted !border-2 !border-surface hover:!bg-primary transition-colors"
      />
    </div>
  )
}

export const StateNode = memo(StateNodeComponent)
