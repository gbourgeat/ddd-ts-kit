import type { PageRequest } from '@ddd-ts-kit/kernel';
import { ValidationError } from '@ddd-ts-kit/validation';
import type { PageQueryOptions } from './page-query-options.js';
import { parsePageQuery } from './parse-page-query.js';

/**
 * Reads `limit`, `offset`, `cursor` and `sort` (`placedAt,-total`: a leading `-` is
 * descending) from a query, as strings or already coerced. Throws the `ValidationError` of the
 * pipeline, so a wrong parameter is answered 422 with one issue per parameter.
 */
export function pageRequestFrom<Field extends string = never>(
  query: unknown,
  options: PageQueryOptions<Field> = {},
): PageRequest<Field> {
  const parsed = parsePageQuery(query, options);

  if (parsed.ok) return parsed.value;

  const issues = parsed.error.map((issue) => ({ ...issue, path: `query.${issue.path}` }));

  throw new ValidationError(issues, 'The request is not valid.');
}
