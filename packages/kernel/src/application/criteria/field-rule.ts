import type { FieldTypeOf } from './field-type-of.js';
import type { OperatorOf } from './operator-of.js';

/**
 * What a read port says of one field of its read model. A field that may hold `null` says
 * so: paging by cursor then keeps its nulls in order.
 */
export type FieldRule<Value> = {
  readonly type: FieldTypeOf<Value>;
  /** The operators a caller may filter the field with. None by default. */
  readonly filter?: readonly OperatorOf<Value>[];
  /** Whether a caller may sort by the field. No by default. */
  readonly sortable?: boolean;
} & ([Extract<Value, null | undefined>] extends [never] ? { readonly nullable?: false } : { readonly nullable: true });
