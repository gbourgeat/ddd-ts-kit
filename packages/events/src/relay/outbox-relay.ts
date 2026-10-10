import type { Clock, IntegrationEvent, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import type { OutboxRecord } from '../outbox/outbox-record.js';
import type { OutboxStore } from '../outbox/outbox-store.js';
import type { ClaimWindow } from './claim-window.js';
import { errorCode } from './error-code.js';
import type { EventKey } from './event-key.js';
import type { HoldUntil } from './hold-until.js';
import { KeyOrder } from './key-order.js';
import type { OutboxBackoff } from './outbox-backoff.js';
import type { OutboxOrdering } from './outbox-ordering.js';
import type { OutboxRelayFailure } from './outbox-relay-failure.js';
import type { RecordGroup } from './record-group.js';
import type { RelaySignal } from './relay-signal.js';

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
  private readonly store: OutboxStore;

  private readonly publisher: IntegrationEventPublisher;

  private readonly clock: Clock;

  private readonly batchSize: number;

  private readonly maxAttempts: number;

  private readonly backoff: Required<OutboxBackoff>;

  private readonly onFailure: (failure: OutboxRelayFailure) => void;

  private readonly wakeOn: RelaySignal | undefined;

  private readonly order: KeyOrder<OutboxRecord>;

  private timer: ReturnType<typeof setTimeout> | undefined;

  private running: Promise<unknown> | undefined;

  private wakeSubscription: { unsubscribe(): void } | undefined;

  private wakeQueued = false;

  private intervalMs = 0;

  private started = false;

  constructor(options: OutboxRelayOptions) {
    this.store = options.store;
    this.publisher = options.publisher;
    this.clock = options.clock;
    this.batchSize = options.batchSize ?? 100;
    this.maxAttempts = options.maxAttempts ?? 8;
    this.backoff = backoffOf(options.backoff);
    this.onFailure = options.onFailure ?? (() => undefined);
    this.wakeOn = options.wakeOn;
    this.order = new KeyOrder(orderingKeyOf(options));
  }

  async tick(): Promise<OutboxTickResult> {
    const tick = await this.claim();

    try {
      for (const group of tick.groups) {
        await this.relayGroup(group, tick);
      }
    } catch (error) {
      this.order.suspend(tick.groups, tick.settled);

      throw error;
    } finally {
      // Also when the store fails mid-batch: what did go out must not go out twice for that.
      if (tick.published.length > 0) {
        await this.store.markPublished(tick.published, this.clock.now());
      }
    }

    return { published: tick.published.length, failed: tick.failed };
  }

  /** Runs a tick, waits `intervalMs` or a wake-up, runs the next: ticks never overlap. */
  start(options: { readonly intervalMs: number }): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.intervalMs = options.intervalMs;

    this.wakeSubscription = this.wakeOn?.subscribe(() => {
      this.wake();
    });

    this.loop();
  }

  /** Stops scheduling and resolves once the tick in progress, if any, has finished. */
  async stop(): Promise<void> {
    this.started = false;
    this.wakeQueued = false;
    this.wakeSubscription?.unsubscribe();
    this.wakeSubscription = undefined;
    clearTimeout(this.timer);
    this.timer = undefined;
    await this.running;
  }

  private async claim(): Promise<Tick> {
    const now = this.clock.now();
    const records = await this.store.claimBatch(this.batchSize, now);

    return {
      now,
      complete: records.length < this.batchSize,
      groups: this.order.groups(records),
      published: [],
      settled: new Set(),
      failed: 0,
    };
  }

  private async relayGroup(group: RecordGroup<OutboxRecord>, tick: Tick): Promise<void> {
    let hold = this.order.holdOf(group, tick);

    for (const record of group.records) {
      hold =
        hold === undefined
          ? await this.relayRecord(record, group.key, tick)
          : await this.holdBack(record, hold);

      tick.settled.add(record.event.id);
    }
  }

  /** Publishes one record; when it fails and has a key, says until when its successors wait. */
  private async relayRecord(
    record: OutboxRecord,
    key: string | undefined,
    tick: Tick,
  ): Promise<HoldUntil | undefined> {
    try {
      // One by one: a batch publication would make one poisoned event fail its neighbours.
      await this.publisher.publish([record.event]);
    } catch (error) {
      tick.failed += 1;

      const retryAt = await this.recordFailure(record, key, errorCode(error));

      return key === undefined ? undefined : retryAt;
    }

    tick.published.push(record.event.id);
    this.order.settle(key, record.event.id);

    return undefined;
  }

  private async recordFailure(
    record: OutboxRecord,
    key: string | undefined,
    code: string,
  ): Promise<Date | undefined> {
    const attempts = this.order.attemptsOf(record);
    const dead = attempts >= this.maxAttempts;

    const nextAttemptAt = dead
      ? null
      : new Date(this.clock.now().getTime() + this.delayAfter(attempts));

    if (nextAttemptAt === null) {
      this.order.settle(key, record.event.id);
    } else {
      this.order.block(key, record.event.id, nextAttemptAt);
    }

    await this.store.markFailed(record.event.id, { code }, nextAttemptAt);

    const { id: eventId, type: eventType } = record.event;

    this.onFailure({ kind: 'publish', eventId, eventType, code, attempts, dead });

    return nextAttemptAt ?? undefined;
  }

  private delayAfter(attempts: number): number {
    const { baseMs, factor, maxMs } = this.backoff;

    return Math.min(maxMs, baseMs * factor ** Math.max(0, attempts - 1));
  }

  /** Reschedules a record with the head of its key; the claim it cost is not an attempt. */
  private async holdBack(record: OutboxRecord, hold: HoldUntil): Promise<HoldUntil> {
    this.order.countHold(record.event.id);

    if (hold !== 'lease-expiry') {
      await this.store.markFailed(record.event.id, { code: HELD_FOR_ORDER }, hold);
    }

    return hold;
  }

  private wake(): void {
    if (!this.started) {
      return;
    }

    if (this.running !== undefined) {
      this.wakeQueued = true;

      return;
    }

    clearTimeout(this.timer);
    this.loop();
  }

  private loop(): void {
    this.running = this.tick()
      .catch((error: unknown) => {
        this.onFailure({ kind: 'tick', code: errorCode(error) });
      })
      .finally(() => {
        this.running = undefined;
        this.scheduleNext();
      });
  }

  private scheduleNext(): void {
    if (!this.started) {
      return;
    }

    if (this.wakeQueued) {
      this.wakeQueued = false;
      this.loop();

      return;
    }

    this.timer = setTimeout(() => {
      this.loop();
    }, this.intervalMs);
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
