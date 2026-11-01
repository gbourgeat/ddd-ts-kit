import type { OpenSearchResponse } from '../transport/open-search-transport';
import { fieldOf } from './field-of';

/** The `type` of the error a node answered, when it answered one. */
export function errorTypeOf(response: OpenSearchResponse): string | undefined {
  const type = fieldOf(fieldOf(response.body, 'error'), 'type');

  return typeof type === 'string' ? type : undefined;
}
