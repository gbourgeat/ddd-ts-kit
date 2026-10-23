import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEAD_REASON_HEADER, ERROR_CODE_HEADER, POISON_MESSAGE, queueNamesOf, type RabbitMqFailure } from '../src';
import type { Broker } from './support/broker';
import { BROKERS } from './support/brokers';
import { MAX_ATTEMPTS } from './support/environment';
import { PLACED, anEvent } from './support/events';
import { failuresOf } from './support/hooks';
import { recorder } from './support/recorder';
import { unique } from './support/unique';
import { eventually } from './support/waiting';

describe.each(BROKERS)('RabbitMqEventBus: dead letters, %s', { timeout: 30_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
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

  it('replays no more dead messages than the limit', async () => {
    const consumer = unique('billing');
    const bus = broker.bus({ consumer });
    const handled: string[] = [];
    let failing = true;

    bus.subscribe(PLACED, async (event) => {
      if (failing) {
        throw new Error('invoicing is down');
      }

      handled.push(event.id);
    });

    await bus.publish([anEvent('evt-1'), anEvent('evt-2'), anEvent('evt-3')]);
    await broker.settled(bus);
    failing = false;

    expect(await bus.replayDead({ consumer, type: PLACED }, 2)).toBe(2);
    await broker.settled(bus);

    expect(handled).toHaveLength(2);
    expect(await broker.readyIn(queueNamesOf({ consumer, type: PLACED }).dead)).toBe(1);
  });

  it('rejects, with the code of the broker, the replay of a consumer that has no dead queue', async () => {
    const bus = broker.bus();

    await expect(bus.replayDead({ consumer: unique('nobody'), type: PLACED })).rejects.toMatchObject({ code: 404 });
  });
});
