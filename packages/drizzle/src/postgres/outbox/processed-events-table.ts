import { primaryKey, text } from 'drizzle-orm/pg-core';
import { instant } from '../columns/instant';
import { tableIn } from '../schema/table-in';

export type ProcessedEventsTable = ReturnType<typeof processedEventsTable>;

/** The idempotency table of the consumers, to include in the migrations like the outbox. */
export function processedEventsTable(schemaName?: string) {
  return tableIn(schemaName)(
    'processed_events',
    {
      consumer: text('consumer').notNull(),
      eventId: text('event_id').notNull(),
      processedAt: instant('processed_at').notNull().defaultNow(),
    },
    // The primary key is the unique (consumer, event_id) the store relies on.
    (table) => [primaryKey({ columns: [table.consumer, table.eventId] })],
  );
}
