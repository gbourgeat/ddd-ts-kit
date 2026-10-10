export interface RetryOptions {
  /** Deliveries after which a message goes to the dead queue. Default 5. */
  readonly maxAttempts?: number;
  /** Time a failed message waits before it is delivered again. Default 5000. */
  readonly delayMs?: number;
}
