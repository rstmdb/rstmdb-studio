import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Workflow } from 'lucide-react'
import { machines } from '@/lib/api'

export function MachinesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['machines'],
    queryFn: () => machines.list(),
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">State Machines</h1>
        <Link
          to="/create-machine"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Machine
        </Link>
      </div>

      {isLoading ? (
        <div className="text-muted">Loading...</div>
      ) : error ? (
        <div className="text-destructive">
          Error: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-12">
          <Workflow className="w-12 h-12 text-muted mx-auto mb-4" />
          <p className="text-muted">No state machines registered yet</p>
          <Link
            to="/create-machine"
            className="inline-block mt-4 text-primary hover:underline"
          >
            Create your first machine
          </Link>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Versions</th>
                <th className="text-left px-4 py-3 font-medium">Latest</th>
                <th className="text-center px-4 py-3 font-medium">States</th>
                <th className="text-center px-4 py-3 font-medium">Transitions</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((machine) => (
                <tr
                  key={machine.machine}
                  className="border-b border-border last:border-0 hover:bg-surface/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/machines/${machine.machine}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {machine.machine}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {machine.versions.length} version
                    {machine.versions.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">
                      v{machine.latest_version}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-muted">
                    {machine.states_count}
                  </td>
                  <td className="px-4 py-3 text-center text-muted">
                    {machine.transitions_count}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/machines/${machine.machine}`}
                      className="text-sm text-muted hover:text-foreground"
                    >
                      View
                    </Link>
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
