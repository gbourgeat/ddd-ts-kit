import type { HydrationPolicy } from './hydration-policy';
import type { HydrationWarning } from './hydration-warning';

/** One execution of a hydration: what its relations share while they load. */
export interface HydrationRun {
  readonly policies: ReadonlyMap<string, HydrationPolicy>;
  /** The lookups that failed and that no fallback has answered for yet. */
  readonly failures: Map<string, unknown>;
  readonly warnings: HydrationWarning[];
}
