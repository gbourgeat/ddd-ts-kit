import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type KafkaFailure } from '../src';
import type { Broker } from './support/broker';
import { BROKERS } from './support/brokers';
import { PLACED, TRACEPARENT, anEvent } from './support/events';
import { failuresOf } from './support/hooks';
import { orderOf } from './support/order-of';

describe.each(BROKERS)('KafkaEventBus: publishing, %s', { timeout: 60_000 }, (_name, connect) => {
  let broker: Broker;

  beforeEach(async () => {
    broker = await connect();
  });

  afterEach(async () => {
    await broker.dispose();
  }, 30_000);

  it('writes a record routed by type, keyed, identified and traceable from its headers', async () => {
    const event = { ...anEvent('evt-1'), version: 3, traceparent: TRACEPARENT, correlationId: 'corr-1' };

    await broker.bus().publish([event]);
    await broker.bus({ keyOf: orderOf }).publish([anEvent('evt-2')]);
    const [first, second] = await broker.recordsOf(broker.topicOf(PLACED));

    expect(first?.key).toBe('evt-1');

    expect(first?.headers).toEqual({
      'x-event-id': 'evt-1',
      'x-event-type': PLACED,
      'x-event-version': '3',
      traceparent: TRACEPARENT,
      'x-correlation-id': 'corr-1',
    });

    expect(JSON.parse(first?.value ?? '')).toEqual(event);
    expect(second?.key).toBe('order-evt-2');
    expect(second?.headers).toEqual({ 'x-event-id': 'evt-2', 'x-event-type': PLACED, 'x-event-version': '1' });
  });

  it('creates the topic of a published type with the configured partitions, once', async () => {
    const bus = broker.bus({ topics: { partitions: 3 } });

    await bus.publish([anEvent('evt-1')]);
    await broker.bus({ topics: { partitions: 5 } }).publish([anEvent('evt-2')]);

    expect(await broker.partitionsOf(broker.topicOf(PLACED))).toBe(3);
    expect(await broker.countIn(broker.topicOf(PLACED))).toBe(2);
  });

  it('rejects an event whose topic does not exist when it is told not to create topics', async () => {
    const bus = broker.bus({ topics: { create: false }, publishTimeoutMs: 1_000 });

    const failure: unknown = await bus.publish([anEvent('evt-1')]).catch((error: unknown) => error);

    expect(failure).toMatchObject({ code: 'PUBLISH_NOT_ACKNOWLEDGED', eventIds: ['evt-1'] });
    expect(await broker.countIn(broker.topicOf(PLACED))).toBe(0);
  });

  it('fails with a code, never with the address, when the cluster cannot be reached', async () => {
    const reported: KafkaFailure[] = [];

    const bus = broker.bus({
      ...broker.unreachable(),
      connectTimeoutMs: 500,
      onFailure: failuresOf(reported),
    });

    const failure: unknown = await bus.publish([anEvent('evt-1')]).catch((error: unknown) => error);

    expect(failure).toMatchObject({ code: 'BROKER_UNAVAILABLE' });
    expect(String(failure)).not.toContain('127.0.0.1');
    expect(reported.every((report) => report.kind === 'connection')).toBe(true);
  });

  it('publishes nothing, and connects to nothing, for no event', async () => {
    const reported: KafkaFailure[] = [];
    const bus = broker.bus({ ...broker.unreachable(), onFailure: failuresOf(reported) });

    expect(await bus.publish([])).toBeUndefined();
    expect(reported).toEqual([]);
  });

  it('reports a producer it cannot connect when it creates no topic first', async () => {
    const reported: KafkaFailure[] = [];

    const bus = broker.bus({
      ...broker.unreachable(),
      topics: { create: false },
      connectTimeoutMs: 500,
      onFailure: failuresOf(reported),
    });

    await expect(bus.publish([anEvent('evt-1')])).rejects.toMatchObject({ code: 'BROKER_UNAVAILABLE' });
    expect(reported).toContainEqual(expect.objectContaining({ kind: 'connection' }));
  });
});
