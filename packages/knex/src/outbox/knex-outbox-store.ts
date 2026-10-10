import type { Knex } from 'knex';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { OutboxRecord, OutboxStats, OutboxStatus, OutboxStore } from '@ddd-ts-kit/events';
import { dialectOf } from '../sql/dialect-of.js';
import type { SqlDialect } from '../sql/sql-dialect.js';
import type { KnexContext } from '../unit-of-work/knex-context.js';
import { OUTBOX_TABLE } from './table-names.js';

/**
 * How concurrent relays share the pending records.
 * - `skip-locked`: one `SELECT ... FOR UPDATE SKIP LOCKED` and one update in a short
 *   transaction. Needs PostgreSQL or MySQL 8.
 * - `compare-and-set`: reads the due records, then takes each with an update guarded by the
 *   attempt count it read. No lock clause, so it runs on any database, at one statement per
 *   record.
 */
export type OutboxClaimStrategy = 'skip-locked' | 'compare-and-set';

export interface KnexOutboxStoreOptions {
  /** The schema the table was created in. Default: the default schema of the connection. */
  readonly schema?: string;
  /** Default `outbox`. */
  readonly table?: string;
  /** How long a claimed record stays invisible to other claims. Default 30000. */
  readonly leaseMs?: number;
  /** Default: `skip-locked` on PostgreSQL and MySQL, `compare-and-set` elsewhere. */
  readonly claim?: OutboxClaimStrategy;
}

/** The outbox table as knex returns it. Instants are dates or, on SQLite, epoch milliseconds. */
interface OutboxRow {
  id: string;
  sequence: number | string;
  type: string;
  version: number;
  occurred_at: string;
  payload: unknown;
  traceparent: string | null;
  correlation_id: string | null;
  status: OutboxStatus;
  attempts: number;
  next_attempt_at: Date | number | string;
  last_error_code: string | null;
  published_at: Date | number | string | null;
}

// A fresh record is due at once, whatever clock the relay runs on.
const DUE_IMMEDIATELY = new Date(0);

/**
 * The outbox in a SQL database. `append` runs on the executor of the context: called inside a
 * unit of work, the events are written by the transaction of the command and share its fate,
 * which is the whole point of an outbox.
 */
export class KnexOutboxStore implements OutboxStore {
  private readonly context: KnexContext;

  private readonly schemaName: string | undefined;

  private readonly tableName: string;

  private readonly leaseDurationMs: number;

  private readonly claimStrategy: OutboxClaimStrategy | undefined;

  constructor(context: KnexContext, options: KnexOutboxStoreOptions = {}) {
    this.context = context;
    this.schemaName = options.schema;
    this.tableName = options.table ?? OUTBOX_TABLE;
    this.leaseDurationMs = options.leaseMs ?? 30_000;
    this.claimStrategy = options.claim;
  }

  async append(events: readonly IntegrationEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await this.rows(this.context.executor()).insert(
      events.map((event) => ({
        id: event.id,
        type: event.type,
        version: event.version,
        occurred_at: event.occurredAt,
        // Serialized here: drivers would send a JS array as a SQL array, not as JSON.
        payload: event.payload === undefined ? null : JSON.stringify(event.payload),
        traceparent: event.traceparent ?? null,
        correlation_id: event.correlationId ?? null,
        next_attempt_at: DUE_IMMEDIATELY,
      })),
    );
  }

  async claimBatch(limit: number, now: Date): Promise<OutboxRecord[]> {
    if (limit <= 0) {
      return [];
    }

    const executor = this.context.executor();
    const dialect = dialectOf(executor);

    const strategy =
      this.claimStrategy ?? (dialect === 'postgres' || dialect === 'mysql' ? 'skip-locked' : 'compare-and-set');

    const claimed =
      strategy === 'skip-locked'
        ? await this.claimSkippingLocked(executor, limit, now)
        : await this.claimByCompareAndSet(executor, limit, now);

    const leasedUntil = new Date(now.getTime() + this.leaseDurationMs);

    return claimed.map((row) =>
      toRecord({ ...row, attempts: row.attempts + 1, next_attempt_at: leasedUntil }, dialect),
    );
  }

