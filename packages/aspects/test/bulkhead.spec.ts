import { describe, expect, it } from 'vitest';
import { BULKHEAD_FULL, BulkheadFullError, bulkhead } from '../src';
import { QuoteGateway } from './support/quote-gateway';
import { settled } from './support/settled';
import { SlowGateway } from './support/slow-gateway';
import { Unreachable } from './support/unreachable';

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
