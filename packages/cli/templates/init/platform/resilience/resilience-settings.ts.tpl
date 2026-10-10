/** How often an outbound call is tried again, from which delay, and how long one attempt may last. */
export interface ResilienceSettings {
  readonly retryAttempts: number;
  readonly retryBaseDelayMs: number;
  readonly timeoutMs: number;
}
