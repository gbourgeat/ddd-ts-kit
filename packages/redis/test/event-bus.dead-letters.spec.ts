import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ATTEMPT_FIELD,
  CONSUMER_FIELD,
  DEAD_REASON_FIELD,
  ENVELOPE_FIELD,
  ERROR_CODE_FIELD,
  POISON_ENTRY,
  type RedisStreamsFailure,
} from '../src/event-bus';
import { PLACED, anEvent, failuresOf, recorder, streamsOf, unique } from './support/events';
import { REAL_SERVER, SERVER_URL } from './support/server';
import { MAX_ATTEMPTS, Server } from './support/streams';
import { eventually } from './support/waiting';

describe.skipIf(!REAL_SERVER)('RedisStreamsEventBus, dead letters', { timeout: 30_000 }, () => {
  let server: Server;

  beforeEach(() => {
    server = Server.connect(SERVER_URL);
  });

  afterEach(async () => {
    await server.dispose();
  });

  it('moves an event to the dead stream once its attempts are spent, with a code and no message', async () => {
    const [prefix, consumer] = [unique('test-events'), unique('billing')];
    const reported: RedisStreamsFailure[] = [];
    const bus = server.bus({ prefix, consumer, onFailure: failuresOf(reported) });
    const billing = recorder(Number.POSITIVE_INFINITY);

    bus.subscribe(PLACED, billing.handler);
    const streams = streamsOf(prefix, consumer);

    await bus.publish([anEvent('evt-1')]);
    await server.settled(bus);
    const [original] = await server.entries(streams.events);
    const dead = await server.entries(streams.dead);

    expect(billing.received).toHaveLength(MAX_ATTEMPTS);
    expect(reported.map((failure) => failure.kind === 'handler' && failure.dead)).toEqual([false, false, true]);
    expect(dead).toHaveLength(1);

    expect(dead[0]?.fields).toMatchObject({
      id: 'evt-1',
      type: PLACED,
      [ATTEMPT_FIELD]: String(MAX_ATTEMPTS),
      [ERROR_CODE_FIELD]: 'INVOICING_FAILED',
      [DEAD_REASON_FIELD]: 'max-attempts',
      [CONSUMER_FIELD]: consumer,
      'entry-id': original?.id,
    });

    expect(JSON.parse(dead[0]?.fields[ENVELOPE_FIELD] ?? '')).toEqual(anEvent('evt-1'));
    expect(JSON.stringify([reported, dead])).not.toContain('jane.doe');
    expect(await server.pending(streams.events, consumer)).toBe(0);
  });

  it('replays dead entries with a fresh attempt budget, for the consumer they died for only', async () => {
    const [prefix, consumer] = [unique('test-events'), unique('billing')];
    const bus = server.bus({ prefix, consumer });
    const billing = recorder(MAX_ATTEMPTS);
    const shipping = recorder();

    bus.subscribe(PLACED, billing.handler);
    bus.forConsumer(unique('shipping')).subscribe(PLACED, shipping.handler);

    await bus.publish([anEvent('evt-1')]);
    await server.settled(bus);
    expect(await bus.replayDead({ consumer, type: PLACED })).toBe(1);
    expect(await bus.replayDead({ consumer, type: PLACED })).toBe(0);
    await server.settled(bus);

    expect(billing.received).toHaveLength(MAX_ATTEMPTS + 1);
    expect(shipping.ids()).toEqual(['evt-1']);
    expect(await server.length(streamsOf(prefix, consumer).dead)).toBe(0);
  });

  it('sends an entry that does not hold an envelope straight to the dead stream', async () => {
    const [prefix, consumer] = [unique('test-events'), unique('billing')];
    const reported: RedisStreamsFailure[] = [];
    const bus = server.bus({ prefix, consumer, onFailure: failuresOf(reported) });
    const billing = recorder();

    bus.subscribe(PLACED, billing.handler);
    const streams = streamsOf(prefix, consumer);

    await bus.assertTopology();

    await server.append(streams.events, { envelope: '{"id": not json' });
    await server.append(streams.events, { envelope: JSON.stringify({ id: 'evt-1' }) });
    await server.append(streams.events, { note: 'no envelope at all' });
    await eventually(async () => (await server.length(streams.dead)) === 3);
    const dead = await server.entries(streams.dead);

    expect(billing.received).toEqual([]);

    expect(reported).toEqual(
      Array.from({ length: 3 }, () => ({ kind: 'poison', stream: streams.events, consumer, code: POISON_ENTRY })),
    );

    expect(dead[0]?.fields).toMatchObject({
      envelope: '{"id": not json',
      [ERROR_CODE_FIELD]: POISON_ENTRY,
      [DEAD_REASON_FIELD]: 'poison',
    });

    expect(await server.pending(streams.events, consumer)).toBe(0);
  });
});
