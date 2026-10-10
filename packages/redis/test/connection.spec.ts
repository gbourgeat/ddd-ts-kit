import { Redis } from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';
import { FAIL_FAST, connectRedis, redisHealth } from '../src/index.js';
import { REAL_SERVER, SERVER_URL, closeAll, connect, connectToNothing } from './support/server.js';

afterAll(closeAll);

describe.skipIf(!REAL_SERVER)('connectRedis on a server', () => {
  it('opens a connection from a URL and closes it', async () => {
    const connection = connectRedis(SERVER_URL);

    expect(await connection.client.ping()).toBe('PONG');
    expect(connection.client.options).toMatchObject(FAIL_FAST);
    await connection.close();

    expect(connection.client.status).toBe('end');
    await connection.close();
  });

  it('opens a connection from options, which win over its defaults', async () => {
    const { hostname, port } = new URL(SERVER_URL);
    const connection = connectRedis({ host: hostname, port: Number(port), commandTimeout: 750 });

    expect(await connection.client.ping()).toBe('PONG');
    expect(connection.client.options).toMatchObject({ commandTimeout: 750, maxRetriesPerRequest: 1 });
    await connection.close();
  });

  it('uses a client it is handed as it is, and leaves it open', async () => {
    const client = connect();
    const connection = connectRedis(client);

    await connection.close();

    expect(connection.client).toBe(client);
    expect(await client.ping()).toBe('PONG');
  });

  it('reports a server that answers as up, with its latency', async () => {
    const health = await redisHealth(connect());

    expect(health.status).toBe('up');
    expect(health).toMatchObject({ latencyMs: expect.any(Number) });
  });
});

describe('redisHealth while the server is away', () => {
  it('reports it down instead of failing', async () => {
    expect(await redisHealth(connectToNothing())).toEqual({ status: 'down', reason: 'unreachable' });
  });

  it('reports a server that does not answer in time as down', async () => {
    const silent = new Redis({ host: '192.0.2.1', port: 6379, lazyConnect: true, retryStrategy: () => null, connectTimeout: 5_000 });

    silent.on('error', () => undefined);

    expect(await redisHealth(silent, { timeoutMs: 80 })).toEqual({ status: 'down', reason: 'timeout' });
    silent.disconnect();
  });
});
