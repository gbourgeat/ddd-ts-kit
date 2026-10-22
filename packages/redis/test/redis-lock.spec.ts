import type { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { RedisLock } from '../src';
import { lockContract } from '../src/testing';
import { REAL_SERVER, aNamespace, closeAll, connect, connectToNothing, sleep } from './support/server';

const runner = { describe, it, expect, beforeEach };

afterAll(closeAll);

describe.skipIf(!REAL_SERVER)('RedisLock on a server', () => {
  let client: Redis;

  beforeEach(() => {
    client ??= connect();
  });

  lockContract(runner, {
    name: 'RedisLock',
    createLock: () => new RedisLock(client, { namespace: aNamespace() }),
    elapse: sleep,
  });

  it('excludes the holders of other connections, as other processes are', async () => {
    const namespace = aNamespace();

    const processes = [connect(), connect(), connect(), connect()].map(
      (connection) => new RedisLock(connection, { namespace }),
    );

    const handles = await Promise.all(
      processes.flatMap((lock) => [
        lock.acquire('nightly-export', { ttlMs: 30_000 }),
        lock.acquire('nightly-export', { ttlMs: 30_000 }),
      ]),
    );

    expect(handles.filter((handle) => handle !== undefined)).toHaveLength(1);
  });

  it('stores a random owner under the key with the time to live, and keeps the fencing counter beside it', async () => {
    const namespace = aNamespace();
    const lock = new RedisLock(client, { namespace });

    const handle = await lock.acquire('nightly-export', { ttlMs: 45_000 });

    expect(await client.get(`${namespace}:{nightly-export}`)).toMatch(/^[0-9a-f]{32}$/);
    expect(await client.pttl(`${namespace}:{nightly-export}`)).toBeGreaterThan(40_000);
    expect(await client.get(`${namespace}:{nightly-export}:fence`)).toBe(String(handle?.fencingToken));
    expect(await client.pttl(`${namespace}:{nightly-export}:fence`)).toBe(-1);
  });

  it('gives a later holder a higher token than a holder whose lock expired, which a resource can compare', async () => {
    const lock = new RedisLock(client, { namespace: aNamespace() });
    const paused = await lock.acquire('nightly-export', { ttlMs: 60 });

    await sleep(120);

    const current = await lock.acquire('nightly-export', { ttlMs: 30_000 });

    expect(current?.fencingToken).toBe((paused?.fencingToken ?? 0) + 1);
  });

  it('serializes the work of those who wait for it', async () => {
    const namespace = aNamespace();
    const running = { now: 0, most: 0 };

    const work = async (lock: RedisLock) => {
      const handle = await lock.acquire('nightly-export', { ttlMs: 30_000, waitMs: 5_000 });

      if (handle === undefined) {
        return 'gave up';
      }

      running.now += 1;
      running.most = Math.max(running.most, running.now);
      await sleep(15);
      running.now -= 1;
      await handle.release();

      return 'done';
    };

    const outcomes = await Promise.all(
      [connect(), connect(), connect()].flatMap((connection) => [
        work(new RedisLock(connection, { namespace })),
        work(new RedisLock(connection, { namespace })),
      ]),
    );

    expect(outcomes).toEqual(Array.from({ length: 6 }, () => 'done'));
    expect(running.most).toBe(1);
  });
});

describe('RedisLock while the server is away', () => {
  it('fails: whether somebody holds the key cannot be known', async () => {
    await expect(new RedisLock(connectToNothing()).acquire('nightly-export', { ttlMs: 1_000 })).rejects.toThrow();
  });
});
