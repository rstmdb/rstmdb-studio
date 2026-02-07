import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Clock, RefreshCw, Circle, ArrowRight } from 'lucide-react'
import { instances, machines, type HistoryEvent } from '@/lib/api'

export function InstanceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const { data: instance, isLoading } = useQuery({
    queryKey: ['instance', id],
    queryFn: () => instances.get(id!),
    enabled: !!id,
  })

  const { data: machineData } = useQuery({
    queryKey: ['machine-version', instance?.machine, instance?.version],
    queryFn: () => machines.getVersion(instance!.machine, instance!.version),
    enabled: !!instance?.machine && !!instance?.version,
  })

  const { data: historyData } = useQuery({
    queryKey: ['instance-history', id],
    queryFn: () => instances.getHistory(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-muted">Loading...</div>
      </div>
    )
  }

  if (!instance) {
    return (
      <div className="p-6">
        <div className="text-destructive">Instance not found</div>
      </div>
    )
  }

  const states = machineData?.definition.states || []
  const transitions = machineData?.definition.transitions || []
  const currentState = instance.state

  // Get available transitions from current state
  const availableTransitions = transitions.filter((t) => {
    const fromStates = Array.isArray(t.from) ? t.from : [t.from]
    return fromStates.includes(currentState) || fromStates.includes('*')
  })

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/instances"
          className="p-2 hover:bg-surface rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold font-mono">{id}</h1>
          <p className="text-muted text-sm">
            {instance.machine} v{instance.version}
          </p>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['instance', id] })
            queryClient.invalidateQueries({ queryKey: ['instance-history', id] })
          }}
          className="p-2 hover:bg-surface rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Left Column - State Machine Visualization */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current State Card */}
          <div className="bg-surface border border-border rounded-lg p-6">
            <h2 className="font-semibold mb-4 text-lg">Current State</h2>

            {/* State Machine States */}
            <div className="flex flex-wrap gap-3 mb-6">
              {states.map((state) => (
                <div
                  key={state}
                  className={`
                    px-4 py-2 rounded-lg border-2 transition-all
                    ${state === currentState
                      ? 'bg-primary/10 border-primary text-primary font-semibold shadow-lg shadow-primary/20'
                      : 'bg-surface border-border text-muted'
                    }
                    ${state === machineData?.definition.initial ? 'ring-2 ring-offset-2 ring-offset-background ring-secondary/50' : ''}
                  `}
                >
                  <div className="flex items-center gap-2">
                    {state === currentState && (
                      <Circle className="w-3 h-3 fill-primary" />
                    )}
                    {state}
                    {state === machineData?.definition.initial && (
                      <span className="text-xs text-secondary">(initial)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Available Transitions */}
            {availableTransitions.length > 0 && (
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-medium text-muted mb-3">
                  Available Transitions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {availableTransitions.map((t, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-lg text-sm"
                    >
                      <span className="font-mono font-medium text-primary">{t.event}</span>
                      <ArrowRight className="w-3 h-3 text-muted" />
                      <span className="font-mono">{t.to}</span>
                      {t.guard && (
                        <span className="text-xs bg-warning/10 text-warning px-1.5 py-0.5 rounded">
                          {t.guard}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableTransitions.length === 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-sm text-muted italic">
                  No transitions available from current state (terminal state)
                </p>
              </div>
            )}
          </div>

          {/* Context */}
          <div className="bg-surface border border-border rounded-lg p-6">
            <h2 className="font-semibold mb-4">Context</h2>
            <pre className="bg-background border border-border rounded-lg p-4 text-sm font-mono overflow-auto max-h-64">
              {JSON.stringify(instance.ctx || {}, null, 2)}
            </pre>
            <div className="mt-3 text-xs text-muted">
              WAL offset: {instance.last_wal_offset}
            </div>
          </div>
        </div>

        {/* Right Column - Event History */}
        <div className="bg-surface border border-border rounded-lg flex flex-col min-h-0">
          <div className="p-4 border-b border-border flex items-center gap-2 shrink-0">
            <Clock className="w-4 h-4" />
            <h2 className="font-semibold">Event History</h2>
            {historyData?.events && (
              <span className="text-xs text-muted ml-auto">
                {historyData.events.length} events
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {!historyData?.events?.length ? (
              <div className="p-4 text-muted text-sm">No history yet</div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

                {historyData.events.map((event, index) => (
                  <HistoryEventItem
                    key={event.offset}
                    event={event}
                    isFirst={index === 0}
                    isLast={index === historyData.events.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function HistoryEventItem({
  event,
  isFirst,
  isLast,
}: {
  event: HistoryEvent
  isFirst: boolean  // First in list = most recent event (current state)
  isLast: boolean   // Last in list = created event
}) {
  const isCreated = event.event_type === 'created'

  return (
    <div className={`relative pl-12 pr-4 py-4 ${!isLast ? 'border-b border-border/50' : ''}`}>
      {/* Timeline dot */}
      <div
        className={`
          absolute left-4 top-5 w-4 h-4 rounded-full border-2
          ${isFirst
            ? 'bg-primary border-primary shadow-lg shadow-primary/50'  // Current state (most recent)
            : isCreated
              ? 'bg-secondary border-secondary'  // Created event
              : 'bg-surface border-border'  // Past transitions
          }
        `}
      />

      <div className="space-y-1">
        {/* Event type badge and timestamp */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`
                px-2 py-0.5 text-xs font-medium rounded
                ${isCreated
                  ? 'bg-secondary/10 text-secondary'
                  : 'bg-primary/10 text-primary'
                }
              `}
            >
              {isCreated ? 'Created' : event.event}
            </span>
            {isFirst && (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-primary/20 text-primary">
                Current
              </span>
            )}
          </div>
          <span className="text-xs text-muted">
            {event.timestamp > 0
              ? new Date(event.timestamp).toLocaleString()
              : `offset: ${event.offset}`
            }
          </span>
        </div>

        {/* State transition */}
        <div className="flex items-center gap-2 text-sm">
          {event.from_state && (
            <>
              <span className="font-mono text-muted">{event.from_state}</span>
              <ArrowRight className="w-3 h-3 text-muted" />
            </>
          )}
          <span className={`font-mono ${isFirst ? 'text-primary font-medium' : ''}`}>
            {event.to_state}
          </span>
        </div>

        {/* Context changes (if any) */}
        {event.ctx && Object.keys(event.ctx).length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-muted cursor-pointer hover:text-foreground">
              Context
            </summary>
            <pre className="mt-1 p-2 bg-background rounded text-xs font-mono overflow-auto max-h-32">
              {JSON.stringify(event.ctx, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
