import type { PageRequest } from '../pagination/page-request.js';
import type { CriteriaDefinition } from './criteria-definition.js';
import type { CriteriaPlan } from './criteria-plan.js';
import type { Criteria } from './criteria.js';
import { InvalidCriteriaError } from './invalid-criteria-error.js';
import { predicateOf } from './predicate-of.js';
import type { Predicate } from './predicate.js';
import { readCursor } from './read-cursor.js';
import type { ScopedCriteria, ScopeRestriction } from './scoped-criteria.js';
import { seekPredicate } from './seek-predicate.js';
import { totalSort } from './total-sort.js';
import { UnmappedReadScopeError } from './unmapped-read-scope-error.js';
import { validateCriteria } from './validate-criteria.js';

const UNRESTRICTED: ScopeRestriction = { conditions: [], empty: false };

/**
 * The plan of a read for a store. It validates first and throws `InvalidCriteriaError`: a
 * criteria that its definition refuses never reaches a statement. A criteria given without a
 * scope is read whole, which is right for a read nobody is refused.
 */
export function planCriteria<Row>(definition: CriteriaDefinition<Row>, read: Criteria<Row> | ScopedCriteria<Row>): CriteriaPlan {
  // Told apart by shape: a criteria built with another copy of this package is still one.
  const criteria = 'restriction' in read ? read.criteria : read;
  const restriction = 'restriction' in read ? read.restriction : UNRESTRICTED;
  const violations = validateCriteria(definition, criteria);

  if (violations.length > 0) throw new InvalidCriteriaError(violations);

  assertDeclared(definition, restriction);

  const sort = totalSort(definition, criteria.sort);

  return {
    empty: restriction.empty,
    fields: definition.fields,
    filter: predicateOf([...criteria.filters, ...restriction.conditions], definition.fields),
    seek: seekOf(definition, criteria.pageRequest, sort),
    sort,
    ...windowOf(criteria.pageRequest, definition.limits.defaultPageSize),
  };
}

function windowOf(page: PageRequest | undefined, defaultSize: number): Pick<CriteriaPlan, 'kind' | 'limit' | 'fetch' | 'offset'> {
  if (page === undefined) return { kind: 'offset', limit: defaultSize, fetch: defaultSize, offset: 0 };

  return page.kind === 'cursor'
    ? { kind: 'cursor', limit: page.limit, fetch: page.limit + 1, offset: 0 }
    : { kind: 'offset', limit: page.limit, fetch: page.limit, offset: page.offset };
}

function assertDeclared<Row>(definition: CriteriaDefinition<Row>, restriction: ScopeRestriction): void {
  for (const { field } of restriction.conditions) {
    if (!Object.hasOwn(definition.fields, field)) throw new UnmappedReadScopeError(`the field "${field}"`);
  }
}

function seekOf<Row>(definition: CriteriaDefinition<Row>, page: PageRequest | undefined, sort: CriteriaPlan['sort']): Predicate | undefined {
  if (page?.kind !== 'cursor' || page.cursor === undefined) return undefined;

  const position = readCursor(page.cursor, sort, definition.fields);

  return position === undefined ? undefined : seekPredicate(sort, position, definition.fields);
}
