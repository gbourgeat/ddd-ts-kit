import type { Criteria, CriteriaDefinition } from '@ddd-ts-kit/kernel';
import { ValidationError } from '@ddd-ts-kit/validation';
import type { CriteriaQueryOptions } from './criteria-query-options.js';
import { parseCriteriaQuery } from './parse-criteria-query.js';

/**
 * Reads the criteria of a list route from its query: `filter[<field>]=<operator>:<value>`,
 * groups, and the `sort`, `limit`, `offset` and `cursor` of a page. Anything the definition of
 * the read port does not declare throws the `ValidationError` of the pipeline: a 422 whose
 * issues name `query.filter.<field>` and a stable code. For a route whose query schema holds
 * other parameters too; `criteriaQuerySchema` is the same reading as a schema.
 */
export function criteriaFrom<Row>(
  query: unknown,
  definition: CriteriaDefinition<Row>,
  options: CriteriaQueryOptions = {},
): Criteria<Row> {
  const parsed = parseCriteriaQuery(query, definition, options);

  if (parsed.ok) {
    return parsed.value;
  }

  throw new ValidationError(
    parsed.error.map((issue) => ({ ...issue, path: `query.${issue.path}` })),
    'The request is not valid.',
  );
}
