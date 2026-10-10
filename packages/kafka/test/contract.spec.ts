import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventBusContract } from '@ddd-ts-kit/testing/contracts';
import { Broker, KAFKA_BROKERS } from './support/broker.js';

const runner = { describe, it, beforeEach, afterEach, expect };

const contractOn = (brokers: string, partitions: number): void => {
  eventBusContract(runner, {
    name: `KafkaEventBus on topics of ${String(partitions)} partition(s)`,
    async createBus() {
      const broker = await Broker.connect(brokers);
      const bus = broker.bus({ topics: { partitions } });
      return { bus, settle: () => broker.settled(bus), close: () => broker.dispose() };
    },
  });
};

describe.skipIf(KAFKA_BROKERS === undefined)('against a real broker', { timeout: 60_000 }, () => {
  contractOn(KAFKA_BROKERS ?? '', 1);
  contractOn(KAFKA_BROKERS ?? '', 3);
});
