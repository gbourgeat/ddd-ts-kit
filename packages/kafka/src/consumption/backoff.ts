import type { ReconnectOptions } from '../options/reconnect-options';

/** The wait before the next attempt of something that keeps failing: longer after each failure. */
export class Backoff {
  private failures = 0;

  constructor(private readonly reconnect: Required<ReconnectOptions>) {}

  /** The delay before the attempt that follows the failures counted so far. */
  get delayMs(): number {
    const { initialMs, factor, maxMs } = this.reconnect;

    return Math.min(maxMs, initialMs * factor ** this.failures);
  }

  failed(): void {
    this.failures += 1;
  }

  reset(): void {
    this.failures = 0;
  }
}
