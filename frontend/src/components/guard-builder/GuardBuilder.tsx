import { useState, useCallback } from 'react'
import { Code, Layers } from 'lucide-react'
import { ConditionGroupComponent } from './ConditionGroupComponent'
import {
  type Condition,
  type ConditionGroup,
  type GuardItem,
  isCondition,
  createEmptyCondition,
  generateId,
} from './types'

interface GuardBuilderProps {
  value: string | undefined
  onChange: (value: string | undefined) => void
}

function conditionToString(c: Condition): string {
  const field = `ctx.${c.field}`
  let expr: string

  switch (c.operator) {
    case 'exists':
      expr = field
      break
    case 'not_exists':
      expr = `!${field}`
      break
    case '==':
      expr = `${field} == ${formatValue(c.value)}`
      break
    case '!=':
      expr = `${field} != ${formatValue(c.value)}`
      break
    case '>':
      expr = `${field} > ${c.value}`
      break
    case '>=':
      expr = `${field} >= ${c.value}`
      break
    case '<':
      expr = `${field} < ${c.value}`
      break
    case '<=':
      expr = `${field} <= ${c.value}`
      break
    default:
      expr = field
  }

  if (c.negated) {
    return `!(${expr})`
  }
  return expr
}

function formatValue(v: unknown): string {
  if (v === null) return 'null'
  if (typeof v === 'string') return `"${v}"`
  if (typeof v === 'boolean') return String(v)
  return String(v)
}

function itemToString(item: GuardItem): string {
  if (isCondition(item)) {
    return conditionToString(item)
  } else {
    return groupToString(item)
  }
}

function groupToString(group: ConditionGroup): string {
  const validItems = group.items.filter((item) => {
    if (isCondition(item)) {
      return item.field.trim() !== ''
    }
    return true
  })

  if (validItems.length === 0) return ''

  const parts = validItems.map((item) => itemToString(item))
  const joiner = group.logic === 'and' ? ' && ' : ' || '
  let expr = parts.join(joiner)

  // Wrap in parentheses if multiple items or negated
  if ((validItems.length > 1 || group.negated) && !isRootWithSingleCondition(group)) {
    expr = `(${expr})`
  }

  if (group.negated) {
    expr = `!${expr}`
  }

  return expr
}

function isRootWithSingleCondition(group: ConditionGroup): boolean {
  return group.items.length === 1 && isCondition(group.items[0]) && !group.negated
}

function generateExpression(group: ConditionGroup): string {
  const validItems = group.items.filter((item) => {
    if (isCondition(item)) {
      return item.field.trim() !== ''
    }
    return hasValidConditions(item)
  })

  if (validItems.length === 0) return ''

  const parts = validItems.map((item) => itemToString(item))
  const joiner = group.logic === 'and' ? ' && ' : ' || '
  let expr = parts.join(joiner)

  if (group.negated) {
    expr = `!(${expr})`
  }

  return expr
}

function hasValidConditions(group: ConditionGroup): boolean {
  return group.items.some((item) => {
    if (isCondition(item)) {
      return item.field.trim() !== ''
    }
    return hasValidConditions(item)
  })
}

// Parsing existing expressions
function parseExpression(expr: string): ConditionGroup | null {
  if (!expr.trim()) return null

  try {
    const hasAnd = expr.includes('&&')
    const hasOr = expr.includes('||')

    // Can't parse mixed AND/OR without proper parentheses handling
    if (hasAnd && hasOr && !expr.includes('(')) return null

    const logic: 'and' | 'or' = hasOr && !hasAnd ? 'or' : 'and'
    const separator = logic === 'or' ? '||' : '&&'
    const parts = expr.split(separator).map((p) => p.trim())

    const items: Condition[] = []

    for (const part of parts) {
      const condition = parseCondition(part)
      if (!condition) return null
      items.push(condition)
    }

    return {
      id: generateId(),
      type: 'group',
      logic,
      items,
    }
  } catch {
    return null
  }
}

