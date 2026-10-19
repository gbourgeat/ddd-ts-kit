import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventBusContract } from '@ddd-ts-kit/testing/contracts';
import type { Broker } from './support/broker.js';
import { BROKERS } from './support/brokers.js';

const runner = { describe, it, beforeEach, afterEach, expect };

const contractOn = (name: string, connect: () => Promise<Broker>, partitions: number): void => {
  eventBusContract(runner, {
    name: `KafkaEventBus ${name}, on topics of ${String(partitions)} partition(s)`,
    async createBus() {
      const broker = await connect();
      const bus = broker.bus({ topics: { partitions } });

      return { bus, settle: () => broker.settled(bus), close: () => broker.dispose() };
    },
  });
};

describe.each(BROKERS)('the event bus contract, %s', { timeout: 60_000 }, (name, connect) => {
  contractOn(name, connect, 1);
  contractOn(name, connect, 3);
});
