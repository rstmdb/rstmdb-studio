import { useQuery } from '@tanstack/react-query'
import { Workflow, Box, ScrollText, Zap, HardDrive, Database } from 'lucide-react'
import { Link } from 'react-router-dom'
import { machines, wal, server } from '@/lib/api'

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`
  }
  return `${bytes} B`
}

export function DashboardPage() {
  const { data: machinesData } = useQuery({
    queryKey: ['machines'],
    queryFn: () => machines.list(),
  })

  const { data: walStats } = useQuery({
    queryKey: ['wal-stats'],
    queryFn: () => wal.stats(),
    refetchInterval: 10000,
  })

  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: () => server.health(),
    refetchInterval: 5000,
  })

  const stats = [
    {
      label: 'Machines',
      value: machinesData?.items.length ?? '-',
      icon: Workflow,
      href: '/machines',
      color: 'text-primary',
    },
    {
      label: 'WAL Entries',
      value: walStats?.entry_count?.toLocaleString() ?? '-',
      icon: ScrollText,
      href: '/wal',
      color: 'text-warning',
    },
    {
      label: 'WAL Size',
      value: walStats ? formatBytes(walStats.total_size_bytes) : '-',
      icon: HardDrive,
      href: '/wal',
      color: 'text-secondary',
    },
    {
      label: 'Latency',
      value: healthData ? `${healthData.latency_ms}ms` : '-',
      icon: Zap,
      href: '#',
      color: 'text-muted',
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.href}
            className="bg-surface border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <stat.icon className={`w-8 h-8 ${stat.color}`} />
              <div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-sm text-muted">{stat.label}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* WAL I/O Stats */}
      {walStats && (
        <div className="bg-surface border border-border rounded-lg mb-8">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <Database className="w-5 h-5" />
              WAL Statistics
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <div className="text-sm text-muted">Segments</div>
                <div className="text-xl font-semibold">{walStats.segment_count}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Bytes Written</div>
                <div className="text-xl font-semibold">{formatBytes(walStats.io_stats.bytes_written)}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Bytes Read</div>
                <div className="text-xl font-semibold">{formatBytes(walStats.io_stats.bytes_read)}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Writes</div>
                <div className="text-xl font-semibold">{walStats.io_stats.writes.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Reads</div>
                <div className="text-xl font-semibold">{walStats.io_stats.reads.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Fsyncs</div>
                <div className="text-xl font-semibold">{walStats.io_stats.fsyncs.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Machines Overview */}
      {machinesData && machinesData.items.length > 0 && (
        <div className="bg-surface border border-border rounded-lg mb-8">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <Workflow className="w-5 h-5" />
              Machines
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {machinesData.items.map((machine) => (
                <Link
                  key={machine.machine}
                  to={`/machines/${machine.machine}`}
                  className="flex items-center gap-3 p-3 bg-background rounded-lg hover:bg-background/80 transition-colors"
                >
                  <Box className="w-8 h-8 text-primary" />
                  <div>
                    <div className="font-medium">{machine.machine}</div>
                    <div className="text-sm text-muted">
                      {machine.versions.length} version{machine.versions.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
