import { describe, expect, it } from 'vitest';
import { TransactionTimeoutError } from '@ddd-ts-kit/kernel';
import {
  BulkheadFullError,
  CircuitOpenError,
  TimeoutError,
  delayBeforeRetry,
  fullJitter,
  isTransient,
  noJitter,
  retry,
} from '../src';
import { createAspectFakes, withAspectRuntime } from '../src/testing';
import { PairNotQuoted } from './support/pair-not-quoted';
import { QuoteGateway } from './support/quote-gateway';
import { settled } from './support/settled';
import { Unreachable } from './support/unreachable';

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

  it('holds that a unit of work the database could not serve in time is transient: a later attempt may get a connection', () => {
    expect(isTransient(new TransactionTimeoutError({ code: 'P2028' }))).toBe(true);
  });

  it('refuses a number of attempts that makes no call', () => {
    expect(() => retry({ attempts: 0 })).toThrow(RangeError);
  });
});
