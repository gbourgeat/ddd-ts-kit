import type { RateLimiter } from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable.js';
import type { ContractRunner } from './contract-runner.js';
import { ContractSuite } from './contract-suite.js';

export interface RateLimiterContractOptions {
  readonly name: string;
  /** A limiter that has seen no call; called before each test. */
  createLimiter(): Awaitable<RateLimiter>;
  /** Makes the time of the limiter pass by exactly that long: advances the clock it reads. */
  elapse(ms: number): Awaitable<void>;
}

/** What every adapter of the kernel `RateLimiter` port guarantees, the in-memory one included. */
export function rateLimiterContract(runner: ContractRunner, options: RateLimiterContractOptions): void {
  new RateLimiterSuite(runner, options).describe(`${options.name} (rate limiter contract)`);
}

const THREE_PER_SECOND = { limit: 3, windowMs: 1_000 };

class RateLimiterSuite extends ContractSuite<RateLimiter> {
  constructor(
    runner: ContractRunner,
    private readonly options: RateLimiterContractOptions,
  ) {
    super(runner, () => options.createLimiter());
  }

  protected tests(): void {
    this.limits();
    this.slides();
    this.isolates();
  }

  private limits(): void {
    this.it('allows calls up to the limit and counts down what remains', async () => {
      const decisions = [await this.consume(), await this.consume(), await this.consume()];

      this.expect(decisions).toEqual([
        { allowed: true, remaining: 2, retryAfterMs: 0 },
        { allowed: true, remaining: 1, retryAfterMs: 0 },
        { allowed: true, remaining: 0, retryAfterMs: 0 },
      ]);
    });

    this.it('refuses the call beyond the limit and says when to come back', async () => {
      await this.consume();
      await this.options.elapse(100);
      await this.consume();
      await this.options.elapse(100);
      await this.consume();
      await this.options.elapse(100);

      this.expect(await this.consume()).toEqual({ allowed: false, remaining: 0, retryAfterMs: 700 });
    });

    this.it('does not count a refused call', async () => {
      for (let call = 0; call < 3; call += 1) await this.consume();

      await this.options.elapse(500);

      for (let call = 0; call < 5; call += 1) await this.consume();

      await this.options.elapse(500);

      this.expect((await this.consume()).allowed).toBe(true);
    });
  }

  private slides(): void {
    this.it('allows a call again as soon as the oldest one has left the window, and only as many', async () => {
      await this.consume();
      await this.options.elapse(400);
      await this.consume();
      await this.consume();
      await this.options.elapse(599);
      this.expect((await this.consume()).allowed).toBe(false);

      await this.options.elapse(1);

      this.expect(await this.consume()).toEqual({ allowed: true, remaining: 0, retryAfterMs: 0 });
      this.expect(await this.consume()).toEqual({ allowed: false, remaining: 0, retryAfterMs: 400 });
    });

    this.it('starts afresh once the whole window has passed without a call', async () => {
      for (let call = 0; call < 3; call += 1) await this.consume();

      await this.options.elapse(1_000);

      this.expect(await this.consume()).toEqual({ allowed: true, remaining: 2, retryAfterMs: 0 });
    });
  }

  private isolates(): void {
    this.it('keeps keys apart', async () => {
      for (let call = 0; call < 3; call += 1) await this.consume('client-a');

      this.expect((await this.consume('client-a')).allowed).toBe(false);
      this.expect(await this.consume('client-b')).toEqual({ allowed: true, remaining: 2, retryAfterMs: 0 });
    });

    this.it('allows exactly the limit among calls made at the same time', async () => {
      const decisions = await Promise.all(Array.from({ length: 10 }, () => this.consume()));

      this.expect(decisions.filter((decision) => decision.allowed).length).toBe(3);
      this.expect(decisions.filter((decision) => !decision.allowed).every((decision) => decision.retryAfterMs === 1_000)).toBe(true);
    });
  }

  private consume(key = 'client-a') {
    return this.subject.consume(key, THREE_PER_SECOND);
  }
}
