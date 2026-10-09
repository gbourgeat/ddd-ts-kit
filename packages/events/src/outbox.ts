import type { Clock, IntegrationEvent, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import {
  KeyOrder,
  type ClaimWindow,
  type EventKey,
  type HoldUntil,
  type RecordGroup,
} from './relay-ordering.js';
import type { InMemoryRelaySignal, RelaySignal } from './relay-signal.js';

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

/**
 * `none`: records go out in store order and a failed one is overtaken by its successors.
 * `per-key`: a record is never published while an earlier record with the same key is still
 * pending or failed, at the price of head-of-line blocking on that key.
 */
export type OutboxOrdering = 'none' | 'per-key';

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
  /**
   * Makes a started relay tick as soon as the store says something was appended, so
   * `intervalMs` can be long. Bursts are coalesced: one tick runs, at most one is queued.
   * The interval stays the safety net: a missed notification delays, it never loses.
   */
  readonly wakeOn?: RelaySignal;
  /** Default `none`. `per-key` needs `keyOf` and a single running relay. */
  readonly ordering?: OutboxOrdering;
  /** The ordering key of an event, typically its aggregate id. No key: no ordering. */
  readonly keyOf?: (event: IntegrationEvent) => string | undefined;
}

export interface OutboxTickResult {
  readonly published: number;
  readonly failed: number;
}

/** Code stored on a record that waits for an earlier record of its key. It is not a failure. */
export const HELD_FOR_ORDER = 'OUTBOX_HELD_FOR_ORDER';

interface Tick extends ClaimWindow {
  readonly groups: readonly RecordGroup<OutboxRecord>[];
  readonly published: string[];
  readonly settled: Set<string>;
  failed: number;
}

/**
 * Moves stored events to the provider, at least once.
 *
 * By default ordering is NOT guaranteed, not even per aggregate: a failed event is retried
 * later while its successors go out, and several relays may run side by side. Consumers must
 * not rely on the order of arrival; carry a sequence or a version in the payload when order
 * matters.
 *
 * With `ordering: 'per-key'` the records of one key go out in the order this relay first saw
 * them, and a failed one holds its successors back until it is published or dead. The memory
 * of it lives in the relay: run a single relay, and expect a record in backoff to be
 * overtaken once if the process restarts meanwhile. A dead record no longer blocks its key.
 */
export class OutboxRelay {
  readonly #store: OutboxStore;
  readonly #publisher: IntegrationEventPublisher;
  readonly #clock: Clock;
  readonly #batchSize: number;
  readonly #maxAttempts: number;
  readonly #backoff: Required<OutboxBackoff>;
  readonly #onFailure: (failure: OutboxRelayFailure) => void;
  readonly #wakeOn: RelaySignal | undefined;
  readonly #order: KeyOrder<OutboxRecord>;

  #timer: ReturnType<typeof setTimeout> | undefined;
  #running: Promise<unknown> | undefined;
  #wakeSubscription: { unsubscribe(): void } | undefined;
  #wakeQueued = false;
  #intervalMs = 0;
  #started = false;

  constructor(options: OutboxRelayOptions) {
    this.#store = options.store;
    this.#publisher = options.publisher;
    this.#clock = options.clock;
    this.#batchSize = options.batchSize ?? 100;
    this.#maxAttempts = options.maxAttempts ?? 8;
    this.#backoff = backoffOf(options.backoff);
    this.#onFailure = options.onFailure ?? (() => undefined);
    this.#wakeOn = options.wakeOn;
    this.#order = new KeyOrder(orderingKeyOf(options));
  }

  async tick(): Promise<OutboxTickResult> {
    const tick = await this.#claim();
    try {
      for (const group of tick.groups) {
        await this.#relayGroup(group, tick);
      }
    } catch (error) {
      this.#order.suspend(tick.groups, tick.settled);
      throw error;
    } finally {
      // Also when the store fails mid-batch: what did go out must not go out twice for that.
      if (tick.published.length > 0) {
        await this.#store.markPublished(tick.published, this.#clock.now());
      }
    }
    return { published: tick.published.length, failed: tick.failed };
  }

