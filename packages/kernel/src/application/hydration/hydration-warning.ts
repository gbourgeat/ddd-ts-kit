/** A relation answered with its fallback because its lookup failed: said, never silent. */
export interface HydrationWarning {
  readonly relation: string;
  readonly code: 'lookup_failed' | 'lookup_timed_out';
}
