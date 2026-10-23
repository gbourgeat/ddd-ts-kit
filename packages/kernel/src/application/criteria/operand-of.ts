import type { FilterOperator } from './filter-operator';

/** What an operator compares a field holding `Value` with. */
export type OperandOf<Value, Operator extends FilterOperator> = Operator extends 'in'
  ? readonly NonNullable<Value>[]
  : Operator extends 'between'
    ? readonly [from: NonNullable<Value>, to: NonNullable<Value>]
    : Operator extends 'isNull'
      ? boolean
      : Operator extends 'contains' | 'startsWith'
        ? string
        : NonNullable<Value>;
