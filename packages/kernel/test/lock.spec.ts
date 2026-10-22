import { describe, expect, it } from 'vitest';
import { FixedClock, InMemoryLock } from '../src';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const HELD = { ttlMs: 1_000 };

describe('InMemoryLock', () => {
  it('gives a free key to one holder at a time, and numbers the acquisitions', async () => {
    const lock = new InMemoryLock(new FixedClock(NOW));

    const first = await lock.acquire('report', HELD);

    expect(await lock.acquire('report', HELD)).toBeUndefined();
    await first?.release();
    const second = await lock.acquire('report', HELD);

    expect([first?.key, first?.fencingToken, second?.fencingToken]).toEqual(['report', 1, 2]);
  });

  it('frees the key by itself once the time to live has passed, and ignores the late release', async () => {
    const clock = new FixedClock(NOW);
    const lock = new InMemoryLock(clock);
    const late = await lock.acquire('report', HELD);

    clock.advance(1_000);
    const next = await lock.acquire('report', HELD);

    await late?.release();

    expect(next?.fencingToken).toBe(2);
    expect(await lock.acquire('report', HELD)).toBeUndefined();
  });

  it('waits by the pauses it is given, without a timer', async () => {
    const pauses: number[] = [];
    const lock = new InMemoryLock(new FixedClock(NOW), { retryDelayMs: 40, sleep: async (ms) => void pauses.push(ms) });

    await lock.acquire('report', HELD);

    expect(await lock.acquire('report', { ...HELD, waitMs: 100 })).toBeUndefined();

    expect(pauses).toEqual([40, 40, 20]);
  });

  it('takes the key during the wait as soon as the holder is gone', async () => {
    const clock = new FixedClock(NOW);
    const waiting = new InMemoryLock(clock, { retryDelayMs: 10, sleep: async (ms) => clock.advance(ms * 10) });

    await waiting.acquire('report', { ttlMs: 250 });

    const second = await waiting.acquire('report', { ...HELD, waitMs: 100 });

    expect(second?.fencingToken).toBe(2);
  });
});
