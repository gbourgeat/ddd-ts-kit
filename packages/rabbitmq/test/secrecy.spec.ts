import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { expectNoSecret } from '@ddd-ts-kit/testing';
import { RabbitMqEventBus } from '../src';
import { AMQP_URL } from './support/environment';
import { PLACED } from './support/events';
import { unique } from './support/unique';

const PASSWORD = 'amqp-password-4be1';
const URL_WITH_PASSWORD = `amqp://ordering:${PASSWORD}@127.0.0.1:1`;

describe('RabbitMqEventBus: what it shows of its credentials', () => {
  it('shows neither the URL nor the options it connects with when it is serialised, spread, listed or inspected', async () => {
    const byUrl = new RabbitMqEventBus({ connection: URL_WITH_PASSWORD, consumer: 'billing' });

    const byOptions = new RabbitMqEventBus({
      connection: { hostname: '127.0.0.1', port: 1, username: 'ordering', password: PASSWORD },
    });

    byUrl.subscribe(PLACED, async () => undefined);

    for (const bus of [byUrl, byOptions]) {
      expectNoSecret(bus, [PASSWORD, URL_WITH_PASSWORD]);
      expect(Object.keys(bus)).toEqual([]);
      expect(JSON.stringify({ bus })).toBe('{"bus":"RabbitMqEventBus [connection concealed]"}');
      expect(inspect(bus)).toBe('RabbitMqEventBus [connection concealed]');
    }

    await byUrl.close();
    await byOptions.close();
  });

  it('shows none of them through what a subscription hands back', async () => {
    const bus = new RabbitMqEventBus({ connection: URL_WITH_PASSWORD });
    const subscriber = bus.forConsumer('billing');

    expectNoSecret(subscriber, [PASSWORD]);

    expectNoSecret(
      subscriber.subscribe(PLACED, async () => undefined),
      [PASSWORD],
    );

    await bus.close();
  });

  it.skipIf(AMQP_URL === undefined)(
    'shows none of them once connected, when it holds a live connection',
    { timeout: 30_000 },
    async () => {
      const url = AMQP_URL ?? '';

      const bus = new RabbitMqEventBus({
        connection: url,
        exchange: unique('test-events'),
        consumer: unique('billing'),
      });

      bus.subscribe(PLACED, async () => undefined);
      await bus.assertTopology();

      expectNoSecret(
        bus,
        [url, new URL(url).password].filter((secret) => secret !== ''),
      );

      expect(Object.keys(bus)).toEqual([]);

      await bus.close();
    },
  );
});