function parseCondition(part: string): Condition | null {
  const id = generateId()
  let negated = false
  let expr = part.trim()

  // Check for negation
  if (expr.startsWith('!(') && expr.endsWith(')')) {
    negated = true
    expr = expr.slice(2, -1)
  }

  // !ctx.field (not exists)
  const notExistsMatch = expr.match(/^!ctx\.(\w+(?:\.\w+)*)$/)
  if (notExistsMatch) {
    return { id, type: 'condition', field: notExistsMatch[1], operator: 'not_exists', negated }
  }

  // ctx.field (exists)
  const existsMatch = expr.match(/^ctx\.(\w+(?:\.\w+)*)$/)
  if (existsMatch) {
    return { id, type: 'condition', field: existsMatch[1], operator: 'exists', negated }
  }

  // ctx.field op value
  const comparisonMatch = expr.match(
    /^ctx\.(\w+(?:\.\w+)*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/
  )
  if (comparisonMatch) {
    const [, field, op, rawValue] = comparisonMatch
    const value = parseValue(rawValue.trim())
    return { id, type: 'condition', field, operator: op as Condition['operator'], value, negated }
  }

  return null
}

function parseValue(raw: string): string | number | boolean | null {
  if (raw === 'null') return null
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1)
  }
  const num = parseFloat(raw)
  if (!isNaN(num)) return num
  return raw
}

function createInitialGroup(): ConditionGroup {
  return {
    id: generateId(),
    type: 'group',
    logic: 'and',
    items: [createEmptyCondition()],
  }
}

function GuardBuilderContent({ value, onChange }: GuardBuilderProps) {
  const [mode, setMode] = useState<'visual' | 'raw'>('visual')
  const [rawValue, setRawValue] = useState(value || '')
  const [group, setGroup] = useState<ConditionGroup>(() => {
    const parsed = value ? parseExpression(value) : null
    return parsed || createInitialGroup()
  })

  // Handle mode switches - parse expression when switching FROM raw TO visual
  const handleModeSwitch = useCallback((newMode: 'visual' | 'raw') => {
    if (newMode === 'visual' && mode === 'raw' && rawValue) {
      const parsed = parseExpression(rawValue)
      if (parsed) {
        setGroup(parsed)
      }
    }
    setMode(newMode)
  }, [mode, rawValue])

  // Update group and immediately notify parent
  const handleGroupUpdate = useCallback((newGroup: ConditionGroup) => {
    setGroup(newGroup)
    const expr = generateExpression(newGroup)
    onChange(expr || undefined)
  }, [onChange])

  const handleRawChange = (newValue: string) => {
    setRawValue(newValue)
  }

  const handleRawBlur = () => {
    onChange(rawValue.trim() || undefined)
  }

  const handleClear = () => {
    setGroup(createInitialGroup())
    setRawValue('')
    onChange(undefined)
  }

  const previewExpression = mode === 'visual' ? generateExpression(group) : rawValue

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-0.5 bg-background rounded-lg">
          <button
            onClick={() => handleModeSwitch('visual')}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              mode === 'visual'
                ? 'bg-surface text-foreground'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Layers className="w-3 h-3" />
            Visual
          </button>
          <button
            onClick={() => handleModeSwitch('raw')}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              mode === 'raw'
                ? 'bg-surface text-foreground'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Code className="w-3 h-3" />
            Raw
          </button>
        </div>
        {previewExpression && (
          <button
            onClick={handleClear}
            className="text-xs text-muted hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {mode === 'visual' ? (
        <ConditionGroupComponent
          group={group}
          onUpdate={handleGroupUpdate}
          isRoot
        />
      ) : (
        <textarea
          value={rawValue}
          onChange={(e) => handleRawChange(e.target.value)}
          onBlur={handleRawBlur}
          placeholder="ctx.amount > 100 && ctx.approved"
          rows={3}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      )}

      {/* Preview */}
      {previewExpression && (
        <div className="px-3 py-2 bg-background rounded-lg border border-border">
          <div className="text-xs text-muted mb-1">Expression:</div>
          <code className="text-sm font-mono text-foreground break-all">{previewExpression}</code>
        </div>
      )}
    </div>
  )
}

export function GuardBuilder(props: GuardBuilderProps) {
  // Use key to reset component state when value prop changes externally
  return <GuardBuilderContent key={props.value ?? '__empty__'} {...props} />
}
