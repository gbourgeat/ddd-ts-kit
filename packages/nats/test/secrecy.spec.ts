import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { expectNoSecret } from '@ddd-ts-kit/testing';
import { NatsEventBus } from '../src';
import { BrokerLink } from '../src/connection/broker-link';
import { NATS_URL } from './support/environment';
import { PLACED } from './support/events';
import { unique } from './support/unique';

const PASSWORD = 'nats-password-c07e';
const TOKEN = 'nats-token-2d94';
const URL_WITH_PASSWORD = `nats://ordering:${PASSWORD}@127.0.0.1:1`;

describe('NatsEventBus: what it shows of its credentials', () => {
  it('shows neither the URL nor the options it connects with when it is serialised, spread, listed or inspected', async () => {
    const byUrl = new NatsEventBus({ connection: URL_WITH_PASSWORD, consumer: 'billing' });

    const byOptions = new NatsEventBus({
      connection: { servers: ['127.0.0.1:1'], user: 'ordering', pass: PASSWORD, token: TOKEN },
    });

    byUrl.subscribe(PLACED, async () => undefined);

    for (const bus of [byUrl, byOptions]) {
      expectNoSecret(bus, [PASSWORD, TOKEN, URL_WITH_PASSWORD]);
      expect(Object.keys(bus)).toEqual([]);
      expect(JSON.stringify({ bus })).toBe('{"bus":"NatsEventBus [connection concealed]"}');
      expect(inspect(bus)).toBe('NatsEventBus [connection concealed]');
    }

    await byUrl.close();
    await byOptions.close();
  });

  it('shows none of them through what a subscription hands back', async () => {
    const bus = new NatsEventBus({ connection: URL_WITH_PASSWORD });
    const subscriber = bus.forConsumer('billing');

    expectNoSecret(subscriber, [PASSWORD]);

    expectNoSecret(
      subscriber.subscribe(PLACED, async () => undefined),
      [PASSWORD],
    );

    await bus.close();
  });

  it('shows none of them through its link to the server either', async () => {
    const link = new BrokerLink(
      {
        open: () => Promise.reject(new Error(`cannot reach ${URL_WITH_PASSWORD}`)),
        reconnect: { initialMs: 1, factor: 1, maxMs: 1 },
      },
      { opened: async () => undefined, lost: () => undefined, failed: () => undefined },
    );

    expectNoSecret(link, [PASSWORD, TOKEN, URL_WITH_PASSWORD]);
    expect(Object.keys(link)).toEqual([]);
    expect(JSON.stringify({ link })).toBe('{"link":"BrokerLink [connection concealed]"}');
    expect(inspect(link)).toBe('BrokerLink [connection concealed]');

    await link.close();
  });

  it.skipIf(NATS_URL === undefined)(
    'shows none of them once connected, when it holds a live connection',
    { timeout: 30_000 },
    async () => {
      const bus = new NatsEventBus({
        connection: { servers: [NATS_URL ?? ''], user: 'ordering', pass: PASSWORD },
        stream: unique('TEST'),
        subjectPrefix: unique('test'),
        consumer: unique('billing'),
      });

      bus.subscribe(PLACED, async () => undefined);
      await bus.assertTopology();

      expectNoSecret(bus, [PASSWORD]);
      expect(Object.keys(bus)).toEqual([]);

      await bus.close();
    },
  );
});
