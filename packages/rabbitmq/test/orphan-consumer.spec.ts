import { afterEach, beforeEach, describe, it } from 'vitest';
import { queueNamesOf } from '../src';
import type { Broker } from './support/broker';
import { BROKERS } from './support/brokers';
import { PLACED, anEvent } from './support/events';
import { recorder } from './support/recorder';
import { unique } from './support/unique';
import { eventually } from './support/waiting';

describe.each(BROKERS)(
  'RabbitMqEventBus: a subscription removed while its consumer is registered, %s',
  { timeout: 30_000 },
  (_name, connect) => {
    let broker: Broker;

    beforeEach(async () => {
      broker = await connect();
    });

    afterEach(async () => {
      await broker.dispose();
    });

    it('cancels the consumer as soon as it is registered: the messages wait in the queue for the next handler', async () => {
      const consumer = unique('billing');
      const bus = broker.bus({ consumer });
      const { work } = queueNamesOf({ consumer, type: PLACED });
      const billing = recorder();

      await bus.assertTopology();
      const subscription = bus.subscribe(PLACED, async () => undefined);

      broker.remember(bus);
      subscription.unsubscribe();
      // `publish` waits for the consumers being registered: the one that lost its subscription is there or gone.
      await bus.publish([anEvent('evt-1')]);
      await eventually(async () => (await broker.consumersOn(work)) === 0);
      await eventually(async () => (await broker.readyIn(work)) === 1);

      bus.subscribe(PLACED, billing.handler);
      await eventually(() => billing.ids().includes('evt-1'));
    });
  },
);
