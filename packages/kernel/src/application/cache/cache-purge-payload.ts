/** What a purge request carries: the tags to purge, already filed under their tenant. */
export interface CachePurgePayload {
  readonly tags: readonly string[];
}
