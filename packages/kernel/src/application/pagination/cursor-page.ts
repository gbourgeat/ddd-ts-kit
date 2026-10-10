import { InvalidPageRequestError } from './invalid-page-request-error.js';
import { DEFAULT_PAGE_LIMITS, type PageLimits } from './page-limits.js';
import type { CursorPageRequest } from './page-request.js';
import { sizeWithin } from './size-within.js';
import type { Sort } from './sort.js';

export interface CursorPageInput<Field extends string = string> {
  readonly cursor?: string;
  readonly limit?: number;
  readonly sort?: readonly Sort<Field>[];
}

export function cursorPage<Field extends string = string>(
  input: CursorPageInput<Field> = {},
  limits: PageLimits = DEFAULT_PAGE_LIMITS,
): CursorPageRequest<Field> {
  if (input.cursor === '') {
    throw new InvalidPageRequestError('The cursor of a page is not empty');
  }

  return {
    kind: 'cursor',
    ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
    limit: sizeWithin(input.limit, limits),
    sort: input.sort ?? [],
  };
}
