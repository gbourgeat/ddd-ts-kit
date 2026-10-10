/** What a relation does when its lookup rejects or takes too long. */
export interface HydrationPolicy {
  /** `fail` (default) rejects the whole hydration; `fallback` answers the fallback and a warning. */
  readonly onFailure?: 'fail' | 'fallback';
  /** The lookup is given up after this long, and counts as failed. No limit by default. */
  readonly timeoutMs?: number;
}
