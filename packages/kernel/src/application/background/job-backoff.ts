/** The delay before each retry: `baseMs`, then multiplied by `factor` at each further attempt, never above `maxMs`. */
export interface JobBackoff {
  /** Default 1000. */
  readonly baseMs?: number;
  /** Default 2. */
  readonly factor?: number;
  /** Default 300000 (five minutes). */
  readonly maxMs?: number;
}
