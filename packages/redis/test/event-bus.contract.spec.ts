import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventBusContract } from '@ddd-ts-kit/testing/contracts';
import type { RedisStreamsEventBusOptions } from '../src/event-bus';
import { SERVERS, serverOf } from './support/servers';
import { Server } from './support/streams';

const runner = { describe, it, beforeEach, afterEach, expect };

const contractWith = (
  redis: { readonly url: string },
  name: string,
  options: Partial<RedisStreamsEventBusOptions>,
): void => {
  eventBusContract(runner, {
    name: `RedisStreamsEventBus ${name}`,
    createBus() {
      const server = Server.connect(redis.url);
      const bus = server.bus(options);

      return { bus, settle: () => server.settled(bus), close: () => server.dispose() };
    },
  });
};

describe.each(SERVERS)('the event bus contract, %s', { timeout: 30_000 }, (_name, start) => {
  const redis = serverOf(start);

  contractWith(redis, 'with its defaults', {});

  contractWith(redis, 'with the publication guard and capped streams', {
    deduplication: { windowMs: 60_000 },
    retention: { maxLength: 10_000 },
  });
});
