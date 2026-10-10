import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EventDelivery } from '@ddd-ts-kit/kernel';
import { Broker } from './support/broker.js';
import { KAFKA_BROKERS, MAX_ATTEMPTS } from './support/environment.js';
import { PLACED, TRACEPARENT, anEvent } from './support/events.js';
import { InvoicingFailed } from './support/invoicing-failed.js';

describe.skipIf(KAFKA_BROKERS === undefined)(
  'KafkaEventBus: what a handler is told of a delivery',
  { timeout: 60_000 },
  () => {
    let broker: Broker;

    beforeEach(async () => {
      broker = await Broker.connect(KAFKA_BROKERS ?? '');
    });

    afterEach(async () => {
      await broker.dispose();
    }, 30_000);

    it('says which attempt it is, of how many, on which topic, and hands the trace context over again at the redelivery', async () => {
      const consumer = broker.consumer('billing');
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

      const told = { maxAttempts: MAX_ATTEMPTS, system: 'kafka', destination: broker.topicOf(PLACED), consumer };

      expect(deliveries).toEqual([
        { attempt: 1, ...told },
        { attempt: 2, ...told },
      ]);

      expect(contexts).toEqual([TRACEPARENT, TRACEPARENT]);
      expect(bus.messagingSystem).toBe('kafka');
    });
  },
);
