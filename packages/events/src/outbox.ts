import type { Clock, IntegrationEvent, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';

export type OutboxStatus = 'pending' | 'published' | 'dead';

export interface OutboxRecord {
  readonly event: IntegrationEvent;
  readonly status: OutboxStatus;
  /** Number of delivery attempts started, the one in progress included. */
  readonly attempts: number;
  /** A pending record is not claimed before this instant. */
  readonly nextAttemptAt: Date;
  /** Identifier-shaped code of the last failure. Never an error message. */
  readonly lastErrorCode?: string;
  readonly publishedAt?: Date;
}

export interface OutboxStats {
  /** Records still to publish, those waiting for a retry included. */
  readonly pending: number;
  /** The pending records whose last attempt failed. */
  readonly failed: number;
  /** Records that exhausted their attempts and wait for `retryDead`. */
  readonly dead: number;
}

/**
 * Where events wait between the commit of the command and their publication.
 *
 * A claim is a lease, not a lock held by the caller: `claimBatch` hands out due records and
 * pushes their `nextAttemptAt` forward by the lease of the store, so a relay that dies
 * mid-flight simply lets the lease expire and the records are claimed again. This keeps the
 * port implementable by SQL (`FOR UPDATE SKIP LOCKED` inside the claim), by a document store
 * with a conditional update, or by a queue with a visibility timeout.
 */
export interface OutboxStore {
  /** Must join the transaction of the command when the store is transactional. */
  append(events: readonly IntegrationEvent[]): Promise<void>;
  /**
   * Claims up to `limit` pending records due at `now`, oldest first, and counts the attempt.
   * Two concurrent calls never return the same record.
   */
  claimBatch(limit: number, now: Date): Promise<OutboxRecord[]>;
  markPublished(ids: readonly string[], at: Date): Promise<void>;
  /** Schedules the retry at `nextAttemptAt`, or declares the record dead when it is `null`. */
  markFailed(id: string, error: { readonly code: string }, nextAttemptAt: Date | null): Promise<void>;
  /** Puts dead records back in the queue with a fresh attempt budget. Returns how many. */
  retryDead(ids: readonly string[], now: Date): Promise<number>;
  /** Housekeeping: drops the records published before `before`. Returns how many. */
  purgePublished(before: Date): Promise<number>;
  stats(): Promise<OutboxStats>;
}

/**
 * The publisher handlers use when a database is involved: it only stores. Called inside the
 * unit of work of the command, the events commit or roll back with the business write.
 */
export class OutboxPublisher implements IntegrationEventPublisher {
  constructor(private readonly store: OutboxStore) {}

  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    if (events.length > 0) {
      await this.store.append(events);
    }
  }
}

export interface OutboxBackoff {
  /** Delay before the second attempt. Default 1000. */
  readonly baseMs?: number;
  /** Multiplier applied at each further attempt. Default 2. */
  readonly factor?: number;
  /** Upper bound of the delay. Default 300000 (five minutes). */
  readonly maxMs?: number;
}

export type OutboxRelayFailure =
  | {
      readonly kind: 'publish';
      readonly eventId: string;
      readonly eventType: string;
      readonly code: string;
      readonly attempts: number;
      readonly dead: boolean;
    }
  | { readonly kind: 'tick'; readonly code: string };

export interface OutboxRelayOptions {
  readonly store: OutboxStore;
  /** The real provider: a broker adapter, or the in-memory bus in a single process. */
  readonly publisher: IntegrationEventPublisher;
  readonly clock: Clock;
  /** Default 100. */
  readonly batchSize?: number;
  /** Attempts after which a record is dead. Default 8. */
  readonly maxAttempts?: number;
  readonly backoff?: OutboxBackoff;
  /** Observability hook. It receives codes only, so it is safe to log as is. */
  readonly onFailure?: (failure: OutboxRelayFailure) => void;
}

export interface OutboxTickResult {
  readonly published: number;
  readonly failed: number;
}

/**
 * Moves stored events to the provider, at least once.
 *
 * Ordering is NOT guaranteed, not even per aggregate: a failed event is retried later while
 * its successors go out, and several relays may run side by side. Consumers must not rely on
 * the order of arrival; carry a sequence or a version in the payload when order matters.
 */
export class OutboxRelay {
  readonly #store: OutboxStore;
  readonly #publisher: IntegrationEventPublisher;
  readonly #clock: Clock;
  readonly #batchSize: number;
  readonly #maxAttempts: number;
  readonly #backoff: Required<OutboxBackoff>;
  readonly #onFailure: (failure: OutboxRelayFailure) => void;

  #timer: ReturnType<typeof setTimeout> | undefined;
  #running: Promise<unknown> | undefined;
  #started = false;

