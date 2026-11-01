import { OpenSearchRequestError } from '../errors/open-search-request-error';
import type { OpenSearchRequest, OpenSearchResponse } from '../transport/open-search-transport';
import { errorTypeOf } from './error-type-of';
import { fieldOf } from './field-of';

/** The error of an answer the store did not expect, with the type and the reason the node gave. */
export function refusalOf(request: OpenSearchRequest, response: OpenSearchResponse): OpenSearchRequestError {
  const reason = fieldOf(fieldOf(response.body, 'error'), 'reason');

  return new OpenSearchRequestError(
    request.method,
    request.path,
    response.status,
    errorTypeOf(response),
    typeof reason === 'string' ? reason : undefined,
  );
}
