import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEAD_REASON_HEADER,
  ERROR_CODE_HEADER,
  POISON_MESSAGE,
  queueNamesOf,
  type RabbitMqFailure,
} from '../src/index.js';
import { Broker } from './support/broker.js';
import { AMQP_URL, MAX_ATTEMPTS } from './support/environment.js';
import { PLACED, anEvent } from './support/events.js';
import { failuresOf } from './support/hooks.js';
import { recorder } from './support/recorder.js';
import { unique } from './support/unique.js';
import { eventually } from './support/waiting.js';

describe.skipIf(AMQP_URL === undefined)('RabbitMqEventBus: dead letters', { timeout: 30_000 }, () => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await Broker.connect(AMQP_URL ?? '');
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('replays dead messages with a fresh attempt budget', async () => {
    const consumer = unique('billing');
    const bus = broker.bus({ consumer });
    const billing = recorder(MAX_ATTEMPTS);

    bus.subscribe(PLACED, billing.handler);

    await bus.publish([anEvent('evt-1')]);
    await broker.settled(bus);
    expect(await bus.replayDead({ consumer, type: PLACED })).toBe(1);
    await broker.settled(bus);

    expect(billing.received).toHaveLength(MAX_ATTEMPTS + 1);
    expect(await broker.readyIn(queueNamesOf({ consumer, type: PLACED }).dead)).toBe(0);
  });

  it('sends a message that is not an envelope straight to the dead queue', async () => {
    const consumer = unique('billing');
    const exchange = unique('test-events');
    const reported: RabbitMqFailure[] = [];
    const bus = broker.bus({ consumer, exchange, onFailure: failuresOf(reported) });
    const billing = recorder();

    bus.subscribe(PLACED, billing.handler);
    const queues = queueNamesOf({ consumer, type: PLACED });

    await bus.assertTopology();

    broker.send(exchange, PLACED, Buffer.from('{"id": not json'));
    broker.send(exchange, PLACED, Buffer.from(JSON.stringify({ id: 'evt-1' })));
    await eventually(async () => (await broker.readyIn(queues.dead)) === 2);
    const dead = await broker.take(queues.dead);

    expect(billing.received).toEqual([]);

    expect(reported).toEqual([
      { kind: 'poison', queue: queues.work, code: POISON_MESSAGE },
      { kind: 'poison', queue: queues.work, code: POISON_MESSAGE },
    ]);

    expect(dead?.properties.headers).toMatchObject({
      [ERROR_CODE_HEADER]: POISON_MESSAGE,
      [DEAD_REASON_HEADER]: 'poison',
    });

    expect(await broker.readyIn(queues.retry)).toBe(0);
  });
});
