import { describe, expect, it } from 'vitest';
import { FixedClock, InMemoryMetrics } from '@ddd-ts-kit/kernel';
import {
  BULKHEAD_FULL,
  BulkheadFullError,
  CIRCUIT_OPEN,
  CircuitOpenError,
  TIMEOUT,
  TimeoutError,
  bulkhead,
  circuitBreaker,
  circuitStateGauge,
  compose,
  delayBeforeRetry,
  fullJitter,
  isTransient,
  noJitter,
  retry,
  timeout,
  type CircuitStateChange,
} from '../src/index.js';
import { ManualScheduler, createAspectFakes, withAspectRuntime } from '../src/testing.js';
import { PairNotQuoted, QuoteGateway, SlowGateway, Unreachable, settled } from './support/adapters.js';

function recordingSleep(): { delays: number[]; sleep: (delayMs: number) => Promise<void> } {
  const delays: number[] = [];
  return { delays, sleep: async (delayMs) => void delays.push(delayMs) };
}

describe('retry', () => {
  it('calls again after a fault until the call succeeds', async () => {
    const { delays, sleep } = recordingSleep();
    const gateway = retry({ attempts: 3, backoff: { baseMs: 100, jitter: noJitter }, sleep })(
      new QuoteGateway().failNext(new Unreachable(), new Unreachable()),
    );

    expect(await gateway.quote('EUR-USD')).toMatchObject({ pair: 'EUR-USD' });

    expect(gateway.calls).toHaveLength(3);
    expect(delays).toEqual([100, 200]);
  });

  it('gives up after the last attempt with the last error', async () => {
    const { delays, sleep } = recordingSleep();
    const last = new Unreachable();
    const gateway = retry({ attempts: 2, sleep })(new QuoteGateway().failNext(new Unreachable(), last));

    await expect(gateway.quote('EUR-USD')).rejects.toBe(last);

    expect(gateway.calls).toHaveLength(2);
    expect(delays).toHaveLength(1);
  });

  it('never retries a business refusal by default', async () => {
    const { delays, sleep } = recordingSleep();
    const gateway = retry({ attempts: 5, sleep })(new QuoteGateway().failNext(new PairNotQuoted()));

    await expect(gateway.quote('EUR-USD')).rejects.toBeInstanceOf(PairNotQuoted);

    expect(gateway.calls).toHaveLength(1);
    expect(delays).toEqual([]);
  });

  it('retries only what retryOn accepts', async () => {
    const { sleep } = recordingSleep();
    const gateway = retry({ attempts: 5, sleep, retryOn: (error) => error instanceof Unreachable })(
      new QuoteGateway().failNext(new Unreachable(), new RangeError('bad pair')),
    );

    await expect(gateway.quote('EUR-USD')).rejects.toBeInstanceOf(RangeError);

    expect(gateway.calls).toHaveLength(2);
  });

  it('backs off exponentially up to the maximum, with a jitter a test can fix', () => {
    const backoff = { baseMs: 100, factor: 3, maxMs: 1000, jitter: noJitter };

    expect([1, 2, 3, 4].map((attempt) => delayBeforeRetry(attempt, backoff))).toEqual([100, 300, 900, 1000]);
    expect(delayBeforeRetry(2, { baseMs: 100, jitter: fullJitter(() => 0.25) })).toBe(50);
    expect(delayBeforeRetry(1, { baseMs: 100 })).toBeLessThanOrEqual(100);
  });

  it('waits on the scheduler of the runtime when no sleep is given', async () => {
    const fakes = createAspectFakes();
    const gateway = retry({ attempts: 2, backoff: { baseMs: 500, jitter: noJitter } })(
      new QuoteGateway().failNext(new Unreachable()),
    );

    const pending = withAspectRuntime(fakes, () => gateway.quote('EUR-USD'));
    await settled();
    expect(gateway.calls).toHaveLength(1);
    fakes.scheduler.advance(500);

    expect(await pending).toMatchObject({ pair: 'EUR-USD' });
    expect(gateway.calls).toHaveLength(2);
  });

  it('holds that the refusals protecting a dependency are not transient', () => {
    expect(isTransient(new Unreachable())).toBe(true);
    expect(isTransient(new TimeoutError('Gateway.quote', 100))).toBe(true);
    expect(isTransient(new PairNotQuoted())).toBe(false);
    expect(isTransient(new CircuitOpenError('Gateway.quote', new Date(0)))).toBe(false);
    expect(isTransient(new BulkheadFullError('Gateway.quote'))).toBe(false);
  });

  it('refuses a number of attempts that makes no call', () => {
    expect(() => retry({ attempts: 0 })).toThrow(RangeError);
  });
});

