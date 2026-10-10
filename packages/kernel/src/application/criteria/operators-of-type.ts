import type { FieldType } from './field-type.js';
import type { FilterOperator } from './filter-operator.js';

const ANY: readonly FilterOperator[] = ['eq', 'ne', 'in', 'isNull'];
const ORDERED: readonly FilterOperator[] = [...ANY, 'gt', 'gte', 'lt', 'lte', 'between'];

const BY_TYPE: Readonly<Record<FieldType, readonly FilterOperator[]>> = {
  string: [...ORDERED, 'contains', 'startsWith'],
  number: ORDERED,
  instant: ORDERED,
  decimal: ORDERED,
  boolean: ANY,
};

/** The operators that mean something on a field of a type. */
export function operatorsOfType(type: FieldType): readonly FilterOperator[] {
  return BY_TYPE[type];
}
