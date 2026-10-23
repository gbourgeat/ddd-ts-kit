import { describe, expect, it } from 'vitest';
import { FixedClock, InMemoryMetrics } from '@ddd-ts-kit/kernel';
import { CIRCUIT_OPEN, CircuitOpenError, circuitBreaker, circuitStateGauge, type CircuitStateChange } from '../src';
import { FlakyGateway } from './support/flaky-gateway';
import { PairNotQuoted } from './support/pair-not-quoted';
import { QuoteGateway } from './support/quote-gateway';
import { Unreachable } from './support/unreachable';

const start = new Date('2026-03-01T10:00:00.000Z');

function failing(gateway: QuoteGateway, times: number): Promise<unknown[]> {
  gateway.failNext(...Array.from({ length: times }, () => new Unreachable()));

  return Promise.all(Array.from({ length: times }, () => gateway.quote('EUR-USD').catch((error: unknown) => error)));
}

describe('circuitBreaker', () => {
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

    await gateway
      .failNext(new PairNotQuoted())
      .quote('EUR-USD')
      .catch(() => undefined);

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

    expect(changes[0]).toEqual({
      className: 'QuoteGateway',
      method: 'quote',
      context: 'pricing',
      from: 'closed',
      to: 'open',
    });
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
});

describe('circuitBreaker, its trial calls, its scope and its gauge', () => {
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

    const shared = circuitBreaker({ failureThreshold: 1, resetAfterMs: 1000, clock, scope: 'instance' })(
      new QuoteGateway(),
    );

    await failing(perMethod, 1);
    await failing(shared, 1);

    await expect(perMethod.reprice(1.1)).resolves.toBeUndefined();

    await expect(shared.reprice(1.1)).rejects.toMatchObject({
      message: expect.stringContaining('QuoteGateway is not called'),
    });
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
