import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Box, Filter } from 'lucide-react'
import { instances, machines } from '@/lib/api'

export function InstancesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const selectedMachine = searchParams.get('machine') || ''
  const selectedState = searchParams.get('state') || ''

  const { data: machinesData } = useQuery({
    queryKey: ['machines'],
    queryFn: () => machines.list(),
  })

  // Auto-select first machine if none selected
  useEffect(() => {
    if (!selectedMachine && machinesData?.items.length) {
      setSearchParams({ machine: machinesData.items[0].machine })
    }
  }, [machinesData, selectedMachine, setSearchParams])

  const { data, isLoading, error } = useQuery({
    queryKey: ['instances', selectedMachine, selectedState],
    queryFn: () => instances.list(selectedMachine, { state: selectedState || undefined }),
    enabled: !!selectedMachine,
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Instances</h1>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted" />
          <span className="text-sm text-muted">Filter:</span>
        </div>
        <select
          value={selectedMachine}
          onChange={(e) => setSearchParams({ machine: e.target.value, state: selectedState })}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-sm"
        >
          <option value="">Select machine...</option>
          {machinesData?.items.map((m) => (
            <option key={m.machine} value={m.machine}>
              {m.machine}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by state..."
          value={selectedState}
          onChange={(e) => setSearchParams({ machine: selectedMachine, state: e.target.value })}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-sm w-40"
        />
        {data && (
          <span className="text-sm text-muted ml-auto">
            {data.total} instance{data.total !== 1 ? 's' : ''}
            {data.has_more && ' (more available)'}
          </span>
        )}
      </div>

      {!selectedMachine ? (
        <div className="text-center py-12">
          <Box className="w-12 h-12 text-muted mx-auto mb-4" />
          <p className="text-muted">Select a machine to view instances</p>
        </div>
      ) : isLoading ? (
        <div className="text-muted">Loading...</div>
      ) : error ? (
        <div className="text-destructive">
          Error: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-12">
          <Box className="w-12 h-12 text-muted mx-auto mb-4" />
          <p className="text-muted">No instances for {selectedMachine}</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium">Instance ID</th>
                <th className="text-left px-4 py-3 font-medium">Machine</th>
                <th className="text-left px-4 py-3 font-medium">State</th>
                <th className="text-left px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((instance) => (
                <tr
                  key={instance.id}
                  className="border-b border-border last:border-0 hover:bg-surface/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/instances/${instance.id}`}
                      className="font-mono text-sm text-primary hover:underline"
                    >
                      {instance.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {instance.machine} v{instance.version}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-secondary/10 text-secondary text-xs rounded">
                      {instance.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted">
                    {new Date(instance.updated_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
