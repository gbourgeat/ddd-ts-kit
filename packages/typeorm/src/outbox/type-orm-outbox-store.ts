import { In, LessThan, LessThanOrEqual, Not, type EntityManager, type EntitySchema } from 'typeorm';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { OutboxRecord, OutboxStats, OutboxStore } from '@ddd-ts-kit/events';
import type { TypeOrmContext } from '../unit-of-work/type-orm-context.js';
import { outboxEntity } from './outbox-entity.js';
import type { OutboxRow } from './outbox-row.js';

/**
 * How concurrent relays share the pending records.
 * - `skip-locked`: one `SELECT ... FOR UPDATE SKIP LOCKED` and one update in a short
 *   transaction. Needs PostgreSQL or MySQL 8.
 * - `compare-and-set`: reads the due records, then takes each with an update guarded by the
 *   attempt count it read. No lock clause, so it runs on any database, at one statement per
 *   record.
 */
export type OutboxClaimStrategy = 'skip-locked' | 'compare-and-set';

export interface TypeOrmOutboxStoreOptions {
  /** Default `outboxEntity()`, which must then be the one the data source registers. */
  readonly entity?: EntitySchema<OutboxRow>;
  /** How long a claimed record stays invisible to other claims. Default 30000. */
  readonly leaseMs?: number;
  /** Default: `skip-locked` on PostgreSQL and MySQL, `compare-and-set` elsewhere. */
  readonly claim?: OutboxClaimStrategy;
}

// A fresh record is due at once, whatever clock the relay runs on.
const DUE_IMMEDIATELY = new Date(0);

const SKIP_LOCKED_DRIVERS: readonly string[] = ['postgres', 'aurora-postgres', 'cockroachdb', 'mysql', 'aurora-mysql'];

/**
 * The outbox in a SQL database. `append` runs on the manager of the context: called inside a
 * unit of work, the events are written by the transaction of the command and share its fate,
 * which is the whole point of an outbox.
 */
export class TypeOrmOutboxStore implements OutboxStore {
  private readonly context: TypeOrmContext;

  private readonly outbox: EntitySchema<OutboxRow>;

  private readonly leaseDurationMs: number;

  private readonly claimStrategy: OutboxClaimStrategy | undefined;

  constructor(context: TypeOrmContext, options: TypeOrmOutboxStoreOptions = {}) {
    this.context = context;
    this.outbox = options.entity ?? outboxEntity();
    this.leaseDurationMs = options.leaseMs ?? 30_000;
    this.claimStrategy = options.claim;
  }

  async append(events: readonly IntegrationEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await this.context
      .manager()
      .createQueryBuilder()
      .insert()
      .into(this.outbox)
      .values(
        events.map((event) => ({
          id: event.id,
          type: event.type,
          version: event.version,
          occurredAt: event.occurredAt,
          // A JSON `null` payload is left out and stored as SQL NULL, the column default.
          ...(event.payload === null || event.payload === undefined ? {} : { payload: event.payload }),
          traceparent: event.traceparent ?? null,
          correlationId: event.correlationId ?? null,
          nextAttemptAt: DUE_IMMEDIATELY,
        })),
      )
      .execute();
  }

  async claimBatch(limit: number, now: Date): Promise<OutboxRecord[]> {
    if (limit <= 0) {
      return [];
    }

    const manager = this.context.manager();

    const strategy =
      this.claimStrategy ??
      (SKIP_LOCKED_DRIVERS.includes(manager.dataSource.options.type) ? 'skip-locked' : 'compare-and-set');

    const claimed =
      strategy === 'skip-locked'
        ? await this.claimSkippingLocked(manager, limit, now)
        : await this.claimByCompareAndSet(manager, limit, now);

    const leasedUntil = new Date(now.getTime() + this.leaseDurationMs);

    return claimed.map((row) => toRecord({ ...row, attempts: row.attempts + 1, nextAttemptAt: leasedUntil }));
  }

