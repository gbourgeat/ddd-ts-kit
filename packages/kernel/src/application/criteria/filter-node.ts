import type { FieldValue } from './field-value.js';
import type { FilterOperator } from './filter-operator.js';

export type FilterOperand = FieldValue | readonly FieldValue[];

export interface FilterCondition {
  readonly kind: 'condition';
  readonly field: string;
  readonly operator: FilterOperator;
  readonly value: FilterOperand;
}

/** `and` holds when every filter does, `or` when one does, `not` when they do not all hold. */
export interface FilterGroup {
  readonly kind: 'and' | 'or' | 'not';
  readonly filters: readonly FilterNode[];
}

/** One filter of a criteria, as plain data: a condition on a field, or a group of filters. */
export type FilterNode = FilterCondition | FilterGroup;
