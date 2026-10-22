import { InvalidPageRequestError } from './invalid-page-request-error';
import { DEFAULT_PAGE_LIMITS, type PageLimits } from './page-limits';
import type { OffsetPageRequest } from './page-request';
import { sizeWithin } from './size-within';
import type { Sort } from './sort';

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
