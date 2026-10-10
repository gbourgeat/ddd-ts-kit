import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventBusContract } from '@ddd-ts-kit/testing/contracts';
import type { RedisStreamsEventBusOptions } from '../src/event-bus.js';
import { REAL_SERVER, SERVER_URL } from './support/server.js';
import { Server } from './support/streams.js';

const runner = { describe, it, beforeEach, afterEach, expect };

const contractWith = (name: string, options: Partial<RedisStreamsEventBusOptions>): void => {
  eventBusContract(runner, {
    name: `RedisStreamsEventBus ${name}`,
    createBus() {
      const server = Server.connect(SERVER_URL);
      const bus = server.bus(options);

      return { bus, settle: () => server.settled(bus), close: () => server.dispose() };
    },
  });
};

describe.skipIf(!REAL_SERVER)('against a real server', { timeout: 30_000 }, () => {
  contractWith('with its defaults', {});

  contractWith('with the publication guard and capped streams', {
    deduplication: { windowMs: 60_000 },
    retention: { maxLength: 10_000 },
  });
});
