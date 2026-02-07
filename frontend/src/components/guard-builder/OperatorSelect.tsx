import { OPERATORS, type Operator } from './types'

interface OperatorSelectProps {
  value: Operator
  onChange: (op: Operator) => void
}

export function OperatorSelect({ value, onChange }: OperatorSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Operator)}
      className="px-2 py-1.5 bg-background border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[80px]"
    >
      {OPERATORS.map((op) => (
        <option key={op.value} value={op.value}>
          {op.label}
        </option>
      ))}
    </select>
  )
}
