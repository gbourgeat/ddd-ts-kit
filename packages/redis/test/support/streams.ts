import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import {
  RedisStreamsEventBus,
  type RedisStreamsDelivery,
  type RedisStreamsEventBusOptions,
  type RedisStreamsFailure,
} from '../../src/event-bus.js';

export const RETRY_DELAY_MS = 60;
export const MAX_ATTEMPTS = 3;
export const BLOCK_MS = 25;

export const unique = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 8)}`;

export const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function eventually(condition: () => boolean | Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error('The condition was not met in time');
    }
    await pause(10);
  }
}

export const anEvent = (id: string, type = 'ordering.order.placed'): IntegrationEvent => ({
  id,
  type,
  version: 1,
  occurredAt: '2026-03-01T10:00:00.000Z',
  payload: { orderId: `order-${id}` },
});

export interface StoredEntry {
  readonly id: string;
  readonly fields: Record<string, string>;
}

interface GroupState {
  readonly pending: number;
  readonly lastDelivered: string;
  readonly consumers: number;
}

/**
 * A second, plain client next to the buses under test: it looks into the streams and the
 * groups, drops raw entries in, and deletes the keys of the test so that nothing outlives it.
 * Every bus it builds works under a prefix of its own.
 */
export class Server {
  readonly #buses: RedisStreamsEventBus[] = [];
  readonly #prefixes = new Set<string>();

  private constructor(
    private readonly url: string,
    readonly client: Redis,
  ) {}

  static connect(url: string): Server {
    return new Server(url, new Redis(url, { maxRetriesPerRequest: 1 }));
  }

  /** A bus under a prefix of its own, with fast retries and short reads. Closed and cleaned by `dispose`. */
  bus(options: Partial<RedisStreamsEventBusOptions> = {}): RedisStreamsEventBus {
    const prefix = options.prefix ?? unique('test-events');
    this.#prefixes.add(prefix);
    const bus = new RedisStreamsEventBus({
      connection: this.url,
      consumer: unique('consumer'),
      retry: { delayMs: RETRY_DELAY_MS, maxAttempts: MAX_ATTEMPTS },
      reconnect: { initialMs: 20, maxMs: 200 },
      blockMs: BLOCK_MS,
      ...options,
      prefix,
    });
    this.#buses.push(bus);
    return bus;
  }

  async entries(stream: string): Promise<StoredEntry[]> {
    const entries = await this.client.xrange(stream, '-', '+');
    return entries.map(([id, flat]) => ({ id, fields: fieldsOf(flat) }));
  }

  length(stream: string): Promise<number> {
    return this.client.xlen(stream);
  }

  async append(stream: string, fields: Record<string, string>): Promise<void> {
    await this.client.xadd(stream, '*', ...Object.entries(fields).flat());
  }

  /** Entries of the group delivered and not acknowledged: being handled, or waiting for a redelivery. */
  async pending(stream: string, group: string): Promise<number> {
    return (await this.#group(stream, group))?.pending ?? 0;
  }

  async consumers(stream: string, group: string): Promise<number> {
    return (await this.#group(stream, group))?.consumers ?? 0;
  }

  /**
   * Resolves once everything published to the streams the bus reads was delivered or given
   * up on: every group read up to the last entry, nothing pending, no handler running, three
   * checks in a row.
   */
  async settled(bus: RedisStreamsEventBus): Promise<void> {
    await bus.assertTopology();
    let quietChecks = 0;
    await eventually(async () => {
      quietChecks = (await this.#isQuiet(bus)) ? quietChecks + 1 : 0;
      return quietChecks >= 3;
    }, 20_000);
  }

  async dispose(): Promise<void> {
    await Promise.all(this.#buses.map((bus) => bus.close()));
    for (const prefix of this.#prefixes) {
      await this.#deleteKeysOf(prefix);
    }
    this.client.disconnect();
  }

  async #isQuiet(bus: RedisStreamsEventBus): Promise<boolean> {
    for (const { stream, name } of bus.describeTopology().groups) {
      const group = await this.#group(stream, name);
      const lastGenerated = fieldsOf(await this.client.xinfo('STREAM', stream))['last-generated-id'];
      if (group === undefined || group.pending > 0 || group.lastDelivered !== lastGenerated) {
        return false;
      }
    }
    return bus.deliveriesInFlight === 0;
  }

  async #group(stream: string, name: string): Promise<GroupState | undefined> {
    const groups = (await this.client.xinfo('GROUPS', stream).catch(() => [])) as unknown[][];
    const group = groups.map(fieldsOf).find((candidate) => candidate['name'] === name);
    return group === undefined
      ? undefined
      : { pending: Number(group['pending']), lastDelivered: String(group['last-delivered-id']), consumers: Number(group['consumers']) };
  }

  async #deleteKeysOf(prefix: string): Promise<void> {
    let cursor = '0';
    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', `${prefix}:*`, 'COUNT', 500);
      for (const key of keys) {
        await this.client.del(key);
      }
      cursor = next;
    } while (cursor !== '0');
  }
}

export const deliveriesOf = (settled: RedisStreamsDelivery[]) => (delivery: RedisStreamsDelivery) => void settled.push(delivery);

export const failuresOf = (reported: RedisStreamsFailure[]) => (failure: RedisStreamsFailure) => void reported.push(failure);

function fieldsOf(flat: unknown): Record<string, string> {
  const list = Array.isArray(flat) ? flat : [];
  const fields: Record<string, string> = {};
  for (let index = 0; index + 1 < list.length; index += 2) {
    fields[String(list[index])] = String(list[index + 1]);
  }
  return fields;
}
