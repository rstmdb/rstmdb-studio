import type { ReactNode, ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  GitBranch,
  Server,
  Database,
  ArrowDown,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Radio,
} from 'lucide-react'
import { server, type ReplicationStatus, type ReplicaPeer } from '@/lib/api'

// ---------------------------------------------------------------------------
// Lag classification — shared meaning across the page
// ---------------------------------------------------------------------------

type LagLevel = 'synced' | 'catching' | 'behind'

function lagLevel(lagEntries: number): LagLevel {
  if (lagEntries <= 0) return 'synced'
  if (lagEntries < 1000) return 'catching'
  return 'behind'
}

const LAG_STYLES: Record<LagLevel, { dot: string; text: string; bar: string; label: string }> = {
  synced: { dot: 'bg-secondary', text: 'text-secondary', bar: 'bg-secondary', label: 'In sync' },
  catching: { dot: 'bg-warning', text: 'text-warning', bar: 'bg-warning', label: 'Catching up' },
  behind: { dot: 'bg-destructive', text: 'text-destructive', bar: 'bg-destructive', label: 'Behind' },
}

function num(n: number): string {
  return n.toLocaleString()
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  icon: Icon,
  color = 'text-primary',
}: {
  label: string
  value: ReactNode
  icon: ComponentType<{ className?: string }>
  color?: string
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center gap-3">
        <Icon className={`w-7 h-7 ${color}`} />
        <div className="min-w-0">
          <div className="text-xl font-bold truncate">{value}</div>
          <div className="text-sm text-muted">{label}</div>
        </div>
      </div>
    </div>
  )
}

