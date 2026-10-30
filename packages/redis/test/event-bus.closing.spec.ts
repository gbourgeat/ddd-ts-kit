import { Redis } from 'ioredis';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLACED, anEvent, recorder, unique } from './support/events';
import { FaultyNetwork } from './support/proxy';
import { SERVERS, serverOf } from './support/servers';
import { Server } from './support/streams';
import { eventually, pause } from './support/waiting';

describe.each(SERVERS)('RedisStreamsEventBus, closing, %s', { timeout: 30_000 }, (_name, start) => {
  const redis = serverOf(start);

  let server: Server;

  beforeEach(() => {
    server = Server.connect(redis.url);
  });

  afterEach(async () => {
    await server.dispose();
  });

  it('lets the handler in progress finish and acknowledge before it disconnects', async () => {
    const [prefix, consumer] = [unique('test-events'), unique('billing')];
    const bus = server.bus({ prefix, consumer });
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
    expect(await server.pending(`${prefix}:${PLACED}`, consumer)).toBe(0);
    expect(await server.consumers(`${prefix}:${PLACED}`, consumer)).toBe(0);
  });

  it('stays a member of its group when it leaves an entry pending, for another instance to claim it', async () => {
    const [prefix, consumer] = [unique('test-events'), unique('billing')];
    const bus = server.bus({ prefix, consumer, retry: { delayMs: 60_000 } });
    const billing = recorder(1);

    bus.subscribe(PLACED, billing.handler);
    await bus.publish([anEvent('evt-1')]);
    await eventually(() => billing.received.length === 1 && bus.deliveriesInFlight === 0);

    await bus.close();

    expect(await server.pending(`${prefix}:${PLACED}`, consumer)).toBe(1);
    expect(await server.consumers(`${prefix}:${PLACED}`, consumer)).toBe(1);
  });

  it('refuses to publish or subscribe once closed', async () => {
    const bus = server.bus();

    await bus.publish([anEvent('evt-1')]);

    await bus.close();
    await bus.close();

    await expect(bus.publish([anEvent('evt-2')])).rejects.toMatchObject({ code: 'EVENT_BUS_CLOSED' });

    expect(() => bus.subscribe(PLACED, async () => undefined)).toThrow(
      expect.objectContaining({ code: 'EVENT_BUS_CLOSED' }),
    );
  });

  it('leaves open a client it was handed, and closes only the readers it duplicated from it', async () => {
    const mine = new Redis(redis.url, { maxRetriesPerRequest: 1 });
    const bus = server.bus({ connection: mine });
    const billing = recorder();

    bus.subscribe(PLACED, billing.handler);
    await bus.publish([anEvent('evt-1')]);
    await server.settled(bus);

    await bus.close();

    expect(billing.ids()).toEqual(['evt-1']);
    expect(await mine.ping()).toBe('PONG');
    mine.disconnect();
  });

  it('connects a client it was handed that waits for its first command', async () => {
    const lazy = new Redis(redis.url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    const bus = server.bus({ connection: lazy });
    const billing = recorder();

    expect(lazy.status).toBe('wait');
    bus.subscribe(PLACED, billing.handler);
    await bus.publish([anEvent('evt-1')]);
    await server.settled(bus);

    expect(billing.ids()).toEqual(['evt-1']);
    await bus.close();
    lazy.disconnect();
  });

  it('refuses a publication that was still waiting for the connection when it closed', async () => {
    const network = await FaultyNetwork.to(redis.url);

    network.holdReplies();
    const bus = server.bus({ connection: network.url });

    const publication = bus.publish([anEvent('evt-1')]).then(
      () => 'published',
      (error: unknown) => error,
    );

    await eventually(() => network.bytesFromClient > 0);
    await bus.close();

    expect(await publication).toMatchObject({ code: 'EVENT_BUS_CLOSED' });
    await network.close();
  });
});
