import type { CriteriaDefinition } from './criteria-definition';
import type { CriteriaViolation } from './criteria-violation';
import type { Criteria } from './criteria';
import { filterViolations } from './filter-violations';
import { pageViolations } from './page-violations';

/**
 * Everything a definition refuses in a criteria, an empty list when it accepts it. It never
 * throws and never quotes a value: each violation is a path and a stable code.
 */
export function validateCriteria<Row>(
  definition: CriteriaDefinition<Row>,
  criteria: Criteria<Row>,
): readonly CriteriaViolation[] {
  return [
    ...filterViolations(definition, criteria.filters),
    ...pageViolations(definition, { sort: criteria.sort, page: criteria.pageRequest }),
  ];
}
