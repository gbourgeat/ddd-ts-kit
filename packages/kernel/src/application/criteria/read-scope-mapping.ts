import type { FieldOf } from './field-of.js';

/** Which fields of the read model a scope narrows: the read port chooses them, never the caller. */
export interface ReadScopeMapping<Row> {
  /** The field the identifiers of an `ids` scope are those of. */
  readonly ids?: FieldOf<Row>;
  /** The field of each key an authorizer may put in a `filter` scope: `{ tenantId: 'tenantId' }`. */
  readonly filter?: Readonly<Record<string, FieldOf<Row>>>;
}
