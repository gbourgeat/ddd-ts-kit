import type { FieldType } from './field-type';
import type { FilterOperator } from './filter-operator';

/** A `FieldRule` once read: every member is there. */
export interface FieldDeclaration {
  readonly type: FieldType;
  readonly filter: readonly FilterOperator[];
  readonly sortable: boolean;
  readonly nullable: boolean;
}
