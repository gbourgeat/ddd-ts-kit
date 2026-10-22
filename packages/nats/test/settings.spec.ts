import type { NatsConnection, NodeConnectionOptions } from '@nats-io/transport-node';
import { describe, expect, it } from 'vitest';
import type { NatsDelivery } from '../src/options/nats-delivery';
import type { NatsFailure } from '../src/options/nats-failure';
import { settingsOf } from '../src/options/settings-of';

const failure: NatsFailure = { kind: 'connection', code: 'ECONNREFUSED' };

const delivery: NatsDelivery = { consumer: 'billing_ordering_order_placed', attempt: 1, outcome: 'acknowledged' };

/** Answers no connection, as no server runs in the unit run, and remembers what it was asked to open. */
const unreachable = () => {
  const targets: NodeConnectionOptions[] = [];

  const connect = async (target: NodeConnectionOptions): Promise<NatsConnection> => {
    targets.push(target);

    throw new Error('no server in the unit run');
  };

  return { targets, connect };
};

const openedTarget = async (connection: string | readonly string[] | NodeConnectionOptions) => {
  const { targets, connect } = unreachable();

  await expect(settingsOf({ connection }, connect).open()).rejects.toThrow('no server in the unit run');

  return targets;
};

describe('the settings of a bus', () => {
  it('give every option its default', () => {
    const settings = settingsOf({ connection: 'nats://127.0.0.1:4222' }, unreachable().connect);

    expect(settings).toMatchObject({
      stream: 'integration-events',
      subjectPrefix: 'events',
      consumer: undefined,
      prefetch: 10,
      storage: 'file',
      replicas: 1,
      duplicateWindowMs: 120_000,
      ackWaitMs: 30_000,
      publishTimeoutMs: 5_000,
      retry: { maxAttempts: 5, delayMs: 5_000 },
      reconnect: { initialMs: 200, factor: 2, maxMs: 30_000 },
    });
  });

  it('keep what the options give', () => {
    const settings = settingsOf(
      {
        connection: 'nats://127.0.0.1:4222',
        stream: 'shop-events',
        subjectPrefix: 'shop',
        consumer: 'billing',
        prefetch: 1,
        storage: 'memory',
        replicas: 3,
        duplicateWindowMs: 1_000,
        ackWaitMs: 2_000,
        publishTimeoutMs: 3_000,
        retry: { maxAttempts: 2, delayMs: 10 },
        reconnect: { initialMs: 5, factor: 3, maxMs: 50 },
      },
      unreachable().connect,
    );

    expect(settings).toMatchObject({
      stream: 'shop-events',
      subjectPrefix: 'shop',
      consumer: 'billing',
      prefetch: 1,
      storage: 'memory',
      replicas: 3,
      duplicateWindowMs: 1_000,
      ackWaitMs: 2_000,
      publishTimeoutMs: 3_000,
      retry: { maxAttempts: 2, delayMs: 10 },
      reconnect: { initialMs: 5, factor: 3, maxMs: 50 },
    });
  });

  it('complete a partial retry or reconnection option with the defaults', () => {
    const settings = settingsOf(
      { connection: 'nats://127.0.0.1:4222', retry: { maxAttempts: 9 }, reconnect: { maxMs: 1_000 } },
      unreachable().connect,
    );

    expect(settings.retry).toEqual({ maxAttempts: 9, delayMs: 5_000 });
    expect(settings.reconnect).toEqual({ initialMs: 200, factor: 2, maxMs: 1_000 });
  });
});

describe('the connection a bus opens', () => {
  it('reaches the servers of a URL or of a list, and lets the client reconnect for ever', async () => {
    const reconnecting = { maxReconnectAttempts: -1, reconnectTimeWait: 200 };

    expect(await openedTarget('nats://127.0.0.1:4222')).toEqual([
      { ...reconnecting, servers: ['nats://127.0.0.1:4222'] },
    ]);

    expect(await openedTarget(['nats://a:4222', 'nats://b:4222'])).toEqual([
      { ...reconnecting, servers: ['nats://a:4222', 'nats://b:4222'] },
    ]);
  });

  it('waits the first delay of the reconnection between two attempts of the client', async () => {
    const { targets, connect } = unreachable();
    const settings = settingsOf({ connection: 'nats://127.0.0.1:4222', reconnect: { initialMs: 50 } }, connect);

    await expect(settings.open()).rejects.toThrow();

    expect(targets).toEqual([{ maxReconnectAttempts: -1, reconnectTimeWait: 50, servers: ['nats://127.0.0.1:4222'] }]);
  });

  it('keeps the connection options of the client over the defaults of the bus', async () => {
    const given: NodeConnectionOptions = { servers: 'nats://127.0.0.1:4222', maxReconnectAttempts: 3, name: 'billing' };

    expect(await openedTarget(given)).toEqual([{ reconnectTimeWait: 200, ...given }]);
  });

  it('is opened by the factory the options give, never by the client of the bus', () => {
    const { targets, connect } = unreachable();

    const factory = async (): Promise<NatsConnection> => {
      throw new Error('the factory opens it');
    };

    expect(settingsOf({ connection: factory }, connect).open).toBe(factory);
    expect(targets).toEqual([]);
  });
});

describe('the hooks of a bus', () => {
  it('receive the failures and the deliveries', () => {
    const failures: NatsFailure[] = [];
    const deliveries: NatsDelivery[] = [];

    const settings = settingsOf(
      {
        connection: 'nats://127.0.0.1:4222',
        onFailure: (seen) => failures.push(seen),
        onDelivery: (seen) => deliveries.push(seen),
      },
      unreachable().connect,
    );

    settings.onFailure(failure);
    settings.onDelivery(delivery);

    expect(failures).toEqual([failure]);
    expect(deliveries).toEqual([delivery]);
  });

  it('never throw out of the bus, even when they throw', () => {
    const settings = settingsOf(
      {
        connection: 'nats://127.0.0.1:4222',
        onFailure: () => {
          throw new Error('the metrics backend is down');
        },
        onDelivery: () => {
          throw new Error('the metrics backend is down');
        },
      },
      unreachable().connect,
    );

    expect(() => {
      settings.onFailure(failure);
    }).not.toThrow();

    expect(() => {
      settings.onDelivery(delivery);
    }).not.toThrow();
  });

  it('may be left out', () => {
    const settings = settingsOf({ connection: 'nats://127.0.0.1:4222' }, unreachable().connect);

    expect(() => {
      settings.onFailure(failure);
      settings.onDelivery(delivery);
    }).not.toThrow();
  });
});