  async markPublished(ids: readonly string[], at: Date): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.rows(this.context.executor())
      .whereIn('id', [...ids])
      .update({ status: 'published', published_at: at });
  }

  async markFailed(
    id: string,
    error: { readonly code: string },
    nextAttemptAt: Date | null,
  ): Promise<void> {
    await this.rows(this.context.executor())
      .where({ id })
      .whereNot({ status: 'published' })
      .update(
        nextAttemptAt === null
          ? { status: 'dead', last_error_code: error.code }
          : { next_attempt_at: nextAttemptAt, last_error_code: error.code },
      );
  }

  async retryDead(ids: readonly string[], now: Date): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    return this.rows(this.context.executor())
      .whereIn('id', [...ids])
      .where({ status: 'dead' })
      .update({ status: 'pending', attempts: 0, next_attempt_at: now });
  }

  async purgePublished(before: Date): Promise<number> {
    return this.rows(this.context.executor())
      .where({ status: 'published' })
      .where('published_at', '<', before)
      .delete();
  }

  async stats(): Promise<OutboxStats> {
    const executor = this.context.executor();

    // Portable form of `count(*) filter (where ...)`.
    const count = (condition: string, alias: string) =>
      executor.raw(`sum(case when ${condition} then 1 else 0 end) as ??`, [alias]);

    const row: unknown = await this.rows(executor)
      .first(
        count("status = 'pending'", 'pending'),
        count("status = 'pending' and last_error_code is not null", 'failed'),
        count("status = 'dead'", 'dead'),
      );

    return { pending: countAt(row, 'pending'), failed: countAt(row, 'failed'), dead: countAt(row, 'dead') };
  }

  /**
   * Selects the due rows `FOR UPDATE SKIP LOCKED`, so concurrent relays pass over each other's
   * rows instead of waiting, then leases them in the same transaction by pushing
   * `next_attempt_at` forward. The row locks last a few milliseconds; the lease is what covers
   * the publication.
   */
  private claimSkippingLocked(executor: Knex, limit: number, now: Date): Promise<OutboxRow[]> {
    return executor.transaction(async (transaction) => {
      const due = await this.due(transaction, limit, now).forUpdate().skipLocked();

      if (due.length > 0) {
        await this.rows(transaction)
          .whereIn('id', due.map((row) => row.id))
          .update(this.lease(transaction, now));
      }

      return due;
    });
  }

  /**
   * Takes each due row with an update that only applies if nobody claimed it since it was
   * read: every claim increments `attempts`, so an unchanged count on a row that is still due
   * means the row is free. Rows lost to another relay are replaced by reading again.
   */
  private async claimByCompareAndSet(executor: Knex, limit: number, now: Date): Promise<OutboxRow[]> {
    const claimed: OutboxRow[] = [];

    while (claimed.length < limit) {
      const wanted = limit - claimed.length;
      const due = await this.due(executor, wanted, now);

      for (const row of due) {
        const taken = await this.rows(executor)
          .where({ id: row.id, status: 'pending', attempts: row.attempts })
          .where('next_attempt_at', '<=', now)
          .update(this.lease(executor, now));

        if (taken === 1) {
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

  private rows(executor: Knex): Knex.QueryBuilder<OutboxRow, OutboxRow[]> {
    const table = executor<OutboxRow, OutboxRow[]>(this.tableName);

    return this.schemaName === undefined ? table : table.withSchema(this.schemaName);
  }

  private due(executor: Knex, limit: number, now: Date): Knex.QueryBuilder<OutboxRow, OutboxRow[]> {
    return this.rows(executor)
      .select('*')
      .where({ status: 'pending' })
      .where('next_attempt_at', '<=', now)
      .orderBy([{ column: 'next_attempt_at' }, { column: 'sequence' }])
      .limit(limit);
  }

  private lease(executor: Knex, now: Date): { attempts: Knex.Raw; next_attempt_at: Date } {
    return {
      attempts: executor.raw('?? + 1', ['attempts']),
      next_attempt_at: new Date(now.getTime() + this.leaseDurationMs),
    };
  }
}

/** A sum is a bigint or a decimal, which drivers return as a string, and NULL over no row. */
function countAt(row: unknown, column: string): number {
  if (typeof row !== 'object' || row === null) {
    return 0;
  }

  const value: unknown = Object.entries(row).find(([key]) => key === column)?.[1];

  return Number(value ?? 0);
}

function toRecord(row: OutboxRow, dialect: SqlDialect): OutboxRecord {
  // SQLite has no JSON type: the driver hands the text back. Elsewhere the driver has parsed
  // the column already, and a payload that is itself a string must not be parsed twice.
  const payload: unknown =
    dialect === 'sqlite' && typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;

  return {
    event: {
      id: row.id,
      type: row.type,
      version: row.version,
      occurredAt: row.occurred_at,
      payload,
      ...(row.traceparent === null ? {} : { traceparent: row.traceparent }),
      ...(row.correlation_id === null ? {} : { correlationId: row.correlation_id }),
    },
    status: row.status,
    attempts: row.attempts,
    nextAttemptAt: toDate(row.next_attempt_at),
    ...(row.last_error_code === null ? {} : { lastErrorCode: row.last_error_code }),
    ...(row.published_at === null ? {} : { publishedAt: toDate(row.published_at) }),
  };
}

function toDate(value: Date | number | string): Date {
  return value instanceof Date ? value : new Date(value);
}
