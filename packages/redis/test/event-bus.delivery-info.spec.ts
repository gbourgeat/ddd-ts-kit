import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EventDelivery } from '@ddd-ts-kit/kernel';
import { InvoicingFailed, PLACED, TRACEPARENT, anEvent, unique } from './support/events';
import { REAL_SERVER, SERVER_URL } from './support/server';
import { MAX_ATTEMPTS, Server } from './support/streams';

describe.skipIf(!REAL_SERVER)('RedisStreamsEventBus, what a handler is told of a delivery', { timeout: 30_000 }, () => {
  let server: Server;

  beforeEach(() => {
    server = Server.connect(SERVER_URL);
  });

  afterEach(async () => {
    await server.dispose();
  });

  it('says which attempt it is, of how many, on which stream, and hands the trace context over again at the redelivery', async () => {
    const [prefix, consumer] = [unique('test-events'), unique('billing')];
    const bus = server.bus({ prefix, consumer });
    const deliveries: (EventDelivery | undefined)[] = [];
    const contexts: (string | undefined)[] = [];

    bus.subscribe(PLACED, async (event, delivery) => {
      deliveries.push(delivery);
      contexts.push(event.traceparent);

      if (deliveries.length === 1) {
        throw new InvoicingFailed();
      }
    });

    await bus.publish([{ ...anEvent('evt-1'), traceparent: TRACEPARENT }]);
    await server.settled(bus);

    const told = { maxAttempts: MAX_ATTEMPTS, system: 'redis', destination: `${prefix}:${PLACED}`, consumer };

    expect(deliveries).toEqual([
      { attempt: 1, ...told },
      { attempt: 2, ...told },
    ]);

    expect(contexts).toEqual([TRACEPARENT, TRACEPARENT]);
    expect(bus.messagingSystem).toBe('redis');
  });
});
