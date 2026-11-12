import type { FilterOperator } from './filter-operator';
import type { TextSearch } from './text-search';

/** What an operator compares a field holding `Value` with. */
export type OperandOf<Value, Operator extends FilterOperator> = Operator extends 'in'
  ? readonly NonNullable<Value>[]
  : Operator extends 'between'
    ? readonly [from: NonNullable<Value>, to: NonNullable<Value>]
    : Operator extends 'isNull'
      ? boolean
      : Operator extends TextSearch
        ? string
        : NonNullable<Value>;
