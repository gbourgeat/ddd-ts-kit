import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { InMemoryRelaySignal } from '../relay/in-memory-relay-signal';
import { DuplicateOutboxEventError } from './duplicate-outbox-event-error';
import type { OutboxRecord } from './outbox-record';
import type { OutboxStats } from './outbox-stats';
import type { OutboxStatus } from './outbox-status';
import type { OutboxStore } from './outbox-store';

export interface InMemoryOutboxStoreOptions {
  /** How long a claimed record stays invisible to other claims. Default 30000. */
  readonly leaseMs?: number;
  /** Notified after each append, to wake a relay built with `wakeOn`. */
  readonly signal?: InMemoryRelaySignal;
}

interface StoredRecord {
  event: IntegrationEvent;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: Date;
  lastErrorCode: string | undefined;
  publishedAt: Date | undefined;
  readonly sequence: number;
}

// A fresh record is due at once, whatever clock the relay runs on.
const DUE_IMMEDIATELY = 0;

/** Reference implementation, for tests and single-process apps. Not transactional. */
export class InMemoryOutboxStore implements OutboxStore {
  private readonly storedRecords = new Map<string, StoredRecord>();

  private readonly leaseMs: number;

  private readonly signal: InMemoryRelaySignal | undefined;

  private sequence = 0;

  constructor(options: InMemoryOutboxStoreOptions = {}) {
    this.leaseMs = options.leaseMs ?? 30_000;
    this.signal = options.signal;
  }

  async append(events: readonly IntegrationEvent[]): Promise<void> {
    this.assertNotStored(events);

    for (const event of events) {
      this.sequence += 1;

      this.storedRecords.set(event.id, {
        event: structuredClone(event),
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(DUE_IMMEDIATELY),
        lastErrorCode: undefined,
        publishedAt: undefined,
        sequence: this.sequence,
      });
    }

    if (events.length > 0) {
      this.signal?.notify();
    }
  }

  async claimBatch(limit: number, now: Date): Promise<OutboxRecord[]> {
    const due = [...this.storedRecords.values()]
      .filter((record) => record.status === 'pending' && record.nextAttemptAt <= now)
      .sort((a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime() || a.sequence - b.sequence)
      .slice(0, Math.max(0, limit));

    for (const record of due) {
      record.attempts += 1;
      record.nextAttemptAt = new Date(now.getTime() + this.leaseMs);
    }

    return due.map(snapshot);
  }

  async markPublished(ids: readonly string[], at: Date): Promise<void> {
    for (const id of ids) {
      const record = this.storedRecords.get(id);

      if (record !== undefined) {
        record.status = 'published';
        record.publishedAt = at;
      }
    }
  }

  async markFailed(id: string, error: { readonly code: string }, nextAttemptAt: Date | null): Promise<void> {
    const record = this.storedRecords.get(id);

    if (record === undefined || record.status === 'published') {
      return;
    }

    record.lastErrorCode = error.code;

    if (nextAttemptAt === null) {
      record.status = 'dead';
    } else {
      record.nextAttemptAt = nextAttemptAt;
    }
  }

  async retryDead(ids: readonly string[], now: Date): Promise<number> {
    let revived = 0;

    for (const id of ids) {
      const record = this.storedRecords.get(id);

      if (record?.status === 'dead') {
        record.status = 'pending';
        record.attempts = 0;
        record.nextAttemptAt = now;
        revived += 1;
      }
    }

    return revived;
  }

  async purgePublished(before: Date): Promise<number> {
    let purged = 0;

    for (const [id, record] of this.storedRecords) {
      if (record.publishedAt !== undefined && record.publishedAt < before) {
        this.storedRecords.delete(id);
        purged += 1;
      }
    }

    return purged;
  }

  async stats(): Promise<OutboxStats> {
    const records = [...this.storedRecords.values()];
    const pending = records.filter((record) => record.status === 'pending');

    return {
      pending: pending.length,
      failed: pending.filter((record) => record.lastErrorCode !== undefined).length,
      dead: records.filter((record) => record.status === 'dead').length,
    };
  }

  /** Every record in insertion order, for assertions. */
  records(): OutboxRecord[] {
    return [...this.storedRecords.values()].map(snapshot);
  }

  private assertNotStored(events: readonly IntegrationEvent[]): void {
    const ids = new Set<string>();

    for (const { id } of events) {
      if (this.storedRecords.has(id) || ids.has(id)) {
        throw new DuplicateOutboxEventError(id);
      }

      ids.add(id);
    }
  }
}

function snapshot(record: StoredRecord): OutboxRecord {
  return {
    event: structuredClone(record.event),
    status: record.status,
    attempts: record.attempts,
    nextAttemptAt: record.nextAttemptAt,
    ...(record.lastErrorCode === undefined ? {} : { lastErrorCode: record.lastErrorCode }),
    ...(record.publishedAt === undefined ? {} : { publishedAt: record.publishedAt }),
  };
}
