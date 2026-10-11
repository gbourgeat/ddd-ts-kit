import type { Knex } from 'knex';
import { readModelColumns } from '@ddd-ts-kit/knex';
import { ANALYTICS_SCHEMA } from '@/contexts/analytics/infrastructure/persistence/analytics.schema';

/** Sorted and compared by range as a read orders strings: by code point. */
const ORDERED_TEXT = 'text collate "C"';

export async function createAnalyticsTables(knex: Knex): Promise<void> {
  await knex.schema.createSchemaIfNotExists(ANALYTICS_SCHEMA);
  await createOutcomeTable(knex);
}

function createOutcomeTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema(ANALYTICS_SCHEMA).createTable('outcomes', (table) => {
    table.specificType('id', ORDERED_TEXT).primary();
    table.text('practice_id').notNullable();
    table.specificType('calendar_id', ORDERED_TEXT).notNullable();
    table.specificType('day', ORDERED_TEXT).notNullable();
    table.datetime('starts_at', { useTz: true, precision: 3 }).notNullable();
    table.datetime('ends_at', { useTz: true, precision: 3 }).notNullable();
    table.text('state').notNullable();
    table.datetime('changed_at', { useTz: true, precision: 3 }).notNullable();
    readModelColumns(table);
    table.index(['calendar_id', 'day']);
    // The occupancy is measured when it is read: a read costs the outcomes of the practice over the
    // days asked for, which this index bounds. Without a range of days it reads all of the practice.
    table.index(['practice_id', 'day', 'calendar_id']);
    table.index(['day', 'id']);
  });
}
