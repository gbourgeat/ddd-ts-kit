import { describe, expect, it } from 'vitest';
import { BrokerLink } from '../src/connection/broker-link';
import { InMemoryKafka } from './support/cluster/in-memory-kafka';

const settings = {
  createTopics: true,
  startFromEarliest: false,
  publishTimeoutMs: 1_000,
  connectTimeoutMs: 1_000,
  maxHandlingMs: 60_000,
};

describe('BrokerLink', () => {
  it('connects no client once closed, whoever asks for one', async () => {
    const link = new BrokerLink(new InMemoryKafka(), settings);

    await link.close();

    await expect(link.connected(link.producer())).rejects.toMatchObject({ code: 'EVENT_BUS_CLOSED' });
    await expect(link.admin()).rejects.toMatchObject({ code: 'EVENT_BUS_CLOSED' });
  });
});