describe('timeout', () => {
  it('lets a call that answers in time through and forgets its timer', async () => {
    const scheduler = new ManualScheduler();
    const gateway = timeout(2000, { scheduler })(new SlowGateway());

    const pending = gateway.fetch('a');
    gateway.release('ok');

    expect(await pending).toBe('a:ok');
    expect(scheduler.pending).toBe(0);
  });

  it('rejects with a TimeoutError carrying a stable code once the time is up', async () => {
    const scheduler = new ManualScheduler();
    const gateway = timeout(2000, { scheduler })(new SlowGateway());

    const pending = gateway.fetch('customer-4111');
    scheduler.advance(1999);
    scheduler.advance(1);

    const error = await pending.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).toMatchObject({ code: TIMEOUT, timeoutMs: 2000, message: 'SlowGateway.fetch did not answer within 2000 ms' });
  });

  it('does not touch the arguments unless asked to pass a signal', async () => {
    const scheduler = new ManualScheduler();
    const gateway = timeout(2000, { scheduler })(new SlowGateway());

    const pending = gateway.fetch('a');
    gateway.release();
    await pending;

    expect(gateway.signals).toEqual([undefined]);
  });

  it('hands the method a signal as its last parameter and aborts it when the time is up', async () => {
    const scheduler = new ManualScheduler();
    const gateway = timeout(2000, { scheduler, signal: true })(new SlowGateway());

    const pending = gateway.fetch('a');
    const [signal] = gateway.signals;
    expect(signal?.aborted).toBe(false);
    scheduler.advance(2000);

    await expect(pending).rejects.toBeInstanceOf(TimeoutError);
    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toBeInstanceOf(TimeoutError);
  });

  it('keeps the signal of the caller: either one aborts', async () => {
    const scheduler = new ManualScheduler();
    const gateway = timeout(2000, { scheduler, signal: true })(new SlowGateway());
    const caller = new AbortController();

    const pending = gateway.fetch('a', caller.signal);
    caller.abort();
    gateway.release();
    await pending;

    expect(gateway.signals[0]).not.toBe(caller.signal);
    expect(gateway.signals[0]?.aborted).toBe(true);
  });

  it('passes no signal to a method that declares no parameter', async () => {
    const scheduler = new ManualScheduler();
    const gateway = timeout(2000, { scheduler, signal: true })(new SlowGateway());

    const pending = gateway.ping();
    gateway.release('pong');

    expect(await pending).toBe('pong');
  });

  it('bounds each attempt when inside retry', async () => {
    const fakes = createAspectFakes();
    const gateway = compose(retry({ attempts: 2, sleep: async () => undefined }), timeout(1000))(new SlowGateway());

    const pending = withAspectRuntime(fakes, () => gateway.fetch('a'));
    fakes.scheduler.advance(1000);
    await settled();
    expect(gateway.started).toBe(2);
    gateway.release();
    gateway.release('second');

    expect(await pending).toBe('a:second');
  });

  it('refuses a duration that is not positive', () => {
    expect(() => timeout(0)).toThrow(RangeError);
  });
});

class FlakyGateway extends SlowGateway {
  async fail(): Promise<never> {
    throw new Unreachable();
  }

  override async ping(): Promise<string> {
    return 'pong';
  }
}

