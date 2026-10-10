import { InvalidPageRequestError } from './invalid-page-request-error.js';
import { DEFAULT_PAGE_LIMITS, type PageLimits } from './page-limits.js';
import type { OffsetPageRequest } from './page-request.js';
import { sizeWithin } from './size-within.js';
import type { Sort } from './sort.js';

export interface OffsetPageInput<Field extends string = string> {
  readonly offset?: number;
  readonly limit?: number;
  readonly sort?: readonly Sort<Field>[];
}

export function offsetPage<Field extends string = string>(
  input: OffsetPageInput<Field> = {},
  limits: PageLimits = DEFAULT_PAGE_LIMITS,
): OffsetPageRequest<Field> {
  const offset = input.offset ?? 0;

  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new InvalidPageRequestError('The offset of a page is a non-negative integer');
  }

  return { kind: 'offset', offset, limit: sizeWithin(input.limit, limits), sort: input.sort ?? [] };
}
