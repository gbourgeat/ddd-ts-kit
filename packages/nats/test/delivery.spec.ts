import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EventDelivery } from '@ddd-ts-kit/kernel';
import type { Broker } from './support/broker.js';
import { BROKERS } from './support/brokers.js';
import { MAX_ATTEMPTS } from './support/environment.js';
import { PLACED, TRACEPARENT, anEvent } from './support/events.js';
import { InvoicingFailed } from './support/invoicing-failed.js';
import { unique } from './support/unique.js';

describe.each(BROKERS)(
  'NatsEventBus: what a handler is told of a delivery, %s',
  { timeout: 30_000 },
  (_name, connect) => {
    let broker: Broker;

    beforeEach(async () => {
      broker = await connect();
    });

    afterEach(async () => {
      await broker.dispose();
    });

    it('says which attempt it is, of how many, on which subject, and hands the trace context over again at the redelivery', async () => {
      const consumer = unique('billing');
      const bus = broker.bus({ consumer });
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
      await broker.settled(bus);

      const told = {
        maxAttempts: MAX_ATTEMPTS,
        system: 'nats',
        consumer: broker.namesOf({ consumer, type: PLACED }).durable,
      };

      expect(deliveries).toMatchObject([
        { attempt: 1, ...told },
        { attempt: 2, ...told },
      ]);

      expect(deliveries[0]?.destination).toContain(PLACED);
      expect(contexts).toEqual([TRACEPARENT, TRACEPARENT]);
      expect(bus.messagingSystem).toBe('nats');
    });
  },
);
