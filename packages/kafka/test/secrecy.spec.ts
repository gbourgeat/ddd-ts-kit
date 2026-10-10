import { inspect } from 'node:util';
import type { GlobalConfig } from '@confluentinc/kafka-javascript';
import { describe, expect, it } from 'vitest';
import { expectNoSecret } from '@ddd-ts-kit/testing';
import { KafkaEventBus } from '../src/index.js';
import { BrokerLink } from '../src/connection/broker-link.js';
import { clusterOf } from '../src/connection/cluster-of.js';
import { KAFKA_BROKERS } from './support/environment.js';
import { unique } from './support/unique.js';

const PASSWORD = 'kafka-sasl-password-7f3a';
const PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----kafka-tls-key-91c2-----END PRIVATE KEY-----';
const KEY_PASSWORD = 'kafka-key-password-55d0';

const CREDENTIALS: GlobalConfig = {
  'security.protocol': 'sasl_ssl',
  'sasl.mechanism': 'SCRAM-SHA-512',
  'sasl.username': 'ordering',
  'sasl.password': PASSWORD,
  'ssl.key.pem': PRIVATE_KEY,
  'ssl.key.password': KEY_PASSWORD,
};

const SECRETS = [PASSWORD, PRIVATE_KEY, KEY_PASSWORD];

describe('KafkaEventBus: what it shows of its credentials', () => {
  it('shows none of them when it is serialised, spread, listed or inspected', async () => {
    const bus = new KafkaEventBus({ brokers: '127.0.0.1:1', client: CREDENTIALS, consumer: 'billing' });

    bus.subscribe('ordering.order.placed', async () => undefined);

    expectNoSecret(bus, SECRETS);
    expect(Object.keys(bus)).toEqual([]);
    expect(JSON.stringify({ bus })).toBe('{"bus":"KafkaEventBus [clients concealed]"}');
    expect(inspect(bus)).toBe('KafkaEventBus [clients concealed]');

    await bus.close();
  });

  it('shows none of them through its link to the cluster either', async () => {
    const settings = {
      createTopics: true,
      startFromEarliest: true,
      publishTimeoutMs: 1_000,
      connectTimeoutMs: 1_000,
      maxHandlingMs: 1_000,
    };

    const link = new BrokerLink(clusterOf({ brokers: '127.0.0.1:1', client: CREDENTIALS }), settings);

    expectNoSecret(link, SECRETS);
    expect(Object.keys(link)).toEqual([]);

    await link.close();
  });

  it('shows none of them through what a subscription hands back', async () => {
    const bus = new KafkaEventBus({ brokers: '127.0.0.1:1', client: CREDENTIALS });
    const subscriber = bus.forConsumer('billing');

    expectNoSecret(subscriber, SECRETS);

    expectNoSecret(
      subscriber.subscribe('ordering.order.placed', async () => undefined),
      SECRETS,
    );

    await bus.close();
  });

  it.skipIf(KAFKA_BROKERS === undefined)(
    'shows no client property once connected, when it holds live clients',
    { timeout: 60_000 },
    async () => {
      const clientId = unique('client-id-standing-for-a-secret');
      const type = unique('ordering.order.placed');

      const bus = new KafkaEventBus({
        brokers: KAFKA_BROKERS ?? '',
        client: { 'client.id': clientId },
        consumer: unique('billing'),
      });

      bus.subscribe(type, async () => undefined);
      await bus.assertTopology();
      await bus.publish([{ id: unique('evt'), type, version: 1, occurredAt: new Date(0).toISOString(), payload: {} }]);

      expectNoSecret(bus, [clientId]);
      expect(Object.keys(bus)).toEqual([]);

      await bus.close();
    },
  );
});