describe('circuitBreaker', () => {
  const start = new Date('2026-03-01T10:00:00.000Z');

  function failing(gateway: QuoteGateway, times: number): Promise<unknown[]> {
    gateway.failNext(...Array.from({ length: times }, () => new Unreachable()));
    return Promise.all(Array.from({ length: times }, () => gateway.quote('EUR-USD').catch((error: unknown) => error)));
  }

  it('opens after the threshold of consecutive failures and stops calling', async () => {
    const clock = new FixedClock(start);
    const gateway = circuitBreaker({ failureThreshold: 2, resetAfterMs: 30_000, clock })(new QuoteGateway());

    await failing(gateway, 2);
    const refused = await gateway.quote('EUR-USD').catch((error: unknown) => error);

    expect(refused).toBeInstanceOf(CircuitOpenError);
    expect(refused).toMatchObject({ code: CIRCUIT_OPEN, retryAt: new Date('2026-03-01T10:00:30.000Z') });
    expect(gateway.calls).toHaveLength(2);
  });

  it('counts consecutive failures only: a success starts over', async () => {
    const clock = new FixedClock(start);
    const gateway = circuitBreaker({ failureThreshold: 2, resetAfterMs: 30_000, clock })(new QuoteGateway());

    await failing(gateway, 1);
    await gateway.quote('EUR-USD');
    await failing(gateway, 1);

    await expect(gateway.quote('EUR-USD')).resolves.toBeDefined();
  });

  it('does not count a business refusal: the dependency answered', async () => {
    const clock = new FixedClock(start);
    const gateway = circuitBreaker({ failureThreshold: 1, resetAfterMs: 30_000, clock })(new QuoteGateway());

    await gateway.failNext(new PairNotQuoted()).quote('EUR-USD').catch(() => undefined);

    await expect(gateway.quote('EUR-USD')).resolves.toBeDefined();
  });

  it('lets a trial call through after the reset time and closes when it succeeds', async () => {
    const clock = new FixedClock(start);
    const changes: CircuitStateChange[] = [];
    const gateway = circuitBreaker({
      failureThreshold: 1,
      resetAfterMs: 30_000,
      clock,
      onStateChange: (change) => changes.push(change),
    })(new QuoteGateway(), { context: 'pricing' });

    await failing(gateway, 1);
    clock.advance(29_999);
    await expect(gateway.quote('EUR-USD')).rejects.toBeInstanceOf(CircuitOpenError);
    clock.advance(1);
    await gateway.quote('EUR-USD');
    await gateway.quote('EUR-USD');

    expect(changes.map(({ from, to }) => `${from} -> ${to}`)).toEqual([
      'closed -> open',
      'open -> half-open',
      'half-open -> closed',
    ]);
    expect(changes[0]).toEqual({ className: 'QuoteGateway', method: 'quote', context: 'pricing', from: 'closed', to: 'open' });
  });

  it('opens again when the trial call fails', async () => {
    const clock = new FixedClock(start);
    const gateway = circuitBreaker({ failureThreshold: 3, resetAfterMs: 30_000, clock })(new QuoteGateway());

    await failing(gateway, 3);
    clock.advance(30_000);
    await failing(gateway, 1);
    const refused = await gateway.quote('EUR-USD').catch((error: unknown) => error);

    expect(refused).toMatchObject({ code: CIRCUIT_OPEN, retryAt: new Date('2026-03-01T10:01:00.000Z') });
  });

  it('lets only halfOpenMax trial calls through at once', async () => {
    const clock = new FixedClock(start);
    const gateway = circuitBreaker({
      failureThreshold: 1,
      resetAfterMs: 1000,
      halfOpenMax: 2,
      clock,
      scope: 'instance',
    })(new FlakyGateway());
    await gateway.fail().catch(() => undefined);
    clock.advance(1000);

    const trials = [gateway.fetch('a'), gateway.fetch('b')];
    await expect(gateway.fetch('c')).rejects.toBeInstanceOf(CircuitOpenError);
    gateway.release();
    gateway.release();

    expect(await Promise.all(trials)).toEqual(['a:done', 'b:done']);
    expect(gateway.started).toBe(2);
    await expect(gateway.ping()).resolves.toBe('pong');
  });

  it('keeps one circuit per method unless told to share it across the instance', async () => {
    const clock = new FixedClock(start);
    const perMethod = circuitBreaker({ failureThreshold: 1, resetAfterMs: 1000, clock })(new QuoteGateway());
    const shared = circuitBreaker({ failureThreshold: 1, resetAfterMs: 1000, clock, scope: 'instance' })(new QuoteGateway());

    await failing(perMethod, 1);
    await failing(shared, 1);

    await expect(perMethod.reprice(1.1)).resolves.toBeUndefined();
    await expect(shared.reprice(1.1)).rejects.toMatchObject({ message: expect.stringContaining('QuoteGateway is not called') });
  });

  it('keeps one circuit per instance', async () => {
    const clock = new FixedClock(start);
    const breaker = circuitBreaker({ failureThreshold: 1, resetAfterMs: 1000, clock });
    const first = breaker(new QuoteGateway());
    const second = breaker(new QuoteGateway());

    await failing(first, 1);

    await expect(second.quote('EUR-USD')).resolves.toBeDefined();
  });

  it('publishes its state as a gauge', async () => {
    const clock = new FixedClock(start);
    const metrics = new InMemoryMetrics();
    const gateway = circuitBreaker({
      failureThreshold: 1,
      resetAfterMs: 1000,
      clock,
      onStateChange: circuitStateGauge(metrics),
    })(new QuoteGateway());

    await failing(gateway, 1);
    expect(metrics.gaugeValue('circuit_breaker_state', { class: 'QuoteGateway', method: 'quote' })).toBe(2);
    clock.advance(1000);
    await gateway.quote('EUR-USD');

    expect(metrics.samples.map((sample) => sample.value)).toEqual([2, 1, 0]);
  });
});

