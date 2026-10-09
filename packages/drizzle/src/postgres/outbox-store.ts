import { and, eq, inArray, lt, lte, ne, sql, type TablesRelationalConfig } from 'drizzle-orm';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { OutboxRecord, OutboxStats, OutboxStore } from '@ddd-ts-kit/events';
import { outboxTable, type OutboxTable } from './schema.js';
import type { DrizzleContext } from './unit-of-work.js';

export interface DrizzleOutboxStoreOptions {
  /** Default `outboxTable()`, in the `public` schema. */
  readonly table?: OutboxTable;
  /** How long a claimed record stays invisible to other claims. Default 30000. */
  readonly leaseMs?: number;
}

type OutboxRow = OutboxTable['$inferSelect'];

// A fresh record is due at once, whatever clock the relay runs on.
const DUE_IMMEDIATELY = new Date(0);

/**
 * The outbox in PostgreSQL. `append` runs on the executor of the context: called inside a
 * unit of work, the events are written by the transaction of the command and share its fate,
 * which is the whole point of an outbox.
 */
export class DrizzleOutboxStore<
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown>,
  S extends TablesRelationalConfig,
> implements OutboxStore
{
  readonly #context: DrizzleContext<Q, F, S>;
  readonly #table: OutboxTable;
  readonly #leaseMs: number;

  constructor(context: DrizzleContext<Q, F, S>, options: DrizzleOutboxStoreOptions = {}) {
    this.#context = context;
    this.#table = options.table ?? outboxTable();
    this.#leaseMs = options.leaseMs ?? 30_000;
  }

  async append(events: readonly IntegrationEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    await this.#context
      .executor()
      .insert(this.#table)
      .values(
        events.map((event) => ({
          id: event.id,
          type: event.type,
          version: event.version,
          occurredAt: event.occurredAt,
          payload: event.payload,
          traceparent: event.traceparent ?? null,
          correlationId: event.correlationId ?? null,
          nextAttemptAt: DUE_IMMEDIATELY,
        })),
      );
  }

  /**
   * Selects the due rows `FOR UPDATE SKIP LOCKED`, so concurrent relays pass over each other's
   * rows instead of waiting, then leases them in the same transaction by pushing
   * `next_attempt_at` forward. The row locks last a few milliseconds; the lease is what covers
   * the publication.
   */
  async claimBatch(limit: number, now: Date): Promise<OutboxRecord[]> {
    const table = this.#table;
    return this.#context.executor().transaction(async (transaction) => {
      const due = await transaction
        .select({ id: table.id })
        .from(table)
        .where(and(eq(table.status, 'pending'), lte(table.nextAttemptAt, now)))
        .orderBy(table.nextAttemptAt, table.sequence)
        .limit(Math.max(0, limit))
        .for('update', { skipLocked: true });
      if (due.length === 0) {
        return [];
      }
      const order = new Map(due.map(({ id }, index) => [id, index]));
      const claimed = await transaction
        .update(table)
        .set({
          attempts: sql`${table.attempts} + 1`,
          nextAttemptAt: new Date(now.getTime() + this.#leaseMs),
        })
        .where(inArray(table.id, [...order.keys()]))
        .returning();
      // RETURNING gives no order guarantee: restore the one of the claim.
      return claimed
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        .map(toRecord);
    });
  }

  async markPublished(ids: readonly string[], at: Date): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.#context
      .executor()
      .update(this.#table)
      .set({ status: 'published', publishedAt: at })
      .where(inArray(this.#table.id, [...ids]));
  }

  async markFailed(
    id: string,
    error: { readonly code: string },
    nextAttemptAt: Date | null,
  ): Promise<void> {
    await this.#context
      .executor()
      .update(this.#table)
      .set(
        nextAttemptAt === null
          ? { status: 'dead', lastErrorCode: error.code }
          : { nextAttemptAt, lastErrorCode: error.code },
      )
      .where(and(eq(this.#table.id, id), ne(this.#table.status, 'published')));
  }

  async retryDead(ids: readonly string[], now: Date): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    const revived = await this.#context
      .executor()
      .update(this.#table)
      .set({ status: 'pending', attempts: 0, nextAttemptAt: now })
      .where(and(inArray(this.#table.id, [...ids]), eq(this.#table.status, 'dead')))
      .returning({ id: this.#table.id });
    return revived.length;
  }

  async purgePublished(before: Date): Promise<number> {
    const purged = await this.#context
      .executor()
      .delete(this.#table)
      .where(and(eq(this.#table.status, 'published'), lt(this.#table.publishedAt, before)))
      .returning({ id: this.#table.id });
    return purged.length;
  }

  async stats(): Promise<OutboxStats> {
    const { status, lastErrorCode } = this.#table;
    // count() is a bigint, which some drivers return as a string.
    const count = (condition: ReturnType<typeof sql>) =>
      sql<number>`count(*) filter (where ${condition})`.mapWith(Number);
    const [row] = await this.#context
      .executor()
      .select({
        pending: count(sql`${status} = 'pending'`),
        failed: count(sql`${status} = 'pending' and ${lastErrorCode} is not null`),
        dead: count(sql`${status} = 'dead'`),
      })
      .from(this.#table);
    return row ?? { pending: 0, failed: 0, dead: 0 };
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
