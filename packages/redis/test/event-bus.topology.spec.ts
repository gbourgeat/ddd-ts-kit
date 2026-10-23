import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RedisStreamsFailure } from '../src/event-bus';
import { PLACED, anEvent, failuresOf, recorder, unique } from './support/events';
import { SERVERS, serverOf } from './support/servers';
import { Server } from './support/streams';
import { eventually } from './support/waiting';

describe.each(SERVERS)('RedisStreamsEventBus, topology, %s', { timeout: 30_000 }, (_name, start) => {
  const redis = serverOf(start);

  let server: Server;

  beforeEach(() => {
    server = Server.connect(redis.url);
  });

  afterEach(async () => {
    await server.dispose();
  });

  it('declares it idempotently: a group that exists keeps its position', async () => {
    const [prefix, consumer] = [unique('test-events'), unique('billing')];
    const bus = server.bus({ prefix, consumer });
    const billing = recorder();

    bus.subscribe(PLACED, billing.handler);

    await bus.assertTopology();
    await bus.publish([anEvent('evt-1')]);
    await server.settled(bus);
    await bus.assertTopology();
    await server.settled(bus);

    expect(billing.ids()).toEqual(['evt-1']);
    expect(await server.consumers(`${prefix}:${PLACED}`, consumer)).toBe(1);
  });

  it('starts a new consumer at the events published from then on, or at the beginning when asked to', async () => {
    const prefix = unique('test-events');
    const publisher = server.bus({ prefix });

    await publisher.publish([anEvent('evt-1')]);
    const latecomer = server.bus({ prefix });
    const historian = server.bus({ prefix, startFrom: 'beginning' });
    const [late, whole] = [recorder(), recorder()];

    latecomer.subscribe(PLACED, late.handler);
    historian.subscribe(PLACED, whole.handler);
    await Promise.all([latecomer.assertTopology(), historian.assertTopology()]);

    await publisher.publish([anEvent('evt-2')]);
    await Promise.all([server.settled(latecomer), server.settled(historian)]);

    expect(late.ids()).toEqual(['evt-2']);
    expect(whole.ids()).toEqual(['evt-1', 'evt-2']);
  });

  it('creates its groups again when the server lost them, and resumes consuming', async () => {
    const [prefix, consumer] = [unique('test-events'), unique('billing')];
    const reported: RedisStreamsFailure[] = [];
    const bus = server.bus({ prefix, consumer, onFailure: failuresOf(reported) });
    const billing = recorder();

    bus.subscribe(PLACED, billing.handler);
    await bus.publish([anEvent('evt-1')]);
    await server.settled(bus);

    await server.client.del(`${prefix}:${PLACED}`);
    await eventually(() => reported.length > 0);
    await eventually(async () => (await server.consumers(`${prefix}:${PLACED}`, consumer)) === 1);
    await bus.publish([anEvent('evt-2')]);
    await server.settled(bus);

    expect(billing.ids()).toEqual(['evt-1', 'evt-2']);
    expect(reported[0]).toMatchObject({ kind: 'connection', code: expect.stringMatching(/^REDIS_(NOGROUP|ERR)$/) });
  });
});
