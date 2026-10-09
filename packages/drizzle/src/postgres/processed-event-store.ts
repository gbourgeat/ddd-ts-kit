import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ProcessedEventStore } from '@ddd-ts-kit/kernel';
import { processedEventsTable, type ProcessedEventsTable } from './schema.js';
import type { DrizzleContext } from './unit-of-work.js';

export interface DrizzleProcessedEventStoreOptions {
  /** Default `processedEventsTable()`, in the `public` schema. */
  readonly table?: ProcessedEventsTable;
}

/**
 * Idempotency of consumers in PostgreSQL. It writes on the executor of the context: when the
 * consumer runs inside a unit of work, the mark commits with the effects of the handler and
 * disappears with them if the handler fails, so the redelivery is processed.
 */
export class DrizzleProcessedEventStore<
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown>,
  S extends TablesRelationalConfig,
> implements ProcessedEventStore
{
  readonly #context: DrizzleContext<Q, F, S>;
  readonly #table: ProcessedEventsTable;

  constructor(context: DrizzleContext<Q, F, S>, options: DrizzleProcessedEventStoreOptions = {}) {
    this.#context = context;
    this.#table = options.table ?? processedEventsTable();
  }

  async markProcessed(consumer: string, eventId: string): Promise<boolean> {
    const inserted = await this.#context
      .executor()
      .insert(this.#table)
      .values({ consumer, eventId })
      .onConflictDoNothing()
      .returning({ eventId: this.#table.eventId });
    return inserted.length === 1;
  }
}
