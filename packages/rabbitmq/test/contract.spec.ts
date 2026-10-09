import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventBusContract } from '@ddd-ts-kit/testing/contracts';
import type { QueueType } from '../src/index.js';
import { AMQP_URL, Broker } from './support/broker.js';

const runner = { describe, it, beforeEach, afterEach, expect };

const contractOn = (url: string, queueType: QueueType): void => {
  eventBusContract(runner, {
    name: `RabbitMqEventBus on ${queueType} queues`,
    async createBus() {
      const broker = await Broker.connect(url);
      const bus = broker.bus({ queueType });
      return { bus, settle: () => broker.settled(bus), close: () => broker.dispose() };
    },
  });
};

describe.skipIf(AMQP_URL === undefined)('against a real broker', { timeout: 30_000 }, () => {
  contractOn(AMQP_URL ?? '', 'quorum');
  contractOn(AMQP_URL ?? '', 'classic');
});