function RoleBadge({ role, mode }: { role: string; mode?: string }) {
  const color =
    role === 'primary'
      ? 'bg-primary/10 text-primary border-primary/30'
      : role === 'replica'
        ? 'bg-secondary/10 text-secondary border-secondary/30'
        : 'bg-muted/10 text-muted border-border'
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold uppercase tracking-wide ${color}`}
    >
      <Radio className="w-3 h-3" />
      {role}
      {mode && <span className="opacity-70">· {mode}</span>}
    </span>
  )
}

/** Progress bar of `value / total` colored by lag level. */
function LagBar({ value, total, level }: { value: number; total: number; level: LagLevel }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 100
  return (
    <div className="h-2 w-full rounded-full bg-background overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${LAG_STYLES[level].bar}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Primary view — topology of connected replicas
// ---------------------------------------------------------------------------

function ReplicaCard({ peer, primarySeq }: { peer: ReplicaPeer; primarySeq: number }) {
  const level = lagLevel(peer.lag_entries)
  const s = LAG_STYLES[level]
  return (
    <div className="bg-surface border border-border rounded-lg p-4 w-full sm:w-72">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Database className="w-4 h-4 text-muted flex-shrink-0" />
          <span className="font-medium truncate">{peer.replica_id}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
          <span className={`w-2 h-2 rounded-full ${s.dot} ${level === 'synced' ? '' : 'animate-pulse'}`} />
          {s.label}
        </span>
      </div>

      <LagBar value={peer.last_acked_sequence} total={primarySeq} level={level} />

      <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
        <div>
          <div className="text-muted text-xs">Last acked</div>
          <div className="font-semibold tabular-nums">{num(peer.last_acked_sequence)}</div>
        </div>
        <div className="text-right">
          <div className="text-muted text-xs">Lag</div>
          <div className={`font-semibold tabular-nums ${s.text}`}>{num(peer.lag_entries)}</div>
        </div>
      </div>
    </div>
  )
}

function PrimaryView({
  status,
}: {
  status: Extract<ReplicationStatus, { role: 'primary' }>
}) {
  const behind = status.replicas.filter((r) => r.lag_entries > 0).length
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatTile label="Role" value="Primary" icon={Server} />
        <StatTile
          label="Mode"
          value={<span className="capitalize">{status.mode}</span>}
          icon={Activity}
          color={status.mode === 'sync' ? 'text-warning' : 'text-secondary'}
        />
        <StatTile label="Primary sequence" value={num(status.primary_sequence)} icon={Database} />
        <StatTile
          label="Connected replicas"
          value={status.connected_replicas}
          icon={GitBranch}
          color={behind > 0 ? 'text-warning' : 'text-secondary'}
        />
      </div>

      {/* Topology */}
      <div className="flex flex-col items-center">
        {/* Primary node */}
        <div className="bg-surface border-2 border-primary/40 rounded-lg px-6 py-4 text-center shadow-sm">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Server className="w-5 h-5" />
            <span className="font-semibold">Primary</span>
          </div>
          <div className="text-xs text-muted mt-1">
            seq {num(status.primary_sequence)} · {status.mode}
          </div>
        </div>

        {status.replicas.length > 0 ? (
          <>
            <div className="h-6 w-px bg-border" />
            <ArrowDown className="w-4 h-4 text-muted -mt-1 mb-3" />
            <div className="flex flex-wrap justify-center gap-4 w-full">
              {status.replicas.map((peer) => (
                <ReplicaCard key={peer.replica_id} peer={peer} primarySeq={status.primary_sequence} />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-6 text-center text-muted">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-warning" />
            No replicas connected.
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Replica view — this node's lag against its upstream primary
// ---------------------------------------------------------------------------

function ReplicaView({
  status,
}: {
  status: Extract<ReplicationStatus, { role: 'replica' }>
}) {
  const level = lagLevel(status.lag_entries)
  const s = LAG_STYLES[level]
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatTile label="Role" value="Replica" icon={Database} color="text-secondary" />
        <StatTile label="Upstream" value={status.upstream} icon={Server} />
        <StatTile label="Lag (entries)" value={num(status.lag_entries)} icon={GitBranch} color={s.text} />
        <StatTile
          label="Lag (seconds)"
          value={`${status.lag_seconds.toFixed(1)}s`}
          icon={Activity}
          color={s.text}
        />
      </div>

      <div className="flex flex-col items-center">
        <div className="bg-surface border border-border rounded-lg px-6 py-4 text-center">
          <div className="flex items-center justify-center gap-2 text-muted">
            <Server className="w-5 h-5" />
            <span className="font-semibold">Upstream primary</span>
          </div>
          <div className="text-xs text-muted mt-1">
            {status.upstream} · seq {num(status.primary_sequence)}
          </div>
        </div>

        <div className="h-6 w-px bg-border" />
        <div className={`flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
          <span className={`w-2 h-2 rounded-full ${s.dot} ${level === 'synced' ? '' : 'animate-pulse'}`} />
          {s.label} · {num(status.lag_entries)} behind
        </div>
        <ArrowDown className="w-4 h-4 text-muted mt-1 mb-3" />

        <div className="bg-surface border-2 border-secondary/40 rounded-lg px-6 py-4 w-full sm:w-96">
          <div className="flex items-center justify-center gap-2 text-secondary mb-3">
            <Database className="w-5 h-5" />
            <span className="font-semibold">This replica</span>
          </div>
          <LagBar value={status.last_applied_sequence} total={status.primary_sequence} level={level} />
          <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
            <div>
              <div className="text-muted text-xs">Applied</div>
              <div className="font-semibold tabular-nums">{num(status.last_applied_sequence)}</div>
            </div>
            <div className="text-right">
              <div className="text-muted text-xs">Primary</div>
              <div className="font-semibold tabular-nums">{num(status.primary_sequence)}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ReplicationPage() {
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['replication'],
    queryFn: () => server.replication(),
    refetchInterval: 2000,
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-primary" />
          Replication
        </h1>
        {data && data.role !== 'standalone' && (
          <span className="flex items-center gap-2 text-xs text-muted">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            live · every 2s
          </span>
        )}
      </div>

      {data && data.role !== 'standalone' && (
        <div className="mb-6">
          <RoleBadge role={data.role} mode={data.role === 'primary' ? data.mode : undefined} />
        </div>
      )}

      {isLoading && <div className="text-muted">Loading replication status…</div>}

      {error && (
        <div className="bg-surface border border-destructive/30 rounded-lg p-4 text-destructive flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Failed to load replication status: {(error as Error).message}
        </div>
      )}

      {data?.role === 'standalone' && (
        <div className="bg-surface border border-border rounded-lg p-10 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-muted" />
          <div className="text-lg font-semibold mb-1">Replication not configured</div>
          <p className="text-muted max-w-md mx-auto">
            This server is running in <span className="font-medium">standalone</span> mode. Start it
            with a <code className="text-foreground">primary</code> or{' '}
            <code className="text-foreground">replica</code> role to see the replication topology and
            lag here.
          </p>
        </div>
      )}

      {data?.role === 'primary' && <PrimaryView status={data} />}
      {data?.role === 'replica' && <ReplicaView status={data} />}
    </div>
  )
}