  /** Runs a tick, waits `intervalMs` or a wake-up, runs the next: ticks never overlap. */
  start(options: { readonly intervalMs: number }): void {
    if (this.#started) {
      return;
    }
    this.#started = true;
    this.#intervalMs = options.intervalMs;
    this.#wakeSubscription = this.#wakeOn?.subscribe(() => {
      this.#wake();
    });
    this.#loop();
  }

  /** Stops scheduling and resolves once the tick in progress, if any, has finished. */
  async stop(): Promise<void> {
    this.#started = false;
    this.#wakeQueued = false;
    this.#wakeSubscription?.unsubscribe();
    this.#wakeSubscription = undefined;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    await this.#running;
  }

  async #claim(): Promise<Tick> {
    const now = this.#clock.now();
    const records = await this.#store.claimBatch(this.#batchSize, now);
    return {
      now,
      complete: records.length < this.#batchSize,
      groups: this.#order.groups(records),
      published: [],
      settled: new Set(),
      failed: 0,
    };
  }

  async #relayGroup(group: RecordGroup<OutboxRecord>, tick: Tick): Promise<void> {
    let hold = this.#order.holdOf(group, tick);
    for (const record of group.records) {
      hold =
        hold === undefined
          ? await this.#relayRecord(record, group.key, tick)
          : await this.#holdBack(record, hold);
      tick.settled.add(record.event.id);
    }
  }

  /** Publishes one record; when it fails and has a key, says until when its successors wait. */
  async #relayRecord(
    record: OutboxRecord,
    key: string | undefined,
    tick: Tick,
  ): Promise<HoldUntil | undefined> {
    try {
      // One by one: a batch publication would make one poisoned event fail its neighbours.
      await this.#publisher.publish([record.event]);
    } catch (error) {
      tick.failed += 1;
      const retryAt = await this.#recordFailure(record, key, errorCode(error));
      return key === undefined ? undefined : retryAt;
    }
    tick.published.push(record.event.id);
    this.#order.settle(key, record.event.id);
    return undefined;
  }

  async #recordFailure(
    record: OutboxRecord,
    key: string | undefined,
    code: string,
  ): Promise<Date | undefined> {
    const attempts = this.#order.attemptsOf(record);
    const dead = attempts >= this.#maxAttempts;
    const nextAttemptAt = dead
      ? null
      : new Date(this.#clock.now().getTime() + this.#delayAfter(attempts));
    if (nextAttemptAt === null) {
      this.#order.settle(key, record.event.id);
    } else {
      this.#order.block(key, record.event.id, nextAttemptAt);
    }
    await this.#store.markFailed(record.event.id, { code }, nextAttemptAt);
    const { id: eventId, type: eventType } = record.event;
    this.#onFailure({ kind: 'publish', eventId, eventType, code, attempts, dead });
    return nextAttemptAt ?? undefined;
  }

  #delayAfter(attempts: number): number {
    const { baseMs, factor, maxMs } = this.#backoff;
    return Math.min(maxMs, baseMs * factor ** Math.max(0, attempts - 1));
  }

  /** Reschedules a record with the head of its key; the claim it cost is not an attempt. */
  async #holdBack(record: OutboxRecord, hold: HoldUntil): Promise<HoldUntil> {
    this.#order.countHold(record.event.id);
    if (hold !== 'lease-expiry') {
      await this.#store.markFailed(record.event.id, { code: HELD_FOR_ORDER }, hold);
    }
    return hold;
  }

  #wake(): void {
    if (!this.#started) {
      return;
    }
    if (this.#running !== undefined) {
      this.#wakeQueued = true;
      return;
    }
    clearTimeout(this.#timer);
    this.#loop();
  }

  #loop(): void {
    this.#running = this.tick()
      .catch((error: unknown) => {
        this.#onFailure({ kind: 'tick', code: errorCode(error) });
      })
      .finally(() => {
        this.#running = undefined;
        this.#scheduleNext();
      });
  }

  #scheduleNext(): void {
    if (!this.#started) {
      return;
    }
    if (this.#wakeQueued) {
      this.#wakeQueued = false;
      this.#loop();
      return;
    }
    this.#timer = setTimeout(() => {
      this.#loop();
    }, this.#intervalMs);
  }
}

function backoffOf(backoff: OutboxBackoff = {}): Required<OutboxBackoff> {
  return {
    baseMs: backoff.baseMs ?? 1_000,
    factor: backoff.factor ?? 2,
    maxMs: backoff.maxMs ?? 300_000,
  };
}

function orderingKeyOf(options: OutboxRelayOptions): EventKey {
  const withoutKey: EventKey = () => undefined;
  return options.ordering === 'per-key' ? (options.keyOf ?? withoutKey) : withoutKey;
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
  readonly #records = new Map<string, StoredRecord>();
  readonly #leaseMs: number;
  readonly #signal: InMemoryRelaySignal | undefined;
  #sequence = 0;

  constructor(options: InMemoryOutboxStoreOptions = {}) {
    this.#leaseMs = options.leaseMs ?? 30_000;
    this.#signal = options.signal;
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
    if (events.length > 0) {
      this.#signal?.notify();
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
