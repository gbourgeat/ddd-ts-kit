import { afterEach, describe, expect, it } from 'vitest';
import type { EventSubscribers } from '@ddd-ts-kit/kernel';
import { RedisStreamsEventBus, streamNamesOf, type RedisStreamsEventBusOptions, type RedisStreamsFailure } from '../src/event-bus.js';
import { PLACED, anEvent, failuresOf } from './support/events.js';
import { eventually, pause } from './support/waiting.js';

describe('RedisStreamsEventBus while the server is away', () => {
  const nowhere = 'redis://kit:secret@127.0.0.1:1';
  const buses: RedisStreamsEventBus[] = [];

  const busTo = (options: Partial<RedisStreamsEventBusOptions> = {}): RedisStreamsEventBus => {
    const bus = new RedisStreamsEventBus({ connection: nowhere, reconnect: { initialMs: 20, maxMs: 50 }, ...options });

    buses.push(bus);

    return bus;
  };

  afterEach(async () => {
    await Promise.all(buses.splice(0).map((bus) => bus.close()));
  });

  it('needs a consumer name to subscribe', () => {
    const anonymous = busTo();

    expect(() => anonymous.subscribe(PLACED, async () => undefined)).toThrow(expect.objectContaining({ code: 'CONSUMER_NAME_REQUIRED' }));
    expect(() => anonymous.forConsumer('')).toThrow(expect.objectContaining({ code: 'CONSUMER_NAME_REQUIRED' }));
  });

  it('gives each consuming context a subscriber of its own, as the EventSubscribers of the kernel', () => {
    const bus = busTo();
    const subscribers: EventSubscribers = { forContext: (name) => bus.forConsumer(name) };

    subscribers.forContext('billing').subscribe(PLACED, async () => undefined);
    subscribers.forContext('shipping').subscribe(PLACED, async () => undefined);

    expect(bus.describeTopology().groups.map((group) => group.name)).toEqual(['billing', 'shipping']);
  });

  it('describes what it creates, as data', () => {
    const bus = busTo({ prefix: 'shop-events', consumer: 'billing', retention: { maxLength: 100_000 } });

    bus.subscribe(PLACED, async () => undefined);
    bus.forConsumer('shipping').subscribe(PLACED, async () => undefined);

    expect(bus.describeTopology()).toEqual({
      streams: [
        { name: 'shop-events:ordering.order.placed', role: 'events', type: PLACED, retention: { maxLength: 100_000 } },
        { name: 'shop-events:ordering.order.placed:billing:dead', role: 'dead', type: PLACED, consumer: 'billing' },
        { name: 'shop-events:ordering.order.placed:shipping:dead', role: 'dead', type: PLACED, consumer: 'shipping' },
      ],
      groups: [
        { stream: 'shop-events:ordering.order.placed', name: 'billing', startFrom: 'new' },
        { stream: 'shop-events:ordering.order.placed', name: 'shipping', startFrom: 'new' },
      ],
    });

    expect(streamNamesOf({ consumer: 'billing', type: PLACED })).toEqual({
      events: 'integration-events:ordering.order.placed',
      dead: 'integration-events:ordering.order.placed:billing:dead',
    });
  });

  it('rejects a publication with a code, never with the URL, and reports the connection failures as codes', async () => {
    const reported: RedisStreamsFailure[] = [];
    const bus = busTo({ consumer: 'billing', onFailure: failuresOf(reported) });

    bus.subscribe(PLACED, async () => undefined);

    const failure: unknown = await bus.publish([anEvent('evt-1')]).catch((error: unknown) => error);

    await eventually(() => reported.length >= 3);

    expect(failure).toMatchObject({ code: 'BROKER_UNAVAILABLE', reason: 'ECONNREFUSED' });
    expect(String(failure)).not.toContain('secret');
    expect(new Set(reported.map((entry) => JSON.stringify(entry)))).toEqual(new Set(['{"kind":"connection","code":"ECONNREFUSED"}']));
    await expect(bus.assertTopology()).rejects.toMatchObject({ code: 'BROKER_UNAVAILABLE' });
  });

  it('closes at once, although it never connected', async () => {
    const bus = busTo({ consumer: 'billing' });

    bus.subscribe(PLACED, async () => undefined);
    await bus.publish([anEvent('evt-1')]).catch(() => undefined);

    expect(await Promise.race([bus.close().then(() => 'closed'), pause(1_000).then(() => 'hanging')])).toBe('closed');
  });
});
