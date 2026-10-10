export interface RetryOptions {
  /** Deliveries after which a record goes to the dead-letter topic. Default 5. */
  readonly maxAttempts?: number;
  /** Time the partition of a failed record stays paused before it is read again. Default 5000. */
  readonly delayMs?: number;
}
