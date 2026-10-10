import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ATTEMPTS_EXHAUSTED, type RedisStreamsDelivery, type RedisStreamsFailure } from '../src/event-bus.js';
import { PLACED, anEvent, deliveriesOf, failuresOf, recorder, streamsOf, unique } from './support/events.js';
import { REAL_SERVER, SERVER_URL } from './support/server.js';
import { MAX_ATTEMPTS, Server } from './support/streams.js';
import { eventually } from './support/waiting.js';

describe.skipIf(!REAL_SERVER)(
  'RedisStreamsEventBus, taking over from an instance that died',
  { timeout: 30_000 },
  () => {
    let server: Server;

    beforeEach(() => {
      server = Server.connect(SERVER_URL);
    });

    afterEach(async () => {
      await server.dispose();
    });

    it('takes over what an instance that died left pending, once the visibility timeout has passed', async () => {
      const [prefix, consumer] = [unique('test-events'), unique('billing')];
      const settled: RedisStreamsDelivery[] = [];
      const streams = streamsOf(prefix, consumer);
      const publisher = server.bus({ prefix });

      await server.client.xgroup('CREATE', streams.events, consumer, '$', 'MKSTREAM');
      await publisher.publish([anEvent('evt-1')]);

      await server.client.xreadgroup(
        'GROUP',
        consumer,
        'an-instance-that-died',
        'COUNT',
        10,
        'STREAMS',
        streams.events,
        '>',
      );

      const survivor = server.bus({ prefix, consumer, visibilityTimeoutMs: 150, onDelivery: deliveriesOf(settled) });
      const billing = recorder();
      const started = Date.now();

      survivor.subscribe(PLACED, billing.handler);
      await server.settled(survivor);

      expect(billing.ids()).toEqual(['evt-1']);
      expect(Date.now() - started).toBeGreaterThanOrEqual(100);
      expect(settled).toEqual([{ stream: streams.events, consumer, attempt: 2, outcome: 'acknowledged' }]);
    });

    it('buries, without handling it again, an entry whose deliveries were all lost to crashes', async () => {
      const [prefix, consumer] = [unique('test-events'), unique('billing')];
      const reported: RedisStreamsFailure[] = [];
      const streams = streamsOf(prefix, consumer);

      await server.client.xgroup('CREATE', streams.events, consumer, '$', 'MKSTREAM');
      await server.bus({ prefix }).publish([anEvent('evt-1')]);
      await server.client.xreadgroup('GROUP', consumer, 'crashed-1', 'COUNT', 10, 'STREAMS', streams.events, '>');
      const [entry] = await server.entries(streams.events);

      for (const crashed of ['crashed-2', 'crashed-3']) {
        await server.client.xclaim(streams.events, consumer, crashed, 0, entry?.id ?? '');
      }

      const survivor = server.bus({ prefix, consumer, visibilityTimeoutMs: 50, onFailure: failuresOf(reported) });
      const billing = recorder();

      survivor.subscribe(PLACED, billing.handler);
      await eventually(async () => (await server.length(streams.dead)) === 1);

      expect(billing.received).toEqual([]);

      expect(reported).toEqual([
        expect.objectContaining({ kind: 'handler', code: ATTEMPTS_EXHAUSTED, attempt: MAX_ATTEMPTS + 1, dead: true }),
      ]);

      expect(await server.pending(streams.events, consumer)).toBe(0);
    });
  },
);