  async markPublished(ids: readonly string[], at: Date): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.context.manager().update(this.outbox, { id: In([...ids]) }, { status: 'published', publishedAt: at });
  }

  async markFailed(id: string, error: { readonly code: string }, nextAttemptAt: Date | null): Promise<void> {
    await this.context
      .manager()
      .update(
        this.outbox,
        { id, status: Not('published') },
        nextAttemptAt === null
          ? { status: 'dead', lastErrorCode: error.code }
          : { nextAttemptAt, lastErrorCode: error.code },
      );
  }

  async retryDead(ids: readonly string[], now: Date): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const revived = await this.context
      .manager()
      .update(
        this.outbox,
        { id: In([...ids]), status: 'dead' },
        { status: 'pending', attempts: 0, nextAttemptAt: now },
      );

    return revived.affected ?? 0;
  }

  async purgePublished(before: Date): Promise<number> {
    const purged = await this.context
      .manager()
      .delete(this.outbox, { status: 'published', publishedAt: LessThan(before) });

    return purged.affected ?? 0;
  }

  async stats(): Promise<OutboxStats> {
    // Portable form of `count(*) filter (where ...)`.
    const count = (condition: string): string => `SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END)`;

    const row = await this.context
      .manager()
      .createQueryBuilder(this.outbox, 'outbox')
      .select(count("outbox.status = 'pending'"), 'pending')
      .addSelect(count("outbox.status = 'pending' AND outbox.lastErrorCode IS NOT NULL"), 'failed')
      .addSelect(count("outbox.status = 'dead'"), 'dead')
      .getRawOne<{ pending: unknown; failed: unknown; dead: unknown }>();

    // A sum is a bigint or a decimal, which drivers return as a string, and NULL over no row.
    return {
      pending: Number(row?.pending ?? 0),
      failed: Number(row?.failed ?? 0),
      dead: Number(row?.dead ?? 0),
    };
  }

  /**
   * Selects the due rows `FOR UPDATE SKIP LOCKED`, so concurrent relays pass over each other's
   * rows instead of waiting, then leases them in the same transaction by pushing
   * `next_attempt_at` forward. The row locks last a few milliseconds; the lease is what covers
   * the publication.
   */
  private claimSkippingLocked(manager: EntityManager, limit: number, now: Date): Promise<OutboxRow[]> {
    return manager.transaction(async (transaction) => {
      const due = await this.due(transaction, limit, now)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      if (due.length > 0) {
        await this.lease(transaction, now)
          .where({ id: In(due.map((row) => row.id)) })
          .execute();
      }

      return due;
    });
  }

  /**
   * Takes each due row with an update that only applies if nobody claimed it since it was
   * read: every claim increments `attempts`, so an unchanged count on a row that is still due
   * means the row is free. Rows lost to another relay are replaced by reading again.
   */
  private async claimByCompareAndSet(manager: EntityManager, limit: number, now: Date): Promise<OutboxRow[]> {
    const claimed: OutboxRow[] = [];

    while (claimed.length < limit) {
      const wanted = limit - claimed.length;
      const due = await this.due(manager, wanted, now).getMany();

      for (const row of due) {
        const taken = await this.lease(manager, now)
          .where({
            id: row.id,
            status: 'pending',
            attempts: row.attempts,
            nextAttemptAt: LessThanOrEqual(now),
          })
          .execute();

        if (taken.affected === 1) {
          claimed.push(row);
        }
      }

      if (due.length < wanted) {
        // Nothing else is due: the rows lost to another relay need no replacement.
        break;
      }
    }

    return claimed;
  }

  private due(manager: EntityManager, limit: number, now: Date) {
    return manager
      .createQueryBuilder(this.outbox, 'outbox')
      .where('outbox.status = :status', { status: 'pending' })
      .andWhere('outbox.nextAttemptAt <= :now', { now })
      .orderBy('outbox.nextAttemptAt', 'ASC')
      .addOrderBy('outbox.sequence', 'ASC')
      .limit(limit);
  }

  private lease(manager: EntityManager, now: Date) {
    return manager
      .createQueryBuilder()
      .update(this.outbox)
      .set({
        // A database-side increment: the claim must count from the stored value.
        attempts: () => 'attempts + 1',
        nextAttemptAt: new Date(now.getTime() + this.leaseDurationMs),
      });
  }
}

function toRecord(row: OutboxRow): OutboxRecord {
  return {
    event: {
      id: row.id,
      type: row.type,
      version: row.version,
      occurredAt: row.occurredAt,
      payload: row.payload,
      ...(row.traceparent === null ? {} : { traceparent: row.traceparent }),
      ...(row.correlationId === null ? {} : { correlationId: row.correlationId }),
    },
    status: row.status,
    attempts: row.attempts,
    nextAttemptAt: row.nextAttemptAt,
    ...(row.lastErrorCode === null ? {} : { lastErrorCode: row.lastErrorCode }),
    ...(row.publishedAt === null ? {} : { publishedAt: row.publishedAt }),
  };
}
