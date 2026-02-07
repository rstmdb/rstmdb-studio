import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import type { TransitionEdgeData } from '../../../lib/machine-builder/types'

interface TransitionEdgeProps extends EdgeProps {
  data?: TransitionEdgeData
}

function TransitionEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: TransitionEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const event = data?.event || 'event'
  const guard = data?.guard

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={`
          !stroke-2 transition-all
          ${selected ? '!stroke-primary' : '!stroke-muted'}
        `}
        markerEnd="url(#arrow)"
      />
      <EdgeLabelRenderer>
        <div
          className={`
            absolute pointer-events-auto cursor-pointer
            transform -translate-x-1/2 -translate-y-1/2
            transition-all
          `}
          style={{
            left: labelX,
            top: labelY,
          }}
        >
          {/* Event name label */}
          <div
            className={`
              px-2 py-1 rounded text-xs font-medium
              ${selected
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-foreground'
              }
            `}
          >
            {event}
          </div>

          {/* Guard badge */}
          {guard && (
            <div
              className={`
                mt-1 px-2 py-0.5 rounded text-[10px] text-center
                ${selected
                  ? 'bg-primary/50 text-white'
                  : 'bg-warning/20 text-warning border border-warning/30'
                }
              `}
            >
              {guard.length > 20 ? `${guard.slice(0, 20)}...` : guard}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const TransitionEdge = memo(TransitionEdgeComponent)
