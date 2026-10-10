import { describe, expect, it } from 'vitest';
import { TIMEOUT, TimeoutError, compose, retry, timeout } from '../src/index.js';
import { ManualScheduler, createAspectFakes, withAspectRuntime } from '../src/testing.js';
import { settled } from './support/settled.js';
import { SlowGateway } from './support/slow-gateway.js';

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

    expect(error).toMatchObject({
      code: TIMEOUT,
      timeoutMs: 2000,
      message: 'SlowGateway.fetch did not answer within 2000 ms',
    });
  });

  it('does not touch the arguments unless asked to pass a signal', async () => {
    const scheduler = new ManualScheduler();
    const gateway = timeout(2000, { scheduler })(new SlowGateway());

    const pending = gateway.fetch('a');

    gateway.release();
    await pending;

    expect(gateway.signals).toEqual([undefined]);
  });
});

describe('timeout, asked to pass a signal', () => {
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
});

describe('timeout, composed and checked', () => {
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
