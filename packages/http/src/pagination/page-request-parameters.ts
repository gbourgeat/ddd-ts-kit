import type { JsonSchema } from '@ddd-ts-kit/validation';
import { limitsOf } from './limits-of.js';
import type { PageQueryOptions } from './page-query-options.js';

/**
 * The query parameters of a page as a JSON Schema object: one OpenAPI parameter per property
 * once it is the `toJsonSchema()` of a query schema. Merge `properties` into a wider schema
 * when the route has filters too.
 */
export function pageRequestParameters(options: PageQueryOptions<string> = {}): JsonSchema {
  const { defaultSize, maxSize } = limitsOf(options);
  const sortable = options.sortable ?? [];

  return {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: maxSize, default: defaultSize, description: 'Size of the page.' },
      offset: { type: 'integer', minimum: 0, description: 'Items to skip. Not with `cursor`.' },
      cursor: { type: 'string', minLength: 1, description: 'The `nextCursor` of the previous page. Not with `offset`.' },
      ...(sortable.length === 0 ? {} : { sort: sortParameter(sortable) }),
    },
  };
}

function sortParameter(sortable: readonly string[]): JsonSchema {
  return {
    type: 'string',
    description: `Comma-separated fields, a leading "-" for descending. Sortable: ${sortable.join(', ')}.`,
  };
}