  constructor(options: OutboxRelayOptions) {
    this.#store = options.store;
    this.#publisher = options.publisher;
    this.#clock = options.clock;
    this.#batchSize = options.batchSize ?? 100;
    this.#maxAttempts = options.maxAttempts ?? 8;
    this.#backoff = {
      baseMs: options.backoff?.baseMs ?? 1_000,
      factor: options.backoff?.factor ?? 2,
      maxMs: options.backoff?.maxMs ?? 300_000,
    };
    this.#onFailure = options.onFailure ?? (() => undefined);
  }

  async tick(): Promise<OutboxTickResult> {
    const records = await this.#store.claimBatch(this.#batchSize, this.#clock.now());
    const published: string[] = [];
    let failed = 0;
    try {
      for (const record of records) {
        try {
          // One by one: a batch publication would make one poisoned event fail its neighbours.
          await this.#publisher.publish([record.event]);
          published.push(record.event.id);
        } catch (error) {
          failed += 1;
          await this.#recordFailure(record, errorCode(error));
        }
      }
    } finally {
      // Also when the store fails mid-batch: what did go out must not go out twice for that.
      if (published.length > 0) {
        await this.#store.markPublished(published, this.#clock.now());
      }
    }
    return { published: published.length, failed };
  }

  /** Runs a tick, waits `intervalMs`, runs the next: ticks never overlap. */
  start(options: { readonly intervalMs: number }): void {
    if (this.#started) {
      return;
    }
    this.#started = true;
    const loop = (): void => {
      this.#running = this.tick()
        .catch((error: unknown) => this.#onFailure({ kind: 'tick', code: errorCode(error) }))
        .finally(() => {
          this.#running = undefined;
          if (this.#started) {
            this.#timer = setTimeout(loop, options.intervalMs);
          }
        });
    };
    loop();
  }

  /** Stops scheduling and resolves once the tick in progress, if any, has finished. */
  async stop(): Promise<void> {
    this.#started = false;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    await this.#running;
  }

  async #recordFailure(record: OutboxRecord, code: string): Promise<void> {
    const dead = record.attempts >= this.#maxAttempts;
    const nextAttemptAt = dead
      ? null
      : new Date(this.#clock.now().getTime() + this.#delayAfter(record.attempts));
    await this.#store.markFailed(record.event.id, { code }, nextAttemptAt);
    this.#onFailure({
      kind: 'publish',
      eventId: record.event.id,
      eventType: record.event.type,
      code,
      attempts: record.attempts,
      dead,
    });
  }

  #delayAfter(attempts: number): number {
    const { baseMs, factor, maxMs } = this.#backoff;
    return Math.min(maxMs, baseMs * factor ** Math.max(0, attempts - 1));
  }
}

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;

/**
 * What may be stored and logged about a caught error: its `code` when it carries one, else
 * its class name. Never its message, which may quote payload data.
 */
export function errorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'UNKNOWN_ERROR';
  }
  if ('code' in error && typeof error.code === 'string' && IDENTIFIER.test(error.code)) {
    return error.code;
  }
  const name = error instanceof Error ? error.constructor.name : '';
  return IDENTIFIER.test(name) ? name : 'UNKNOWN_ERROR';
}

export class DuplicateOutboxEventError extends Error {
  readonly code = 'DUPLICATE_OUTBOX_EVENT';

  constructor(eventId: string) {
    super(`Event ${eventId} is already in the outbox`);
    this.name = 'DuplicateOutboxEventError';
  }
}

export interface InMemoryOutboxStoreOptions {
  /** How long a claimed record stays invisible to other claims. Default 30000. */
  readonly leaseMs?: number;
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
  readonly #records = new Map<string, StoredRecord>();
  readonly #leaseMs: number;
  #sequence = 0;

  constructor(options: InMemoryOutboxStoreOptions = {}) {
    this.#leaseMs = options.leaseMs ?? 30_000;
  }

  async append(events: readonly IntegrationEvent[]): Promise<void> {
    const ids = new Set<string>();
    for (const { id } of events) {
      if (this.#records.has(id) || ids.has(id)) {
        throw new DuplicateOutboxEventError(id);
      }
      ids.add(id);
    }
    for (const event of events) {
      this.#sequence += 1;
      this.#records.set(event.id, {
        event: structuredClone(event),
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(DUE_IMMEDIATELY),
        lastErrorCode: undefined,
        publishedAt: undefined,
        sequence: this.#sequence,
      });
    }
  }

  async claimBatch(limit: number, now: Date): Promise<OutboxRecord[]> {
    const due = [...this.#records.values()]
      .filter((record) => record.status === 'pending' && record.nextAttemptAt <= now)
      .sort(
        (a, b) =>
          a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime() || a.sequence - b.sequence,
      )
      .slice(0, Math.max(0, limit));
    for (const record of due) {
      record.attempts += 1;
      record.nextAttemptAt = new Date(now.getTime() + this.#leaseMs);
    }
    return due.map(snapshot);
  }

  async markPublished(ids: readonly string[], at: Date): Promise<void> {
    for (const id of ids) {
      const record = this.#records.get(id);
      if (record !== undefined) {
        record.status = 'published';
        record.publishedAt = at;
      }
    }
  }

  async markFailed(
    id: string,
    error: { readonly code: string },
    nextAttemptAt: Date | null,
  ): Promise<void> {
    const record = this.#records.get(id);
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
      const record = this.#records.get(id);
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
    for (const [id, record] of this.#records) {
      if (record.publishedAt !== undefined && record.publishedAt < before) {
        this.#records.delete(id);
        purged += 1;
      }
    }
    return purged;
  }

  async stats(): Promise<OutboxStats> {
    const records = [...this.#records.values()];
    const pending = records.filter((record) => record.status === 'pending');
    return {
      pending: pending.length,
      failed: pending.filter((record) => record.lastErrorCode !== undefined).length,
      dead: records.filter((record) => record.status === 'dead').length,
    };
  }

  /** Every record in insertion order, for assertions. */
  records(): OutboxRecord[] {
    return [...this.#records.values()].map(snapshot);
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
