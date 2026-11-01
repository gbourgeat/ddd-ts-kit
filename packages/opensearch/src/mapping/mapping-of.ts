import type { FieldType } from '@ddd-ts-kit/kernel';
import { RESERVED } from './reserved-fields';
import type { StoredField } from './stored-field';

type Mapping = Readonly<Record<string, unknown>>;

const INDEXED: Readonly<Record<FieldType, Mapping>> = {
  string: { type: 'keyword' },
  number: { type: 'double' },
  boolean: { type: 'boolean' },
  instant: { type: 'date', format: 'strict_date_optional_time' },
  // Kept as written; its order key, in `_ddd_order`, is what a read filters and sorts by.
  decimal: { type: 'keyword', index: false, doc_values: false },
};

/**
 * The mapping of the index of a read model: `dynamic: 'strict'`, so that a field the read model
 * does not declare is refused at the write rather than mapped by a guess.
 */
export function mappingOf(fields: ReadonlyMap<string, StoredField>, tenantField: string | undefined): Mapping {
  const properties: Record<string, Mapping> = {};
  const order: Record<string, Mapping> = {};

  for (const [name, field] of fields) {
    properties[name] = field.indexed
      ? INDEXED[field.type]
      : { ...INDEXED[field.type], index: false, doc_values: false };

    if (field.indexed && field.type === 'decimal') {
      order[name] = { type: 'keyword' };
    }
  }

  if (tenantField !== undefined) {
    properties[tenantField] = { type: 'keyword' };
  }

  return {
    dynamic: 'strict',
    properties: {
      ...properties,
      [RESERVED.stamp]: { type: 'object', enabled: false },
      [RESERVED.deleted]: { type: 'boolean' },
      [RESERVED.order]: { type: 'object', properties: order },
    },
  };
}
