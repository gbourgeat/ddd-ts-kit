import { describe, expect, it } from 'vitest';
import { CircuitBreaker, Logged, Retry, type AsyncMethodDecorator } from '../src/decorators';
import { createAspectFakes, withAspectRuntime } from '../src/testing';
import { Unreachable } from './support/unreachable';

/*
 * The standard (TC39) decorator call, as a compiler emits it: each decorator is handed the method
 * and the context of its declaration, and the initializers it adds run when an instance is built.
 * The test runner transforms this file with no decorator support, so the call is written here as
 * the compiler would write it; decorators.spec runs the fixtures as each compiler emits them.
 */
type Initializer = (this: StandardRateGateway) => void;

const initializers: Initializer[] = [];

class StandardRateGateway {
  readonly calls: string[] = [];

  private readonly failures: unknown[] = [];

  private readonly currentRate = 1.08;

  constructor() {
    for (const initializer of initializers) {
      initializer.call(this);
    }
  }

  failNext(...failures: unknown[]): this {
    this.failures.push(...failures);

    return this;
  }

  async rate(pair: string): Promise<number> {
    this.calls.push(`rate:${pair}`);

    const failure = this.failures.shift();

    if (failure !== undefined) {
      throw failure;
    }

    return this.currentRate;
  }

  async guardedRate(pair: string): Promise<number> {
    return this.rate(pair);
  }

  *pairs(): Generator<string> {
    yield 'EUR-USD';
  }
}

type RateMethod = (this: StandardRateGateway, pair: string) => Promise<number>;

/** Applies the decorators to a method as written, the first one outermost: the compiler calls the last one first. */
function decorated(name: string, method: RateMethod, ...decorators: readonly AsyncMethodDecorator[]): void {
  const context: ClassMethodDecoratorContext<StandardRateGateway, RateMethod> = {
    kind: 'method',
    name,
    static: false,
    private: false,
    access: { has: (instance) => name in instance, get: () => method },
    addInitializer: (initializer) => void initializers.push(initializer),
    metadata: {},
  };

  for (const decorator of [...decorators].reverse()) {
    decorator(method, context);
  }
}

/** A generator, which TypeScript refuses to the decorator: handed over as a JavaScript caller would. */
const pairs: unknown = StandardRateGateway.prototype.pairs;

decorated('rate', StandardRateGateway.prototype.rate, Logged(), Retry({ attempts: 3, sleep: async () => undefined }));

decorated(
  'guardedRate',
  StandardRateGateway.prototype.guardedRate,
  CircuitBreaker({ failureThreshold: 1, resetAfterMs: 30_000 }),
);

decorated('pairs', pairs as RateMethod, Logged());

describe('decorators in the standard mode, called as a compiler calls them', () => {
  it('wrap the method of each instance when it is built: retried and logged, the class left as it is', async () => {
    const fakes = createAspectFakes();
    const gateway = new StandardRateGateway().failNext(new Unreachable());

    expect(await withAspectRuntime(fakes, () => gateway.rate('EUR-USD'))).toBe(1.08);

    expect(gateway.calls).toEqual(['rate:EUR-USD', 'rate:EUR-USD']);
    expect(gateway).toBeInstanceOf(StandardRateGateway);
    expect(Object.hasOwn(gateway, 'rate')).toBe(true);
    expect(gateway.rate.name).toBe('rate');

    expect(fakes.logger.entries.map((entry) => entry.message)).toEqual([
      'StandardRateGateway.rate started',
      'StandardRateGateway.rate succeeded',
    ]);
  });

  it('leave a method that is no plain function, a generator, as it is on every instance', () => {
    const gateway = new StandardRateGateway();

    expect(Object.hasOwn(gateway, 'pairs')).toBe(false);
    expect([...gateway.pairs()]).toEqual(['EUR-USD']);
  });

  it('keep the state of a stateful advice per instance', async () => {
    const fakes = createAspectFakes();
    const broken = new StandardRateGateway().failNext(new Unreachable(), new Unreachable(), new Unreachable());
    const healthy = new StandardRateGateway();

    await withAspectRuntime(fakes, async () => {
      await broken.guardedRate('EUR-USD').catch(() => undefined);
      await expect(broken.guardedRate('EUR-USD')).rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });
      await expect(healthy.guardedRate('EUR-USD')).resolves.toBe(1.08);
    });
  });
});
