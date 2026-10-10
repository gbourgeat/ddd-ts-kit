import type { Knex } from 'knex';
import { builderIn } from './builder-in.js';
import type { OutboxTablesOptions } from './outbox-tables-options.js';
import { OUTBOX_TABLE, PROCESSED_EVENTS_TABLE } from './table-names.js';

/** The `down` of `createOutboxTables`. The schema itself is left in place. */
export async function dropOutboxTables(knex: Knex, options: OutboxTablesOptions = {}): Promise<void> {
  await builderIn(knex, options.schema).dropTableIfExists(
    options.processedEventsTable ?? PROCESSED_EVENTS_TABLE,
  );

  await builderIn(knex, options.schema).dropTableIfExists(options.outboxTable ?? OUTBOX_TABLE);
}
