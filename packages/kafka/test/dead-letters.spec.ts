import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEAD_REASON_HEADER,
  ERROR_CODE_HEADER,
  POISON_MESSAGE,
  REPLAY_FOR_HEADER,
  deadTopicOf,
  type KafkaFailure,
} from '../src';
import type { Broker } from './support/broker';
import { BROKERS } from './support/brokers';
import { MAX_ATTEMPTS } from './support/environment';
import { PLACED, anEvent } from './support/events';
import { failuresOf } from './support/hooks';
import { recorder } from './support/recorder';

describe.each(BROKERS)('KafkaEventBus: dead letters, %s', { timeout: 60_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
  });

  afterEach(async () => {
    await broker.dispose();
  }, 30_000);

  it('replays dead letters to their consumer only, with a fresh attempt budget', async () => {
    const consumer = broker.consumer('billing');
    const billingBus = broker.bus({ consumer });
    const shippingBus = broker.bus();
    const [billing, shipping] = [recorder(MAX_ATTEMPTS), recorder()];

    billingBus.subscribe(PLACED, billing.handler);
    shippingBus.subscribe(PLACED, shipping.handler);
    const topic = broker.topicOf(PLACED);

    await billingBus.publish([anEvent('evt-1')]);
    await Promise.all([broker.settled(billingBus), broker.settled(shippingBus)]);
    expect(await billingBus.replayDead({ consumer, type: PLACED })).toBe(1);
    await Promise.all([broker.settled(billingBus), broker.settled(shippingBus)]);

    expect(billing.received).toHaveLength(MAX_ATTEMPTS + 1);
    expect(shipping.ids()).toEqual(['evt-1']);
    expect((await broker.recordsOf(topic))[1]?.headers).toMatchObject({ [REPLAY_FOR_HEADER]: consumer });
    expect(await billingBus.replayDead({ consumer, type: PLACED })).toBe(0);
  });

  it('copies a record that is not an envelope straight to the dead-letter topic and moves on', async () => {
    const consumer = broker.consumer('billing');
    const reported: KafkaFailure[] = [];
    const bus = broker.bus({ consumer, onFailure: failuresOf(reported) });
    const billing = recorder();

    bus.subscribe(PLACED, billing.handler);
    const topic = broker.topicOf(PLACED);

    await bus.assertTopology();

    await broker.send(topic, '{"id": not json');
    await broker.send(topic, JSON.stringify({ id: 'evt-0' }));
    await bus.publish([anEvent('evt-1')]);
    await broker.settled(bus);
    const dead = await broker.recordsOf(deadTopicOf(consumer, topic));

    expect(billing.ids()).toEqual(['evt-1']);

    expect(reported).toEqual([
      { kind: 'poison', consumer, topic, code: POISON_MESSAGE },
      { kind: 'poison', consumer, topic, code: POISON_MESSAGE },
    ]);

    expect(dead.map((record) => record.value)).toEqual(['{"id": not json', '{"id":"evt-0"}']);

    expect(dead[0]?.headers).toMatchObject({
      [ERROR_CODE_HEADER]: POISON_MESSAGE,
      [DEAD_REASON_HEADER]: 'poison',
    });
  });
});
