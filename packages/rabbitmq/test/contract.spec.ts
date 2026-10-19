import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventBusContract } from '@ddd-ts-kit/testing/contracts';
import type { QueueType } from '../src/index.js';
import type { Broker } from './support/broker.js';
import { BROKERS } from './support/brokers.js';

const runner = { describe, it, beforeEach, afterEach, expect };

const contractOn = (name: string, connect: () => Promise<Broker>, queueType: QueueType): void => {
  eventBusContract(runner, {
    name: `RabbitMqEventBus ${name}, on ${queueType} queues`,
    async createBus() {
      const broker = await connect();
      const bus = broker.bus({ queueType });

      return { bus, settle: () => broker.settled(bus), close: () => broker.dispose() };
    },
  });
};

describe.each(BROKERS)('the event bus contract, %s', { timeout: 30_000 }, (name, connect) => {
  contractOn(name, connect, 'quorum');
  contractOn(name, connect, 'classic');
});
