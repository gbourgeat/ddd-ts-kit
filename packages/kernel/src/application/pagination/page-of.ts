import type { Page } from './page';

export function pageOf<T>(items: readonly T[], more: Omit<Page<T>, 'items'> = {}): Page<T> {
  return { items, ...more };
}
