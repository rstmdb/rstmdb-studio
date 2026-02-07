import { memo, useCallback } from 'react'
import { Plus, FolderPlus, X, Ban } from 'lucide-react'
import { ConditionRow } from './ConditionRow'
import {
  type Condition,
  type ConditionGroup,
  isCondition,
  createEmptyCondition,
  createEmptyGroup,
} from './types'

interface ConditionGroupComponentProps {
  group: ConditionGroup
  onUpdate: (group: ConditionGroup) => void
  onDelete?: () => void
  canDelete?: boolean
  isRoot?: boolean
  depth?: number
}

export const ConditionGroupComponent = memo(function ConditionGroupComponent({
  group,
  onUpdate,
  onDelete,
  canDelete = true,
  isRoot = false,
  depth = 0,
}: ConditionGroupComponentProps) {
  const handleLogicChange = useCallback((logic: 'and' | 'or') => {
    onUpdate({ ...group, logic })
  }, [group, onUpdate])

  const handleNegatedToggle = useCallback(() => {
    onUpdate({ ...group, negated: !group.negated })
  }, [group, onUpdate])

  const handleConditionChange = useCallback((updatedCondition: Condition) => {
    onUpdate({
      ...group,
      items: group.items.map(item =>
        item.id === updatedCondition.id ? updatedCondition : item
      ),
    })
  }, [group, onUpdate])

  const handleGroupChange = useCallback((updatedGroup: ConditionGroup) => {
    onUpdate({
      ...group,
      items: group.items.map(item =>
        item.id === updatedGroup.id ? updatedGroup : item
      ),
    })
  }, [group, onUpdate])

  const handleItemDelete = useCallback((id: string) => {
    if (group.items.length <= 1) return
    onUpdate({
      ...group,
      items: group.items.filter(item => item.id !== id),
    })
  }, [group, onUpdate])

  const handleAddCondition = useCallback(() => {
    onUpdate({
      ...group,
      items: [...group.items, createEmptyCondition()],
    })
  }, [group, onUpdate])

  const handleAddGroup = useCallback(() => {
    onUpdate({
      ...group,
      items: [...group.items, createEmptyGroup()],
    })
  }, [group, onUpdate])

  const borderColor = depth === 0 ? 'border-border' : depth === 1 ? 'border-primary/30' : 'border-secondary/30'

  return (
    <div
      className={`rounded-lg border ${borderColor} ${
        isRoot ? '' : 'p-3 bg-surface/50'
      }`}
    >
      {/* Group Header */}
      <div className="flex items-center gap-3 mb-3">
        {!isRoot && (
          <button
            type="button"
            onClick={handleNegatedToggle}
            className={`p-1.5 rounded transition-colors ${
              group.negated
                ? 'bg-warning/20 text-warning'
                : 'text-muted hover:text-foreground hover:bg-surface'
            }`}
            title={group.negated ? 'Remove NOT' : 'Add NOT (negate group)'}
          >
            <Ban className="w-4 h-4" />
          </button>
        )}

        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`logic-${group.id}`}
              checked={group.logic === 'and'}
              onChange={() => handleLogicChange('and')}
              className="accent-primary"
            />
            <span className={group.logic === 'and' ? 'text-foreground' : 'text-muted'}>
              All (AND)
            </span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`logic-${group.id}`}
              checked={group.logic === 'or'}
              onChange={() => handleLogicChange('or')}
              className="accent-primary"
            />
            <span className={group.logic === 'or' ? 'text-foreground' : 'text-muted'}>
              Any (OR)
            </span>
          </label>
        </div>

        <div className="flex-1" />

        {!isRoot && canDelete && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-muted hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
            title="Remove group"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Items */}
      <div className="space-y-2">
        {group.items.map((item) => (
          <div key={item.id}>
            {isCondition(item) ? (
              <ConditionRow
                condition={item}
                onChange={handleConditionChange}
                onDelete={handleItemDelete}
                canDelete={group.items.length > 1}
              />
            ) : (
              <ConditionGroupComponent
                group={item}
                onUpdate={handleGroupChange}
                onDelete={() => handleItemDelete(item.id)}
                canDelete={group.items.length > 1}
                depth={depth + 1}
              />
            )}
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div className="flex gap-3 mt-3">
        <button
          type="button"
          onClick={handleAddCondition}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Condition
        </button>
        {depth < 2 && (
          <button
            type="button"
            onClick={handleAddGroup}
            className="flex items-center gap-1 text-xs text-secondary hover:text-secondary/80 transition-colors"
          >
            <FolderPlus className="w-3 h-3" />
            Add Group
          </button>
        )}
      </div>
    </div>
  )
})
