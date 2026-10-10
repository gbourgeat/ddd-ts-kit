import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ProcessedEventStore } from '@ddd-ts-kit/kernel';
import type { DrizzleContext } from '../unit-of-work/drizzle-context.js';
import { processedEventsTable, type ProcessedEventsTable } from './processed-events-table.js';

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
  private readonly context: DrizzleContext<Q, F, S>;

  private readonly processedEvents: ProcessedEventsTable;

  constructor(context: DrizzleContext<Q, F, S>, options: DrizzleProcessedEventStoreOptions = {}) {
    this.context = context;
    this.processedEvents = options.table ?? processedEventsTable();
  }

  async markProcessed(consumer: string, eventId: string): Promise<boolean> {
    const inserted = await this.context
      .executor()
      .insert(this.processedEvents)
      .values({ consumer, eventId })
      .onConflictDoNothing()
      .returning({ eventId: this.processedEvents.eventId });

    return inserted.length === 1;
  }
}
