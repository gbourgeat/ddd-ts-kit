import type { Criteria } from './criteria';
import type { FilterCondition } from './filter-node';
import type { ReadScopeMapping } from './read-scope-mapping';
import type { ReadScope } from './read-scope';
import { ScopedCriteria } from './scoped-criteria';
import { UnmappedReadScopeError } from './unmapped-read-scope-error';

/**
 * Joins what the actor may read to a criteria, by AND and apart from its filters: `all` adds
 * nothing, `none` empties the read, `ids` and `filter` become conditions on the fields the
 * mapping names. A scope the mapping cannot express throws `UnmappedReadScopeError`.
 */
export function scoped<Row>(
  criteria: Criteria<Row>,
  scope: ReadScope,
  mapping: ReadScopeMapping<Row> = {},
): ScopedCriteria<Row> {
  switch (scope.kind) {
    case 'all':
      return ScopedCriteria.within(criteria, { conditions: [], empty: false });
    case 'none':
      return ScopedCriteria.within(criteria, { conditions: [], empty: true });
    case 'ids':
      return ScopedCriteria.within(criteria, {
        conditions: [amongIds(scope.ids, mapping.ids)],
        empty: scope.ids.length === 0,
      });
    case 'filter':
      return ScopedCriteria.within(criteria, {
        conditions: equalities(scope.filter, mapping.filter ?? {}),
        empty: false,
      });
  }
}

function amongIds(ids: readonly string[], field: string | undefined): FilterCondition {
  if (field === undefined) {
    throw new UnmappedReadScopeError('identifiers');
  }

  return { kind: 'condition', field, operator: 'in', value: [...ids] };
}

function equalities(
  filter: Readonly<Record<string, string | number | boolean>>,
  fields: Readonly<Record<string, string>>,
): FilterCondition[] {
  return Object.entries(filter).map(([key, value]) => {
    const field = Object.hasOwn(fields, key) ? fields[key] : undefined;

    if (field === undefined) {
      throw new UnmappedReadScopeError(`"${key}"`);
    }

    return { kind: 'condition', field, operator: 'eq', value };
  });
}
