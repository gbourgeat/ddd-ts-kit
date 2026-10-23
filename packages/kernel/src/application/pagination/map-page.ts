import type { Page } from './page';

export function mapPage<T, U>(page: Page<T>, map: (item: T) => U): Page<U> {
  const { items, ...more } = page;

  return { items: items.map(map), ...more };
}
