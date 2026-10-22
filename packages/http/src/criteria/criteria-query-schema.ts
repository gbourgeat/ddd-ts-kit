import type { Criteria, CriteriaDefinition } from '@ddd-ts-kit/kernel';
import { customSchema, type Schema } from '@ddd-ts-kit/validation';
import { criteriaParameters } from './criteria-parameters';
import type { CriteriaQueryOptions } from './criteria-query-options';
import { parseCriteriaQuery } from './parse-criteria-query';

/**
 * The query of a search route as a `Schema`: `request: { query: criteriaQuerySchema(definition) }`
 * hands the handler a `Criteria` the read port accepts, and documents every filter, the sort
 * and the page in the contract.
 */
export function criteriaQuerySchema<Row>(
  definition: CriteriaDefinition<Row>,
  options: CriteriaQueryOptions = {},
): Schema<Criteria<Row>> {
  return customSchema((query) => parseCriteriaQuery(query, definition, options), criteriaParameters(definition));
}
