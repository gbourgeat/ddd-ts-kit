import type { PageRequest } from '@ddd-ts-kit/kernel';
import { customSchema, type Schema } from '@ddd-ts-kit/validation';
import type { PageQueryOptions } from './page-query-options';
import { pageRequestParameters } from './page-request-parameters';
import { parsePageQuery } from './parse-page-query';

/** The same reading as a `Schema`, for a route whose whole query is the page: `request: { query }`. */
export function pageQuerySchema<Field extends string = never>(
  options: PageQueryOptions<Field> = {},
): Schema<PageRequest<Field>> {
  return customSchema((query) => parsePageQuery(query, options), pageRequestParameters(options));
}