describe('bulkhead', () => {
  it('refuses at once the call beyond what may run', async () => {
    const gateway = bulkhead({ maxConcurrent: 2 })(new SlowGateway());

    const running = [gateway.fetch('a'), gateway.fetch('b')];
    const refused = await gateway.fetch('c').catch((error: unknown) => error);
    gateway.release();
    gateway.release();
    await Promise.all(running);

    expect(refused).toBeInstanceOf(BulkheadFullError);
    expect(refused).toMatchObject({ code: BULKHEAD_FULL });
    expect(gateway.started).toBe(2);
  });

  it('makes a call wait for a place when the queue allows, in order', async () => {
    const gateway = bulkhead({ maxConcurrent: 1, maxQueued: 1 })(new SlowGateway());

    const first = gateway.fetch('a');
    const second = gateway.fetch('b');
    await expect(gateway.fetch('c')).rejects.toBeInstanceOf(BulkheadFullError);
    await settled();
    expect(gateway.started).toBe(1);
    gateway.release('one');
    await first;
    await settled();
    expect(gateway.started).toBe(2);
    gateway.release('two');

    expect(await second).toBe('b:two');
  });

  it('frees the place of a call that failed', async () => {
    const gateway = bulkhead({ maxConcurrent: 1 })(new QuoteGateway().failNext(new Unreachable()));

    await gateway.quote('EUR-USD').catch(() => undefined);

    await expect(gateway.quote('EUR-USD')).resolves.toBeDefined();
  });

  it('shares the places across the methods of the instance when told to', async () => {
    const gateway = bulkhead({ maxConcurrent: 1, scope: 'instance' })(new SlowGateway());

    const running = gateway.fetch('a');
    await expect(gateway.ping()).rejects.toBeInstanceOf(BulkheadFullError);
    gateway.release();

    expect(await running).toBe('a:done');
  });

  it('refuses a bound that lets nothing run', () => {
    expect(() => bulkhead({ maxConcurrent: 0 })).toThrow(RangeError);
  });
});
