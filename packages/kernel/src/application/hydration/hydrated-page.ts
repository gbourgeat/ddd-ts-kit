import type { Page } from '../pagination/page';
import type { HydrationWarning } from './hydration-warning';

/** The page that was hydrated, with the same paging, and what had to be answered by a fallback. */
export interface HydratedPage<T> extends Page<T> {
  readonly warnings: readonly HydrationWarning[];
}
