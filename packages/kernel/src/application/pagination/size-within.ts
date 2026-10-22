import { InvalidPageRequestError } from './invalid-page-request-error';
import type { PageLimits } from './page-limits';

export function sizeWithin(limit: number | undefined, limits: PageLimits): number {
  const size = limit ?? limits.defaultSize;

  if (!Number.isSafeInteger(size) || size < 1 || size > limits.maxSize) {
    throw new InvalidPageRequestError(`The size of a page is an integer between 1 and ${String(limits.maxSize)}`);
  }

  return size;
}
