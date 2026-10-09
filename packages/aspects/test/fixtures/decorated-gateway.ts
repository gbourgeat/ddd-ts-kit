import {
  Bulkhead,
  Cached,
  CircuitBreaker,
  Logged,
  Retry,
  Timed,
  Timeout,
} from '../../src/decorators.js';

/**
 * An adapter whose resilience policy is part of its definition. It has no constructor
 * parameter for a logger, metrics or a cache: they come from the aspect runtime.
 */
export class DecoratedRateGateway {
  readonly calls: string[] = [];
  readonly #failures: unknown[] = [];
  #rate = 1.08;

  failNext(...failures: unknown[]): this {
    this.#failures.push(...failures);
    return this;
  }

  @Logged()
  @Timed({ name: 'rates' })
  @Retry({ attempts: 3, sleep: async () => undefined })
  async rate(pair: string): Promise<number> {
    this.calls.push(`rate:${pair}`);
    const failure = this.#failures.shift();
    if (failure !== undefined) throw failure;
    return this.#rate;
  }

  @Cached({ key: (_method, [pair]) => (typeof pair === 'string' ? pair : undefined), ttlMs: 60_000 })
  async cachedRate(pair: string): Promise<number> {
    this.calls.push(`cachedRate:${pair}`);
    return this.#rate;
  }

  @CircuitBreaker({ failureThreshold: 1, resetAfterMs: 30_000 })
  async guardedRate(pair: string): Promise<number> {
    return this.rate(pair);
  }

  @Bulkhead({ maxConcurrent: 1 })
  @Timeout(2000, { signal: true })
  async slowRate(pair: string, signal?: AbortSignal): Promise<string> {
    return new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => {
        reject(new Error(`aborted ${pair}`));
      });
    });
  }

  async reprice(rate: number): Promise<void> {
    this.#rate = rate;
  }
}
