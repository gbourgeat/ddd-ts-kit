import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RedisStreamsDelivery, RedisStreamsFailure } from '../src/event-bus';
import { InvoicingFailed, PLACED, anEvent, deliveriesOf, failuresOf, recorder, unique } from './support/events';
import { REAL_SERVER, SERVER_URL } from './support/server';
import { RETRY_DELAY_MS, Server } from './support/streams';
import { pause } from './support/waiting';

describe.skipIf(!REAL_SERVER)('RedisStreamsEventBus, retrying', { timeout: 30_000 }, () => {
  let server: Server;

  beforeEach(() => {
    server = Server.connect(SERVER_URL);
  });

  afterEach(async () => {
    await server.dispose();
  });

  it('delivers an event again, after the delay, when its handler failed', async () => {
    const [prefix, consumer] = [unique('test-events'), unique('billing')];
    const reported: RedisStreamsFailure[] = [];
    const settled: RedisStreamsDelivery[] = [];
    const bus = server.bus({ prefix, consumer, onFailure: failuresOf(reported), onDelivery: deliveriesOf(settled) });
    const billing = recorder(1);
    const moments: number[] = [];

    bus.subscribe(PLACED, async (event) => {
      moments.push(Date.now());
      await billing.handler(event);
    });

    await bus.publish([anEvent('evt-1')]);
    await server.settled(bus);

    expect(billing.ids()).toEqual(['evt-1', 'evt-1']);
    expect((moments[1] ?? 0) - (moments[0] ?? 0)).toBeGreaterThanOrEqual(RETRY_DELAY_MS);

    expect(settled.map(({ attempt, outcome }) => `${String(attempt)}:${outcome}`)).toEqual([
      '1:retried',
      '2:acknowledged',
    ]);

    expect(reported).toEqual([
      {
        kind: 'handler',
        stream: `${prefix}:${PLACED}`,
        consumer,
        eventId: 'evt-1',
        eventType: PLACED,
        code: 'INVOICING_FAILED',
        attempt: 1,
        dead: false,
      },
    ]);
  });

  it('counts the retry delay from the failure, not from the delivery', async () => {
    const bus = server.bus();
    const finished: number[] = [];
    const started: number[] = [];
    let failures = 1;

    bus.subscribe(PLACED, async () => {
      started.push(Date.now());
      await pause(RETRY_DELAY_MS * 2);
      finished.push(Date.now());

      if (failures > 0) {
        failures -= 1;
        throw new InvoicingFailed();
      }
    });

    await bus.publish([anEvent('evt-1')]);
    await server.settled(bus);

    expect((started[1] ?? 0) - (finished[0] ?? 0)).toBeGreaterThanOrEqual(RETRY_DELAY_MS - 5);
  });
});
