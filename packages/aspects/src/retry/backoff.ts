import type { Jitter } from './jitter.js';

export interface Backoff {
  /** Delay before the first retry. */
  readonly baseMs: number;
  /** Multiplies the delay at each retry. Default 2. */
  readonly factor?: number;
  /** The delay never exceeds it. Default 30 seconds. */
  readonly maxMs?: number;
  /** Default `fullJitter()`. */
  readonly jitter?: Jitter;
}
