export interface RetryOptions {
  /** Deliveries after which a message goes to the dead-letter stream. Default 5. */
  readonly maxAttempts?: number;
  /** Time the server waits before it delivers a failed message again. Default 5000. */
  readonly delayMs?: number;
}
