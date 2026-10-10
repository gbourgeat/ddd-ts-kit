import type { FieldType } from './field-type.js';
import type { FilterOperator } from './filter-operator.js';

/** A `FieldRule` once read: every member is there. */
export interface FieldDeclaration {
  readonly type: FieldType;
  readonly filter: readonly FilterOperator[];
  readonly sortable: boolean;
  readonly nullable: boolean;
}
