import type { Page } from '@ddd-ts-kit/kernel';
import type { PageBody } from './page-body';

/** The body of a search answer: the items through `map`, `total` and `nextCursor` when the page has them. */
export function pageResponse<T, U>(page: Page<T>, map: (item: T) => U): PageBody<U> {
  return {
    items: page.items.map(map),
    ...(page.total === undefined ? {} : { total: page.total }),
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
  };
}
