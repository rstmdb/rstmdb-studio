export type Operator = 'exists' | 'not_exists' | '==' | '!=' | '>' | '>=' | '<' | '<='

export interface Condition {
  id: string
  type: 'condition'
  field: string
  operator: Operator
  value?: string | number | boolean | null
  negated?: boolean
}

export interface ConditionGroup {
  id: string
  type: 'group'
  logic: 'and' | 'or'
  items: (Condition | ConditionGroup)[]
  negated?: boolean
}

export type GuardItem = Condition | ConditionGroup

export const OPERATORS: { value: Operator; label: string; needsValue: boolean }[] = [
  { value: 'exists', label: 'exists', needsValue: false },
  { value: 'not_exists', label: 'not exists', needsValue: false },
  { value: '==', label: '==', needsValue: true },
  { value: '!=', label: '!=', needsValue: true },
  { value: '>', label: '>', needsValue: true },
  { value: '>=', label: '>=', needsValue: true },
  { value: '<', label: '<', needsValue: true },
  { value: '<=', label: '<=', needsValue: true },
]

export function isCondition(item: GuardItem): item is Condition {
  return item.type === 'condition'
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function createEmptyCondition(): Condition {
  return {
    id: generateId(),
    type: 'condition',
    field: '',
    operator: 'exists',
    value: undefined,
  }
}

export function createEmptyGroup(): ConditionGroup {
  return {
    id: generateId(),
    type: 'group',
    logic: 'and',
    items: [createEmptyCondition()],
  }
}
