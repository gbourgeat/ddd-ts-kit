import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventBusContract } from '@ddd-ts-kit/testing/contracts';
import type { StreamStorage } from '../src/index.js';
import { Broker, NATS_URL } from './support/broker.js';

const runner = { describe, it, beforeEach, afterEach, expect };

const contractOn = (url: string, storage: StreamStorage): void => {
  eventBusContract(runner, {
    name: `NatsEventBus on ${storage} storage`,
    async createBus() {
      const broker = await Broker.connect(url);
      const bus = broker.bus({ storage });
      return { bus, settle: () => broker.settled(bus), close: () => broker.dispose() };
    },
  });
};

describe.skipIf(NATS_URL === undefined)('against a real server', { timeout: 30_000 }, () => {
  contractOn(NATS_URL ?? '', 'file');
  contractOn(NATS_URL ?? '', 'memory');
});
