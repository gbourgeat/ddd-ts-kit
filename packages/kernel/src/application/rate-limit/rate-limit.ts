export interface RateLimit {
  /** How many calls are allowed in any period of `windowMs`. */
  readonly limit: number;
  readonly windowMs: number;
}
