import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEAD_REASON_HEADER,
  ERROR_CODE_HEADER,
  POISON_MESSAGE,
  REPLAY_FOR_HEADER,
  deadStreamOf,
  type NatsFailure,
} from '../src';
import type { Broker } from './support/broker';
import { BROKERS } from './support/brokers';
import { MAX_ATTEMPTS } from './support/environment';
import { PLACED, anEvent } from './support/events';
import { failuresOf } from './support/hooks';
import { recorder } from './support/recorder';
import { unique } from './support/unique';
import { eventually } from './support/waiting';

describe.each(BROKERS)('NatsEventBus: dead letters, %s', { timeout: 30_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('replays dead messages to their consumer only, with a fresh attempt budget', async () => {
    const consumer = unique('billing');
    const billingBus = broker.bus({ consumer });
    const shippingBus = broker.bus();
    const [billing, shipping] = [recorder(MAX_ATTEMPTS), recorder()];

    billingBus.subscribe(PLACED, billing.handler);
    shippingBus.subscribe(PLACED, shipping.handler);
    await shippingBus.assertTopology();

    await billingBus.publish([anEvent('evt-1')]);
    await Promise.all([broker.settled(billingBus), broker.settled(shippingBus)]);
    expect(await billingBus.replayDead({ consumer, type: PLACED })).toBe(1);
    await Promise.all([broker.settled(billingBus), broker.settled(shippingBus)]);

    expect(billing.received).toHaveLength(MAX_ATTEMPTS + 1);
    expect(shipping.ids()).toEqual(['evt-1']);

    expect((await broker.published())[1]?.headers).toMatchObject({
      [REPLAY_FOR_HEADER]: broker.namesOf({ consumer, type: PLACED }).durable,
    });

    expect(await broker.dead()).toEqual([]);
    expect(await billingBus.replayDead({ consumer, type: PLACED })).toBe(0);
  });

  it('moves a message that is not an envelope straight to the dead-letter stream', async () => {
    const consumer = unique('billing');
    const reported: NatsFailure[] = [];
    const bus = broker.bus({ consumer, prefetch: 1, onFailure: failuresOf(reported) });
    const billing = recorder();

    bus.subscribe(PLACED, billing.handler);
    const names = broker.namesOf({ consumer, type: PLACED });

    await bus.assertTopology();

    await broker.send(names.subject, '{"id": not json');
    await broker.send(names.subject, JSON.stringify({ id: 'evt-0' }));
    await bus.publish([anEvent('evt-1')]);
    await broker.settled(bus);
    const dead = await broker.dead();

    expect(billing.ids()).toEqual(['evt-1']);

    expect(reported).toEqual([
      { kind: 'poison', consumer: names.durable, code: POISON_MESSAGE },
      { kind: 'poison', consumer: names.durable, code: POISON_MESSAGE },
    ]);

    expect(dead.map((message) => message.body)).toEqual(['{"id": not json', '{"id":"evt-0"}']);

    expect(dead[0]?.headers).toMatchObject({
      [ERROR_CODE_HEADER]: POISON_MESSAGE,
      [DEAD_REASON_HEADER]: 'poison',
    });
  });

  it('keeps a message it cannot bury, its dead-letter stream gone, and tries again', async () => {
    const bus = broker.bus();
    const billing = recorder(Number.POSITIVE_INFINITY);

    bus.subscribe(PLACED, billing.handler);
    await bus.assertTopology();
    await broker.deleteStream(deadStreamOf(broker.stream));
    await bus.publish([anEvent('evt-1')]);

    await eventually(() => billing.received.length > MAX_ATTEMPTS);
    expect(await broker.dead()).toEqual([]);
  });
});
