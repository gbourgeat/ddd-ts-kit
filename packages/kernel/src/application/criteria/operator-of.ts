/**
 * The operators the compiler accepts on a field holding `Value`: no order on a boolean, no
 * text search off a string, no `isNull` on a field that is never null.
 */
export type OperatorOf<Value> =
  | 'eq'
  | 'ne'
  | 'in'
  | ([Extract<Value, null | undefined>] extends [never] ? never : 'isNull')
  | ([NonNullable<Value>] extends [boolean] ? never : 'gt' | 'gte' | 'lt' | 'lte' | 'between')
  | ([NonNullable<Value>] extends [string] ? 'contains' | 'startsWith' : never);
