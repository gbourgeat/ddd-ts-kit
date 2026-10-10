export interface LockHandle {
  readonly key: string;
  /**
   * Grows with each acquisition of the key. A resource that remembers the highest token it
   * has seen can refuse a holder whose lock expired while it was paused.
   */
  readonly fencingToken: number;
  /** Frees the lock if it is still this holder's. Releasing twice, or too late, does nothing. */
  release(): Promise<void>;
}
