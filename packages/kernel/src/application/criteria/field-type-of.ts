/** The types a field holding `Value` may declare: the compiler refuses `number` on a `Date`. */
export type FieldTypeOf<Value> = [NonNullable<Value>] extends [Date]
  ? 'instant'
  : [NonNullable<Value>] extends [number]
    ? 'number'
    : [NonNullable<Value>] extends [boolean]
      ? 'boolean'
      : 'string' | 'decimal';
