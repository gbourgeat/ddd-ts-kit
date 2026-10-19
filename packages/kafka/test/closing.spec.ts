import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Broker } from './support/broker.js';
import { BROKERS } from './support/brokers.js';
import { PLACED, anEvent } from './support/events.js';
import { recorder } from './support/recorder.js';
import { eventually, pause } from './support/waiting.js';

describe.each(BROKERS)('KafkaEventBus: closing, %s', { timeout: 60_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
  });

  afterEach(async () => {
    await broker.dispose();
  }, 30_000);

  it('lets the handler in progress finish and commit before it leaves the group', async () => {
    const consumer = broker.consumer('billing');
    const bus = broker.bus({ consumer });
    let finish: () => void = () => undefined;

    const working = new Promise<void>((resolve) => {
      finish = resolve;
    });

    const done: string[] = [];

    bus.subscribe(PLACED, async (event) => {
      await working;
      done.push(event.id);
    });

    await bus.publish([anEvent('evt-1')]);
    await eventually(() => bus.deliveriesInFlight === 1);

    const closing = bus.close().then(() => 'closed');

    expect(await Promise.race([closing, pause(100).then(() => 'draining')])).toBe('draining');
    finish();

    expect(await closing).toBe('closed');
    expect(done).toEqual(['evt-1']);
    expect(await broker.lagOf(consumer, [broker.topicOf(PLACED)])).toBe(0);
  });

  it('leaves a record that waits for its retry uncommitted, for the next start', async () => {
    const consumer = broker.consumer('billing');
    const bus = broker.bus({ consumer, retry: { delayMs: 60_000, maxAttempts: 3 } });
    const billing = recorder(1);

    bus.subscribe(PLACED, billing.handler);
    await bus.publish([anEvent('evt-1')]);
    await eventually(() => billing.received.length === 1);
    await bus.close();
    expect(await broker.lagOf(consumer, [broker.topicOf(PLACED)])).toBe(1);

    const restarted = broker.bus({ consumer });

    restarted.subscribe(PLACED, billing.handler);
    await broker.settled(restarted);

    expect(billing.ids()).toEqual(['evt-1', 'evt-1']);
  });

  it('refuses to publish or subscribe once closed', async () => {
    const bus = broker.bus();

    await bus.publish([anEvent('evt-1')]);

    await bus.close();
    await bus.close();

    await expect(bus.publish([anEvent('evt-2')])).rejects.toMatchObject({ code: 'EVENT_BUS_CLOSED' });

    expect(() => bus.subscribe(PLACED, async () => undefined)).toThrow(
      expect.objectContaining({ code: 'EVENT_BUS_CLOSED' }),
    );
  });

  it('refuses to declare its topology or to replay once closed', async () => {
    const bus = broker.bus();

    await bus.close();

    await expect(bus.assertTopology()).rejects.toMatchObject({ code: 'EVENT_BUS_CLOSED' });

    await expect(bus.replayDead({ consumer: 'billing', type: PLACED })).rejects.toMatchObject({
      code: 'EVENT_BUS_CLOSED',
    });
  });
});
