import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { queueNamesOf } from '../src/index.js';
import type { Broker } from './support/broker.js';
import { BROKERS } from './support/brokers.js';
import { PLACED, anEvent } from './support/events.js';
import { unique } from './support/unique.js';
import { eventually, pause } from './support/waiting.js';

describe.each(BROKERS)('RabbitMqEventBus: closing, %s', { timeout: 30_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
  });

  afterEach(async () => {
    await broker.dispose();
  });

  it('lets the handler in progress finish and acknowledge before it disconnects', async () => {
    const consumer = unique('billing');
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
    broker.remember(bus);

    const closing = bus.close().then(() => 'closed');

    expect(await Promise.race([closing, pause(100).then(() => 'draining')])).toBe('draining');
    finish();

    expect(await closing).toBe('closed');
    expect(done).toEqual(['evt-1']);
    expect(await broker.readyIn(queueNamesOf({ consumer, type: PLACED }).work)).toBe(0);
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

  it('gives up the connection it was opening when it is closed meanwhile', async () => {
    const bus = broker.bus();

    bus.subscribe(PLACED, async () => undefined);
    await bus.close();

    await expect(bus.publish([anEvent('evt-1')])).rejects.toMatchObject({ code: 'EVENT_BUS_CLOSED' });
    broker.remember(bus);
  });
});
