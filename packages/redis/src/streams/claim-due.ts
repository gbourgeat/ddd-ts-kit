import type { Redis } from 'ioredis';
import { entriesOf } from './codec/entries-of.js';
import type { PendingEntry } from './codec/pending-entry.js';
import { pendingOf } from './codec/pending-of.js';
import type { Delivery } from './delivery.js';

export interface RedeliverySettings {
  /** The consumer name, which is the name of its group. */
  readonly consumer: string;

  readonly instance: string;

  readonly batchSize: number;

  readonly retryDelayMs: number;

  readonly visibilityTimeoutMs: number;
}

interface Claim {
  readonly stream: string;
  readonly pending: readonly PendingEntry[];
  readonly minIdleMs: number;
}

/**
 * Takes back what is due in the pending entry list of the group for one stream: the entries
 * this instance failed, once the retry delay has passed, and those another instance has left
 * idle for longer than the visibility timeout. `XCLAIM` counts a delivery; the attempt is the
 * counter of the pending entry list after it.
 */
export async function claimDue(reader: Redis, stream: string, settings: RedeliverySettings): Promise<Delivery[]> {
  const { consumer, instance, batchSize, retryDelayMs, visibilityTimeoutMs } = settings;

  const [failedHere, idle] = await Promise.all([
    reader.xpending(stream, consumer, 'IDLE', retryDelayMs, '-', '+', batchSize, instance),
    reader.xpending(stream, consumer, 'IDLE', visibilityTimeoutMs, '-', '+', batchSize),
  ]);

  const abandoned = pendingOf(idle).filter((entry) => entry.consumer !== instance);
  const claimant = new Claimant(reader, settings);

  return [
    ...(await claimant.claim({ stream, pending: pendingOf(failedHere), minIdleMs: retryDelayMs })),
    ...(await claimant.claim({ stream, pending: abandoned, minIdleMs: visibilityTimeoutMs })),
  ];
}

class Claimant {
  constructor(
    private readonly reader: Redis,
    private readonly settings: RedeliverySettings,
  ) {}

  /** An entry another instance claimed in the meantime is no longer idle, and is not answered. */
  async claim({ stream, pending, minIdleMs }: Claim): Promise<Delivery[]> {
    if (pending.length === 0) return [];

    const { consumer, instance } = this.settings;
    const ids = pending.map((entry) => entry.id);
    const claimed = entriesOf(await this.reader.call('XCLAIM', stream, consumer, instance, minIdleMs, ...ids));
    const deliveries = new Map(pending.map((entry) => [entry.id, entry.deliveries]));

    return claimed.map((entry) => ({ stream, entry, attempt: (deliveries.get(entry.id) ?? 0) + 1 }));
  }
}
