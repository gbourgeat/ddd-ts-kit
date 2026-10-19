import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventBusContract } from '@ddd-ts-kit/testing/contracts';
import type { StreamStorage } from '../src/index.js';
import type { Broker } from './support/broker.js';
import { BROKERS } from './support/brokers.js';

const runner = { describe, it, beforeEach, afterEach, expect };

const contractOn = (name: string, connect: () => Promise<Broker>, storage: StreamStorage): void => {
  eventBusContract(runner, {
    name: `NatsEventBus ${name}, on ${storage} storage`,
    async createBus() {
      const broker = await connect();
      const bus = broker.bus({ storage });

      return { bus, settle: () => broker.settled(bus), close: () => broker.dispose() };
    },
  });
};

describe.each(BROKERS)('the event bus contract, %s', { timeout: 30_000 }, (name, connect) => {
  contractOn(name, connect, 'file');
  contractOn(name, connect, 'memory');
});
