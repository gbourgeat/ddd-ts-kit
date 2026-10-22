import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EventDelivery } from '@ddd-ts-kit/kernel';
import type { Broker } from './support/broker';
import { BROKERS } from './support/brokers';
import { MAX_ATTEMPTS } from './support/environment';
import { PLACED, TRACEPARENT, anEvent } from './support/events';
import { InvoicingFailed } from './support/invoicing-failed';

describe.each(BROKERS)(
  'RabbitMqEventBus: what a handler is told of a delivery, %s',
  { timeout: 30_000 },
  (_name, connect) => {
    let broker: Broker;

    beforeEach(async () => {
      broker = await connect();
    });

    afterEach(async () => {
      await broker.dispose();
    });

    it('says which attempt it is, of how many, on which queue, and hands the trace context over again at the redelivery', async () => {
      const bus = broker.bus();
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
        system: 'rabbitmq',
        destination: bus.describeTopology().queues[0]?.name,
      };

      expect(deliveries).toMatchObject([
        { attempt: 1, ...told },
        { attempt: 2, ...told },
      ]);

      expect(deliveries[0]?.consumer).toEqual(expect.any(String));
      expect(contexts).toEqual([TRACEPARENT, TRACEPARENT]);
      expect(bus.messagingSystem).toBe('rabbitmq');
    });
  },
);
