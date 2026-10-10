export interface OutboxStats {
  /** Records still to publish, those waiting for a retry included. */
  readonly pending: number;
  /** The pending records whose last attempt failed. */
  readonly failed: number;
  /** Records that exhausted their attempts and wait for `retryDead`. */
  readonly dead: number;
}
