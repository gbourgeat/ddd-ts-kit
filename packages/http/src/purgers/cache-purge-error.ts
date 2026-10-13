/** A shared cache that did not confirm a purge: unreachable, too slow, or answering a failure. The relay retries the request. */
export class CachePurgeError extends Error {
  constructor(
    message: string,
    /** The status the cache answered; absent when it answered nothing. */
    readonly status?: number,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = 'CachePurgeError';
  }
}
