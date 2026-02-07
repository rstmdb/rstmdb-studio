import { Plus, LayoutGrid, Eye, Code, Trash2 } from 'lucide-react'
import type { ViewMode } from '../../../lib/machine-builder/types'

interface ToolbarPanelProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onAddState: () => void
  onAutoLayout: () => void
  onDelete: () => void
  hasSelection: boolean
  canDelete: boolean
}

export function ToolbarPanel({
  viewMode,
  onViewModeChange,
  onAddState,
  onAutoLayout,
  onDelete,
  hasSelection,
  canDelete,
}: ToolbarPanelProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border">
      <div className="flex items-center gap-2">
        {/* Add State */}
        <button
          onClick={onAddState}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add State
        </button>

        {/* Auto Layout */}
        <button
          onClick={onAutoLayout}
          className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-lg hover:bg-surface transition-colors text-sm"
        >
          <LayoutGrid className="w-4 h-4" />
          Auto-layout
        </button>

        {/* Delete */}
        {hasSelection && canDelete && (
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/20 transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        )}
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => onViewModeChange('visual')}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
            viewMode === 'visual'
              ? 'bg-primary text-white'
              : 'bg-background hover:bg-surface text-foreground'
          }`}
        >
          <Eye className="w-4 h-4" />
          Visual
        </button>
        <button
          onClick={() => onViewModeChange('json')}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
            viewMode === 'json'
              ? 'bg-primary text-white'
              : 'bg-background hover:bg-surface text-foreground'
          }`}
        >
          <Code className="w-4 h-4" />
          JSON
        </button>
      </div>
    </div>
  )
}
