import { randomBytes } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, beforeAll } from 'vitest';
import { InMemoryRedis } from './server/in-memory-redis';

/** A server the specs run on, started before the specs of a block and stopped after them. */
interface RunningServer {
  readonly url: string;
  stop(): Promise<void>;
}

type ServerRow = readonly [name: string, start: () => Promise<RunningServer>];

const url = process.env['DDD_TS_KIT_TEST_REDIS_URL'] ?? '';

/** The real server named by `DDD_TS_KIT_TEST_REDIS_URL`: Redis, Dragonfly or Valkey. Dragonfly in the pipeline. */
const real: readonly ServerRow[] =
  url === '' ? [] : [['on a server', () => Promise.resolve({ url, stop: () => Promise.resolve() })]];

/**
 * The servers the specs run on: the in-memory one always, a real one when
 * `DDD_TS_KIT_TEST_REDIS_URL` names it. As `[name, start]` rows for `describe.each`.
 */
export const SERVERS: readonly ServerRow[] = [['in memory', () => InMemoryRedis.start()], ...real];

/** Starts the server of a row for the block it is called in, and stops it after; its URL once started. */
export function serverOf(start: () => Promise<RunningServer>): { readonly url: string } {
  let running: RunningServer | undefined;

  beforeAll(async () => {
    running = await start();
  });

  afterAll(async () => {
    await closeAll();
    await running?.stop();
  });

  return {
    get url() {
      if (running === undefined) {
        throw new Error('The server of the spec is not started: read its URL in a hook or a test.');
      }

      return running.url;
    },
  };
}

const opened: Redis[] = [];

export function connect(serverUrl: string): Redis {
  const client = new Redis(serverUrl, { maxRetriesPerRequest: 1 });

  opened.push(client);

  return client;
}

/** A client whose server is away: nothing listens on port 1, and it does not try again. */
export function connectToNothing(): Redis {
  const client = new Redis({ host: '127.0.0.1', port: 1, retryStrategy: () => null, maxRetriesPerRequest: 0 });

  client.on('error', () => undefined);
  opened.push(client);

  return client;
}

export async function closeAll(): Promise<void> {
  for (const client of opened.splice(0)) {
    client.disconnect();
  }
}

/** A namespace of its own per test: specs never flush a server, and never see each other's keys. */
export function aNamespace(): string {
  return `ddd-ts-kit-test:${randomBytes(6).toString('hex')}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
