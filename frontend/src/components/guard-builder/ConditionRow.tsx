import { memo, useState, useEffect, useCallback } from 'react'
import { X, Ban } from 'lucide-react'
import { OPERATORS, type Condition, type Operator } from './types'

interface ConditionRowProps {
  condition: Condition
  onChange: (condition: Condition) => void
  onDelete: (id: string) => void
  canDelete: boolean
}

type ValueType = 'string' | 'number' | 'boolean' | 'null'

function detectValueType(value: unknown): ValueType {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  return 'string'
}

function formatValueForInput(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function parseValueForType(
  input: string,
  valueType: ValueType,
  operator: Operator
): string | number | boolean | null | undefined {
  const opConfig = OPERATORS.find((op) => op.value === operator)
  if (!opConfig?.needsValue) return undefined

  const isNumericOp = ['>', '>=', '<', '<='].includes(operator)
  if (isNumericOp || valueType === 'number') {
    const num = parseFloat(input)
    return isNaN(num) ? 0 : num
  }
  if (valueType === 'boolean') return input === 'true'
  if (valueType === 'null') return null
  return input
}

export const ConditionRow = memo(function ConditionRow({
  condition,
  onChange,
  onDelete,
  canDelete,
}: ConditionRowProps) {
  // Local state for text inputs - sync to parent on blur only
  const [localField, setLocalField] = useState(condition.field)
  const [localValue, setLocalValue] = useState(formatValueForInput(condition.value))

  // Sync from parent only when condition.id changes (means it's a truly different condition)
  // We use a ref to track the previous id to avoid resetting on every render
  useEffect(() => {
    setLocalField(condition.field)
    setLocalValue(formatValueForInput(condition.value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condition.id])

  const valueType = detectValueType(condition.value)
  const operatorConfig = OPERATORS.find((op) => op.value === condition.operator)
  const needsValue = operatorConfig?.needsValue ?? false
  const isNumericOperator = ['>', '>=', '<', '<='].includes(condition.operator)

  // Sync field to parent on blur
  const handleFieldBlur = useCallback(() => {
    if (localField !== condition.field) {
      onChange({ ...condition, field: localField })
    }
  }, [localField, condition, onChange])

  // Sync value to parent on blur
  const handleValueBlur = useCallback(() => {
    const parsedValue = parseValueForType(localValue, valueType, condition.operator)
    if (parsedValue !== condition.value) {
      onChange({ ...condition, value: parsedValue })
    }
  }, [localValue, valueType, condition, onChange])

  // Immediate sync for non-text changes
  const handleNegatedToggle = useCallback(() => {
    onChange({ ...condition, negated: !condition.negated })
  }, [condition, onChange])

  const handleOperatorChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOperator = e.target.value as Operator
    const newConfig = OPERATORS.find((op) => op.value === newOperator)
    const newValue = newConfig?.needsValue ? condition.value ?? '' : undefined
    // Update local state to match
    setLocalValue(formatValueForInput(newValue))
    onChange({
      ...condition,
      operator: newOperator,
      value: newValue,
    })
  }, [condition, onChange])

  const handleValueTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as ValueType
    let newValue: string | number | boolean | null
    switch (newType) {
      case 'null': newValue = null; break
      case 'boolean': newValue = true; break
      case 'number': newValue = 0; break
      default: newValue = ''
    }
    // Update local state to match
    setLocalValue(formatValueForInput(newValue))
    onChange({ ...condition, value: newValue })
  }, [condition, onChange])

  const handleBooleanChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...condition, value: e.target.value === 'true' })
  }, [condition, onChange])

  const handleDelete = useCallback(() => {
    onDelete(condition.id)
  }, [condition.id, onDelete])

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* NOT toggle */}
      <button
        type="button"
        onClick={handleNegatedToggle}
        className={`p-1.5 rounded transition-colors ${
          condition.negated
            ? 'bg-warning/20 text-warning'
            : 'text-muted hover:text-foreground hover:bg-surface'
        }`}
        title={condition.negated ? 'Remove NOT' : 'Add NOT (negate)'}
      >
        <Ban className="w-4 h-4" />
      </button>

      {/* Field prefix */}
      <span className="text-sm font-mono text-muted">ctx.</span>

      {/* Field name input - uses local state, syncs on blur */}
      <input
        type="text"
        value={localField}
        onChange={(e) => setLocalField(e.target.value)}
        onBlur={handleFieldBlur}
        placeholder="field"
        className="w-36 px-2 py-1.5 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {/* Operator select - immediate sync */}
      <select
        value={condition.operator}
        onChange={handleOperatorChange}
        className="px-2 py-1.5 bg-background border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[90px]"
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value input */}
      {needsValue && (
        <>
          {isNumericOperator ? (
            <input
              type="number"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onBlur={handleValueBlur}
              placeholder="0"
              className="w-20 px-2 py-1.5 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          ) : (
            <div className="flex gap-1">
              <select
                value={valueType}
                onChange={handleValueTypeChange}
                className="px-1 py-1.5 bg-background border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                title="Value type"
              >
                <option value="string">str</option>
                <option value="number">num</option>
                <option value="boolean">bool</option>
                <option value="null">null</option>
              </select>

              {valueType === 'boolean' ? (
                <select
                  value={String(condition.value)}
                  onChange={handleBooleanChange}
                  className="w-16 px-2 py-1.5 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : valueType === 'null' ? (
                <input
                  type="text"
                  value="null"
                  disabled
                  className="w-16 px-2 py-1.5 bg-background border border-border rounded text-sm font-mono text-muted"
                />
              ) : valueType === 'number' ? (
                <input
                  type="number"
                  value={localValue}
                  onChange={(e) => setLocalValue(e.target.value)}
                  onBlur={handleValueBlur}
                  placeholder="0"
                  className="w-20 px-2 py-1.5 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              ) : (
                <input
                  type="text"
                  value={localValue}
                  onChange={(e) => setLocalValue(e.target.value)}
                  onBlur={handleValueBlur}
                  placeholder="value"
                  className="w-24 px-2 py-1.5 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Delete button */}
      <button
        type="button"
        onClick={handleDelete}
        disabled={!canDelete}
        className={`p-1 rounded transition-colors ${
          canDelete
            ? 'text-muted hover:text-destructive hover:bg-destructive/10'
            : 'text-muted/30 cursor-not-allowed'
        }`}
        title={canDelete ? 'Remove condition' : 'At least one condition required'}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
})
