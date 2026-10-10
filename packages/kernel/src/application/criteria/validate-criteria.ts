import type { CriteriaDefinition } from './criteria-definition.js';
import type { CriteriaViolation } from './criteria-violation.js';
import type { Criteria } from './criteria.js';
import { filterViolations } from './filter-violations.js';
import { pageViolations } from './page-violations.js';

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
