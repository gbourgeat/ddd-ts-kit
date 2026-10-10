import type { Page } from './page.js';

export function pageOf<T>(items: readonly T[], more: Omit<Page<T>, 'items'> = {}): Page<T> {
  return { items, ...more };
}
