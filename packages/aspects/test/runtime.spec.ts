import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryLogger } from '@ddd-ts-kit/kernel';
import { AspectRuntimeError, installAspectRuntime, logged, systemScheduler } from '../src';
import { ManualScheduler, createAspectFakes, withAspectRuntime } from '../src/testing';
import { QuoteGateway } from './support/quote-gateway';

afterEach(() => {
  installAspectRuntime({});
});

describe('the aspect runtime', () => {
  it('is read when a call is made, so it may be installed after the wrapping', async () => {
    const gateway = logged()(new QuoteGateway());
    const logger = new InMemoryLogger();

    await expect(gateway.quote('EUR-USD')).rejects.toBeInstanceOf(AspectRuntimeError);
    installAspectRuntime({ logger });
    await gateway.quote('EUR-USD');

    expect(logger.entries).toHaveLength(2);
  });

  it('is replaced for the duration of a test, across awaits, without leaking to another', async () => {
    const installed = new InMemoryLogger();

    installAspectRuntime({ logger: installed });
    const gateway = logged()(new QuoteGateway());
    const first = createAspectFakes();
    const second = createAspectFakes();

    await Promise.all([
      withAspectRuntime(first, async () => {
        await Promise.resolve();
        await gateway.quote('EUR-USD');
      }),
      withAspectRuntime(second, () => gateway.quote('EUR-GBP')),
    ]);

    await gateway.quote('EUR-JPY');

    expect([first.logger.entries.length, second.logger.entries.length, installed.entries.length]).toEqual([2, 2, 2]);
  });
});

describe('ManualScheduler', () => {
  it('runs what became due, in order, and moves the clock with it', () => {
    const { clock, scheduler } = createAspectFakes(new Date('2026-03-01T10:00:00.000Z'));
    const ran: string[] = [];

    scheduler.schedule(() => ran.push('late'), 300);
    scheduler.schedule(() => ran.push('early'), 100);
    const cancel = scheduler.schedule(() => ran.push('cancelled'), 200);

    cancel();
    scheduler.advance(100);
    expect(ran).toEqual(['early']);
    scheduler.advance(200);

    expect(ran).toEqual(['early', 'late']);
    expect(scheduler.pending).toBe(0);
    expect(clock.now()).toEqual(new Date('2026-03-01T10:00:00.300Z'));
    expect(new ManualScheduler().pending).toBe(0);
  });
});

describe('systemScheduler', () => {
  it('cancels work that is no longer wanted', async () => {
    const ran: string[] = [];

    const cancel = systemScheduler.schedule(() => ran.push('ran'), 0);

    cancel();
    await new Promise((resolve) => setImmediate(resolve));

    expect(ran).toEqual([]);
  });
});
