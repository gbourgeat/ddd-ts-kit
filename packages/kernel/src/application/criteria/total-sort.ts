import type { Sort } from '../pagination/sort.js';
import type { CriteriaDefinition } from './criteria-definition.js';

/**
 * The sort a read really runs with: the one asked, or the default of the definition, ended by
 * the tie-breaker in the direction of the last field so that no two rows are ever equal.
 */
export function totalSort<Row>(definition: CriteriaDefinition<Row>, asked: readonly Sort[]): readonly Sort[] {
  const sort: readonly Sort[] = asked.length > 0 ? asked : definition.defaultSort;

  if (sort.some(({ field }) => field === definition.tieBreaker)) {
    return sort;
  }

  return [...sort, { field: definition.tieBreaker, direction: sort.at(-1)?.direction ?? 'asc' }];
}
