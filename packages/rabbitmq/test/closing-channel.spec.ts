import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { queueNamesOf } from '../src';
import { Broker } from './support/broker';
import { PLACED, anEvent } from './support/events';
import { recorder } from './support/recorder';
import { unique } from './support/unique';
import { eventually } from './support/waiting';

// The in-memory broker alone: a test cannot hold a real channel in its closing handshake, and a
// relay that holds the replies of a real broker would hold the cancellation of a consumer too.
describe('RabbitMqEventBus: a publication while its channel goes away', () => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.inMemory();
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('refuses a publication on a channel that is closing, as not confirmed and leaving no timer behind', async () => {
    const network = await broker.network();
    const bus = broker.bus({ connection: network.connection });

    await bus.assertTopology();
    network.beginClosing();

    await expect(bus.publish([anEvent('evt-1')])).rejects.toMatchObject({ code: 'PUBLISH_NOT_CONFIRMED' });

    network.restore();
    await network.close();
  });

  it('fails what was not confirmed when the bus drops its channel after losing a consumer', async () => {
    const network = await broker.network();
    const consumer = unique('billing');
    const bus = broker.bus({ connection: network.connection, consumer });

    bus.subscribe(PLACED, recorder().handler);
    await bus.assertTopology();

    network.holdReplies();
    const sent = network.traffic;
    const publication = bus.publish([anEvent('evt-1')]);
    const outcome = publication.catch((error: unknown) => error);

    await eventually(() => network.traffic > sent);
    await broker.deleteQueue(queueNamesOf({ consumer, type: PLACED }).work);

    expect(await outcome).toMatchObject({ code: 'PUBLISH_NOT_CONFIRMED' });

    network.restore();
    await network.close();
  });
});
