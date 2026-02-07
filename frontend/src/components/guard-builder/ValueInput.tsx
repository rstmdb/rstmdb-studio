import { useState, useEffect } from 'react'
import type { Operator } from './types'

interface ValueInputProps {
  operator: Operator
  value: string | number | boolean | null | undefined
  onChange: (value: string | number | boolean | null) => void
}

type ValueType = 'string' | 'number' | 'boolean' | 'null'

export function ValueInput({ operator, value, onChange }: ValueInputProps) {
  const [valueType, setValueType] = useState<ValueType>(() => detectType(value))
  const [inputValue, setInputValue] = useState(() => formatForInput(value))

  useEffect(() => {
    setValueType(detectType(value))
    setInputValue(formatForInput(value))
  }, [value])

  const isNumericOperator = ['>', '>=', '<', '<='].includes(operator)

  const handleBlur = () => {
    if (isNumericOperator || valueType === 'number') {
      const num = parseFloat(inputValue)
      if (!isNaN(num)) {
        onChange(num)
      }
    } else if (valueType === 'string') {
      onChange(inputValue)
    }
  }

  const handleTypeChange = (newType: ValueType) => {
    setValueType(newType)
    switch (newType) {
      case 'string':
        setInputValue('')
        onChange('')
        break
      case 'number':
        setInputValue('0')
        onChange(0)
        break
      case 'boolean':
        setInputValue('true')
        onChange(true)
        break
      case 'null':
        setInputValue('null')
        onChange(null)
        break
    }
  }

  // For numeric operators, always show number input
  if (isNumericOperator) {
    return (
      <input
        type="number"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="0"
        className="flex-1 min-w-[80px] px-2 py-1.5 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
      />
    )
  }

  // For equality operators, allow type selection
  return (
    <div className="flex gap-1 flex-1">
      <select
        value={valueType}
        onChange={(e) => handleTypeChange(e.target.value as ValueType)}
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
          value={String(value)}
          onChange={(e) => onChange(e.target.value === 'true')}
          className="flex-1 min-w-[60px] px-2 py-1.5 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : valueType === 'null' ? (
        <input
          type="text"
          value="null"
          disabled
          className="flex-1 min-w-[60px] px-2 py-1.5 bg-background border border-border rounded text-sm font-mono text-muted"
        />
      ) : valueType === 'number' ? (
        <input
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleBlur}
          placeholder="0"
          className="flex-1 min-w-[60px] px-2 py-1.5 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
        />
      ) : (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleBlur}
          placeholder="value"
          className="flex-1 min-w-[60px] px-2 py-1.5 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )}
    </div>
  )
}

function detectType(value: unknown): ValueType {
  if (value === null || value === undefined) return 'string'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (value === 'null') return 'null'
  return 'string'
}

function formatForInput(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'number') return String(value)
  return String(value)
}
