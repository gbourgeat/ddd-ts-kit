import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Broker } from './support/broker';
import { BROKERS } from './support/brokers';
import { PLACED, anEvent } from './support/events';
import { gate } from './support/gate';
import { recorder } from './support/recorder';
import { eventually } from './support/waiting';

describe.each(BROKERS)('NatsEventBus: a subscription that leaves, %s', { timeout: 30_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('closes a pull that opens after its subscription left: the messages wait for the next handler', async () => {
    const bus = broker.bus();
    const billing = recorder();

    await bus.assertTopology();
    const subscription = bus.subscribe(PLACED, async () => undefined);
    const [consumer] = bus.describeTopology().consumers;

    subscription.unsubscribe();
    await bus.publish([anEvent('evt-1')]);

    expect(await broker.waitingFor(consumer?.name ?? '')).toBe(1);

    bus.subscribe(PLACED, billing.handler);
    await eventually(() => billing.ids().includes('evt-1'));
  });

  it('hands back a message it had already received when its last handler leaves: the next handler gets it', async () => {
    const bus = broker.bus({ prefetch: 2 });
    const finish = gate();
    const billing = recorder();

    const first = bus.subscribe(PLACED, async () => {
      await finish.opened;
    });

    await bus.publish([anEvent('evt-1'), anEvent('evt-2'), anEvent('evt-3')]);

    const [consumer] = bus.describeTopology().consumers;

    // Two handlers run, which fills the prefetch: the third message waits in the client.
    await eventually(async () => (await broker.givenOutBy(consumer?.name ?? '')) === 3);
    // A reply on the connection of the bus comes after the message the server wrote before it.
    await bus.assertTopology();

    first.unsubscribe();
    finish.open();
    bus.subscribe(PLACED, billing.handler);

    await eventually(() => billing.ids().includes('evt-3'));

    expect(billing.ids()).toEqual(['evt-3']);
  });
});
