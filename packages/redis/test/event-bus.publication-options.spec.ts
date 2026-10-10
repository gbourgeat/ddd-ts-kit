import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLACED, anEvent, unique } from './support/events.js';
import { REAL_SERVER, SERVER_URL } from './support/server.js';
import { Server } from './support/streams.js';
import { pause } from './support/waiting.js';

describe.skipIf(!REAL_SERVER)('RedisStreamsEventBus, publishing with the guard or with retention', { timeout: 30_000 }, () => {
  let server: Server;

  beforeEach(() => {
    server = Server.connect(SERVER_URL);
  });

  afterEach(async () => {
    await server.dispose();
  });

  it('appends a relay retry again by default, and only once under the publication guard', async () => {
    const [plain, guarded] = [unique('test-events'), unique('test-events')];
    const withoutGuard = server.bus({ prefix: plain });
    const withGuard = server.bus({ prefix: guarded, deduplication: { windowMs: 60_000 } });

    for (const bus of [withoutGuard, withGuard]) {
      await bus.publish([anEvent('evt-1'), anEvent('evt-2')]);
      await bus.publish([anEvent('evt-1')]);
    }

    expect(await server.length(`${plain}:${PLACED}`)).toBe(3);
    expect((await server.entries(`${guarded}:${PLACED}`)).map((entry) => entry.fields['id'])).toEqual(['evt-1', 'evt-2']);
    expect(await server.client.pttl(`${guarded}:${PLACED}:evt-1:published`)).toBeGreaterThan(50_000);
  });

  it('forgets a published id once the window of the guard has passed', async () => {
    const prefix = unique('test-events');
    const bus = server.bus({ prefix, deduplication: { windowMs: 40 } });

    await bus.publish([anEvent('evt-1')]);
    await pause(120);
    await bus.publish([anEvent('evt-1')]);

    expect(await server.length(`${prefix}:${PLACED}`)).toBe(2);
  });

  it('keeps everything by default, and trims a stream only when asked to', async () => {
    const [kept, capped, aged] = [unique('test-events'), unique('test-events'), unique('test-events')];
    const events = Array.from({ length: 400 }, (_, index) => anEvent(`evt-${String(index)}`));
    const cappedBus = server.bus({ prefix: capped, retention: { maxLength: 100 } });
    const agedBus = server.bus({ prefix: aged, retention: { maxAgeMs: 50 } });

    await server.bus({ prefix: kept }).publish(events);
    await cappedBus.publish(events);
    await cappedBus.publish(events);
    await agedBus.publish(events);
    await pause(150);
    await agedBus.publish(events);

    expect(await server.length(`${kept}:${PLACED}`)).toBe(400);
    expect(await server.length(`${capped}:${PLACED}`)).toBeLessThan(800);
    expect(await server.length(`${capped}:${PLACED}`)).toBeGreaterThanOrEqual(100);
    expect(await server.length(`${aged}:${PLACED}`)).toBeLessThan(800);
    expect(await server.length(`${aged}:${PLACED}`)).toBeGreaterThanOrEqual(400);
  });
});
