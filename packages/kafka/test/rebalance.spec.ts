import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Broker } from './support/broker';
import { RETRY_DELAY_MS } from './support/environment';
import { PLACED, anEvent } from './support/events';
import { InvoicingFailed } from './support/invoicing-failed';
import { recorder } from './support/recorder';
import { eventually, pause } from './support/waiting';

const CANCELLED = 'ordering.order.cancelled';

/**
 * The range assignor of the in-memory cluster gives the one partition of a topic to the member
 * with the lowest id: the member that joined the group first, on another topic, takes it over.
 * On a real cluster the member ids are random: these cases run in memory.
 */
describe('KafkaEventBus: a partition the group takes back, in memory', { timeout: 60_000 }, () => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.inMemory();
  });

  afterEach(async () => {
    await broker.dispose();
  });

  /** Two members of one group; the first has a lower id than the second. */
  function twoMembers() {
    const consumer = broker.consumer('billing');
    const options = { consumer, topics: { partitions: 1 }, startFrom: 'earliest' } as const;

    return { first: broker.bus(options), second: broker.bus(options) };
  }

  it('leaves to the new owner a record whose retry was pending when the partition went', async () => {
    const { first, second } = twoMembers();
    const [elsewhere, billing, taken] = [recorder(), recorder(1), recorder()];

    first.subscribe(CANCELLED, elsewhere.handler);
    await broker.settled(first);
    second.subscribe(PLACED, billing.handler);
    await second.publish([anEvent('evt-1')]);
    await eventually(() => billing.received.length === 1);

    first.subscribe(PLACED, taken.handler);
    await eventually(() => second.partitionsAssigned === 0);
    await eventually(() => taken.ids().includes('evt-1'));
    // The retry of the second member, due meanwhile, finds its partition gone.
    await pause(RETRY_DELAY_MS * 2);

    expect(billing.ids()).toEqual(['evt-1']);
    await broker.settled(first);
  });

  it('leaves to the new owner a record that fails after the partition went', async () => {
    const { first, second } = twoMembers();
    const [elsewhere, taken] = [recorder(), recorder()];
    const handled: string[] = [];
    let fail: () => void = () => undefined;

    const blocked = new Promise<void>((_resolve, reject) => {
      fail = () => reject(new InvoicingFailed());
    });

    first.subscribe(CANCELLED, elsewhere.handler);
    await broker.settled(first);

    second.subscribe(PLACED, async (event) => {
      handled.push(event.id);
      await blocked;
    });

    await second.publish([anEvent('evt-1')]);
    await eventually(() => handled.length === 1);

    first.subscribe(PLACED, taken.handler);
    await eventually(() => second.partitionsAssigned === 0);
    await eventually(() => taken.ids().includes('evt-1'));
    fail();
    await eventually(() => second.deliveriesInFlight === 0);

    expect(handled).toEqual(['evt-1']);
    await broker.settled(first);
  });
});
