import { inspect } from 'node:util';
import { Redis } from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';
import { expectNoSecret } from '@ddd-ts-kit/testing';
import { RedisStreamsEventBus } from '../src/event-bus.js';
import { RedisCache, RedisLock, RedisRateLimiter, RedisRelaySignal, connectRedis } from '../src/index.js';
import { ServerLink } from '../src/streams/server-link.js';

const PASSWORD = 'redis-password-e2a8';
const URL_WITH_PASSWORD = `redis://ordering:${PASSWORD}@127.0.0.1:1`;
const AWAY = { host: '127.0.0.1', port: 1, password: PASSWORD, lazyConnect: true, retryStrategy: () => null, maxRetriesPerRequest: 0 };

const clients: Redis[] = [];

/** A client that carries a password and never connects: what it shows does not depend on a server. */
function aClientWithAPassword(): Redis {
  const client = new Redis(AWAY);

  client.on('error', () => undefined);
  clients.push(client);

  return client;
}

afterAll(() => {
  for (const client of clients) client.disconnect();
});

describe('the Redis adapters: what they show of the client they hold', () => {
  it('is nothing of its options, though the client itself shows its password', () => {
    const client = aClientWithAPassword();

    const adapters = {
      RedisCache: new RedisCache(client, { namespace: 'billing', lock: new RedisLock(client) }),
      RedisLock: new RedisLock(client),
      RedisRateLimiter: new RedisRateLimiter(client),
      RedisRelaySignal: new RedisRelaySignal(client),
    };

    expect(inspect(client, { depth: 3 })).toContain(PASSWORD);

    for (const [name, adapter] of Object.entries(adapters)) {
      expectNoSecret(adapter, [PASSWORD]);
      expect(Object.keys(adapter)).toEqual([]);
      expect(JSON.stringify({ adapter })).toBe(`{"adapter":"${name} [client concealed]"}`);
      expect(inspect(adapter)).toBe(`${name} [client concealed]`);
    }
  });

  it('is nothing either once a relay signal listens on a connection of its own', async () => {
    const signal = new RedisRelaySignal(aClientWithAPassword());

    signal.subscribe(() => undefined);

    expectNoSecret(signal, [PASSWORD]);

    await signal.close();
  });

  it('leaves the client of a connection reachable by name and by destructuring, not by enumeration', async () => {
    const connection = connectRedis(AWAY);
    const { client, close } = connection;

    client.on('error', () => undefined);

    expect(client).toBeInstanceOf(Redis);
    expect(connection.client).toBe(client);
    expectNoSecret(connection, [PASSWORD]);
    expect(Object.keys(connection)).toEqual(['close']);
    expect(inspect(connection)).toBe('RedisConnection [client concealed]');

    await close();
  });
});

describe('RedisStreamsEventBus: what it shows of its credentials', () => {
  it('shows neither the URL, nor the options, nor the client it is given when it is serialised, spread, listed or inspected', async () => {
    const buses = [
      new RedisStreamsEventBus({ connection: URL_WITH_PASSWORD, consumer: 'billing', reconnect: { initialMs: 60_000 } }),
      new RedisStreamsEventBus({ connection: AWAY, consumer: 'billing' }),
      new RedisStreamsEventBus({ connection: aClientWithAPassword(), consumer: 'billing' }),
    ];

    for (const bus of buses) {
      expectNoSecret(bus, [PASSWORD, URL_WITH_PASSWORD]);
      expectNoSecret(bus.forConsumer('shipping'), [PASSWORD, URL_WITH_PASSWORD]);
      expect(Object.keys(bus)).toEqual([]);
      expect(JSON.stringify({ bus })).toBe('{"bus":"RedisStreamsEventBus [connection concealed]"}');
      expect(inspect(bus)).toBe('RedisStreamsEventBus [connection concealed]');
    }

    await Promise.all(buses.map((bus) => bus.close()));
  });

  it('shows none of them through its link to the server either', async () => {
    const link = new ServerLink({ connection: AWAY, reconnect: { initialMs: 1, factor: 1, maxMs: 1 }, blockMs: 100 }, () => undefined);

    expectNoSecret(link, [PASSWORD]);
    expect(Object.keys(link)).toEqual([]);

    await link.close();
  });
});
