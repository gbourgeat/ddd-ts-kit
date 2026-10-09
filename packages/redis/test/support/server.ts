import { randomBytes } from 'node:crypto';
import { Redis } from 'ioredis';

/** The server the specs run against: Redis, Dragonfly or Valkey. Without it they are skipped. */
export const SERVER_URL = process.env['DDD_TS_KIT_TEST_REDIS_URL'] ?? '';
export const REAL_SERVER = SERVER_URL !== '';

const opened: Redis[] = [];

export function connect(): Redis {
  const client = new Redis(SERVER_URL, { maxRetriesPerRequest: 1 });
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
  for (const client of opened.splice(0)) client.disconnect();
}

/** A namespace of its own per test: specs never flush a server, and never see each other's keys. */
export function aNamespace(): string {
  return `ddd-ts-kit-test:${randomBytes(6).toString('hex')}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
