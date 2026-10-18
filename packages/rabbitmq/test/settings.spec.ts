import type { ChannelModel, Options } from 'amqplib';
import { describe, expect, it } from 'vitest';
import type { RabbitMqDelivery } from '../src/options/rabbit-mq-delivery.js';
import type { RabbitMqFailure } from '../src/options/rabbit-mq-failure.js';
import { settingsOf } from '../src/options/settings-of.js';

const URL = 'amqp://kit:kit@127.0.0.1:5672';

const failure: RabbitMqFailure = { kind: 'connection', code: 'ECONNREFUSED' };

const delivery: RabbitMqDelivery = { queue: 'billing.ordering.order.placed', attempt: 1, outcome: 'acknowledged' };

/** Answers no connection, as no broker runs in the unit run, and remembers what it was asked to open. */
const unreachable = () => {
  const targets: (string | Options.Connect)[] = [];

  const connect = async (target: string | Options.Connect): Promise<ChannelModel> => {
    targets.push(target);

    throw new Error('no broker in the unit run');
  };

  return { targets, connect };
};

describe('the settings of a bus', () => {
  it('give every option its default', () => {
    const settings = settingsOf({ connection: URL }, unreachable().connect);

    expect(settings).toMatchObject({
      exchange: 'integration-events',
      consumer: undefined,
      prefetch: 10,
      queueType: 'quorum',
      failOnUnroutable: false,
      retry: { maxAttempts: 5, delayMs: 5_000 },
      reconnect: { initialMs: 200, factor: 2, maxMs: 30_000 },
    });
  });

  it('keep what the options give', () => {
    const settings = settingsOf(
      {
        connection: URL,
        exchange: 'shop-events',
        consumer: 'billing',
        prefetch: 1,
        queueType: 'classic',
        onUnroutable: 'fail',
        retry: { maxAttempts: 2, delayMs: 10 },
        reconnect: { initialMs: 5, factor: 3, maxMs: 50 },
      },
      unreachable().connect,
    );

    expect(settings).toMatchObject({
      exchange: 'shop-events',
      consumer: 'billing',
      prefetch: 1,
      queueType: 'classic',
      failOnUnroutable: true,
      retry: { maxAttempts: 2, delayMs: 10 },
      reconnect: { initialMs: 5, factor: 3, maxMs: 50 },
    });
  });

  it('ignore an unroutable event unless told to fail', () => {
    expect(settingsOf({ connection: URL, onUnroutable: 'ignore' }, unreachable().connect).failOnUnroutable).toBe(false);
  });

  it('complete a partial retry or reconnection option with the defaults', () => {
    const settings = settingsOf(
      { connection: URL, retry: { maxAttempts: 9 }, reconnect: { maxMs: 1_000 } },
      unreachable().connect,
    );

    expect(settings.retry).toEqual({ maxAttempts: 9, delayMs: 5_000 });
    expect(settings.reconnect).toEqual({ initialMs: 200, factor: 2, maxMs: 1_000 });
  });
});

describe('the connection a bus opens', () => {
  it('reaches the URL or the connection options as given', async () => {
    const options: Options.Connect = { hostname: '127.0.0.1', port: 5672, username: 'kit', password: 'kit' };

    for (const connection of [URL, options]) {
      const { targets, connect } = unreachable();

      await expect(settingsOf({ connection }, connect).open()).rejects.toThrow('no broker in the unit run');
      expect(targets).toEqual([connection]);
    }
  });

  it('is opened by the factory the options give, never by the client of the bus', () => {
    const { targets, connect } = unreachable();

    const factory = async (): Promise<ChannelModel> => {
      throw new Error('the factory opens it');
    };

    expect(settingsOf({ connection: factory }, connect).open).toBe(factory);
    expect(targets).toEqual([]);
  });
});

describe('the hooks of a bus', () => {
  it('receive the failures and the deliveries', () => {
    const failures: RabbitMqFailure[] = [];
    const deliveries: RabbitMqDelivery[] = [];

    const settings = settingsOf(
      { connection: URL, onFailure: (seen) => failures.push(seen), onDelivery: (seen) => deliveries.push(seen) },
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
        connection: URL,
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
    const settings = settingsOf({ connection: URL }, unreachable().connect);

    expect(() => {
      settings.onFailure(failure);
      settings.onDelivery(delivery);
    }).not.toThrow();
  });
});
