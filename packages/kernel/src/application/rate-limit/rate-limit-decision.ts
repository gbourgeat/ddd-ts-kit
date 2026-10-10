export interface RateLimitDecision {
  readonly allowed: boolean;
  /** Calls still allowed right now, this one counted. */
  readonly remaining: number;
  /** 0 when allowed; otherwise how long until one call is allowed again. */
  readonly retryAfterMs: number;
}
