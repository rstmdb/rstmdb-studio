import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router-dom'
import { ScrollText, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { wal } from '@/lib/api'

export function WalPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedEntry, setSelectedEntry] = useState<number | null>(null)

  const from = searchParams.get('from') ? Number(searchParams.get('from')) : undefined
  const limit = 50

  const { data, isLoading, error } = useQuery({
    queryKey: ['wal', from, limit],
    queryFn: () => wal.list({ from, limit }),
  })

  const { data: entryDetail } = useQuery({
    queryKey: ['wal-entry', selectedEntry],
    queryFn: () => wal.get(selectedEntry!),
    enabled: selectedEntry !== null,
  })

  const goToOffset = (offset: number) => {
    if (offset === 0) {
      setSearchParams({})
    } else {
      setSearchParams({ from: String(offset) })
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Write-Ahead Log</h1>
      </div>

      {isLoading ? (
        <div className="text-muted">Loading...</div>
      ) : error ? (
        <div className="text-destructive">
          Error: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      ) : data?.records.length === 0 ? (
        <div className="text-center py-12">
          <ScrollText className="w-12 h-12 text-muted mx-auto mb-4" />
          <p className="text-muted">No WAL entries found</p>
          {from !== undefined && from > 0 && (
            <button
              onClick={() => setSearchParams({})}
              className="mt-4 text-primary hover:underline"
            >
              Go to start
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Entry List */}
          <div className="flex-1 bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left px-4 py-3 font-medium w-20">Seq</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Instance</th>
                  <th className="text-left px-4 py-3 font-medium">Machine</th>
                </tr>
              </thead>
              <tbody>
                {data?.records.map((entry) => (
                  <tr
                    key={entry.offset}
                    onClick={() => setSelectedEntry(entry.offset)}
                    className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                      selectedEntry === entry.offset
                        ? 'bg-primary/10'
                        : 'hover:bg-surface/50'
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-sm text-muted">
                      #{entry.sequence}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          entry.entry_type === 'apply_event'
                            ? 'bg-primary/10 text-primary'
                            : entry.entry_type === 'create_instance'
                            ? 'bg-secondary/10 text-secondary'
                            : entry.entry_type === 'delete_instance'
                            ? 'bg-destructive/10 text-destructive'
                            : entry.entry_type === 'put_machine'
                            ? 'bg-warning/10 text-warning'
                            : 'bg-muted/10 text-muted'
                        }`}
                      >
                        {entry.entry_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">
                      {entry.instance_id ? (
                        <Link
                          to={`/instances/${entry.instance_id}`}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {entry.instance_id.substring(0, 8)}...
                        </Link>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {entry.machine ? (
                        <Link
                          to={`/machines/${entry.machine}`}
                          className="hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {entry.machine}
                          {entry.version && ` v${entry.version}`}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background/50">
              <button
                onClick={() => {
                  if (data?.records[0]) {
                    const firstOffset = data.records[0].offset
                    goToOffset(Math.max(0, firstOffset - limit))
                  }
                }}
                disabled={!from || from === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <span className="text-sm text-muted">
                Showing {data?.records.length} entries
                {from !== undefined && ` from offset ${from}`}
              </span>

              <button
                onClick={() => {
                  if (data?.next_offset) {
                    goToOffset(data.next_offset)
                  }
                }}
                disabled={!data?.next_offset}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Entry Detail Panel */}
          {selectedEntry !== null && (
            <div className="w-96 bg-surface border border-border rounded-lg">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold">Entry Details</h3>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="p-1 hover:bg-background rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {entryDetail ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted">Sequence:</span>
                        <div className="font-mono">#{entryDetail.sequence}</div>
                      </div>
                      <div>
                        <span className="text-muted">Offset:</span>
                        <div className="font-mono">{entryDetail.offset}</div>
                      </div>
                    </div>

                    <div>
                      <span className="text-sm text-muted">Full Entry:</span>
                      <pre className="mt-1 bg-background border border-border rounded p-3 text-xs font-mono overflow-auto max-h-96">
                        {JSON.stringify(entryDetail.entry, null, 2)}
                      </pre>
                    </div>
                  </>
                ) : (
                  <div className="text-muted text-sm">Loading...</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
