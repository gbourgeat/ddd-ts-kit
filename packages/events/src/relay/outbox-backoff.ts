export interface OutboxBackoff {
  /** Delay before the second attempt. Default 1000. */
  readonly baseMs?: number;
  /** Multiplier applied at each further attempt. Default 2. */
  readonly factor?: number;
  /** Upper bound of the delay. Default 300000 (five minutes). */
  readonly maxMs?: number;
}
