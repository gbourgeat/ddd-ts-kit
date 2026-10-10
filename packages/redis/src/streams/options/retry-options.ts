export interface RetryOptions {
  /** Deliveries after which an entry goes to the dead stream. Default 5. */
  readonly maxAttempts?: number;

  /** Time a failed entry waits before it is delivered again. Default 5000. */
  readonly delayMs?: number;
}
