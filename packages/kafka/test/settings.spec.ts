import { describe, expect, it } from 'vitest';
import type { KafkaDelivery } from '../src/options/kafka-delivery.js';
import type { KafkaFailure } from '../src/options/kafka-failure.js';
import { settingsOf } from '../src/options/settings-of.js';
import { anEvent, PLACED } from './support/events.js';

const failure: KafkaFailure = { kind: 'connection', code: 'ERR__TRANSPORT' };

const delivery: KafkaDelivery = {
  consumer: 'billing',
  topic: PLACED,
  partition: 0,
  attempt: 1,
  outcome: 'acknowledged',
};

describe('the settings of a bus', () => {
  it('give every option its default', () => {
    const settings = settingsOf({ brokers: '127.0.0.1:9092' });

    expect(settings.consumer).toBeUndefined();
    expect(settings.topicOf(PLACED)).toBe(PLACED);
    expect(settings.keyOf(anEvent('evt-1'))).toBe('evt-1');

    expect(settings).toMatchObject({
      publishedTypes: [],
      topics: { partitions: -1, replicationFactor: -1, create: true },
      startFromEarliest: true,
      concurrency: 1,
      publishTimeoutMs: 30_000,
      connectTimeoutMs: 10_000,
      maxHandlingMs: 300_000,
      retry: { maxAttempts: 5, delayMs: 5_000 },
      reconnect: { initialMs: 200, factor: 2, maxMs: 30_000 },
    });
  });

  it('keep what the options give', () => {
    const settings = settingsOf({
      brokers: ['127.0.0.1:9092'],
      consumer: 'billing',
      topicOf: (type) => `events.${type}`,
      keyOf: () => 'order-1',
      publishedTypes: ['billing.invoice.issued'],
      topics: { partitions: 6, replicationFactor: 3, create: false },
      startFrom: 'latest',
      concurrency: 4,
      publishTimeoutMs: 1_000,
      connectTimeoutMs: 2_000,
      maxHandlingMs: 3_000,
      retry: { maxAttempts: 2, delayMs: 10 },
      reconnect: { initialMs: 5, factor: 3, maxMs: 50 },
    });

    expect(settings.topicOf(PLACED)).toBe(`events.${PLACED}`);
    expect(settings.keyOf(anEvent('evt-1'))).toBe('order-1');

    expect(settings).toMatchObject({
      consumer: 'billing',
      publishedTypes: ['billing.invoice.issued'],
      topics: { partitions: 6, replicationFactor: 3, create: false },
      startFromEarliest: false,
      concurrency: 4,
      publishTimeoutMs: 1_000,
      connectTimeoutMs: 2_000,
      maxHandlingMs: 3_000,
      retry: { maxAttempts: 2, delayMs: 10 },
      reconnect: { initialMs: 5, factor: 3, maxMs: 50 },
    });
  });

  it('complete a partial retry, reconnection or topic option with the defaults', () => {
    const settings = settingsOf({
      brokers: '127.0.0.1:9092',
      topics: { partitions: 2 },
      retry: { maxAttempts: 9 },
      reconnect: { maxMs: 1_000 },
    });

    expect(settings.topics).toEqual({ partitions: 2, replicationFactor: -1, create: true });
    expect(settings.retry).toEqual({ maxAttempts: 9, delayMs: 5_000 });
    expect(settings.reconnect).toEqual({ initialMs: 200, factor: 2, maxMs: 1_000 });
  });

  it('hand the failures and the deliveries to the hooks', () => {
    const failures: KafkaFailure[] = [];
    const deliveries: KafkaDelivery[] = [];

    const settings = settingsOf({
      brokers: '127.0.0.1:9092',
      onFailure: (seen) => failures.push(seen),
      onDelivery: (seen) => deliveries.push(seen),
    });

    settings.onFailure(failure);
    settings.onDelivery(delivery);

    expect(failures).toEqual([failure]);
    expect(deliveries).toEqual([delivery]);
  });

  it('keep a hook that throws from throwing out of the bus', () => {
    const settings = settingsOf({
      brokers: '127.0.0.1:9092',
      onFailure: () => {
        throw new Error('the metrics backend is down');
      },
      onDelivery: () => {
        throw new Error('the metrics backend is down');
      },
    });

    expect(() => {
      settings.onFailure(failure);
    }).not.toThrow();

    expect(() => {
      settings.onDelivery(delivery);
    }).not.toThrow();
  });

  it('accept a bus without hooks', () => {
    const settings = settingsOf({ brokers: '127.0.0.1:9092' });

    expect(() => {
      settings.onFailure(failure);
      settings.onDelivery(delivery);
    }).not.toThrow();
  });
});
