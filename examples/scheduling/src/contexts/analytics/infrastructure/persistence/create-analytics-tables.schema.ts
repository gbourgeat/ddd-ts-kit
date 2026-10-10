import type { Knex } from 'knex';
import { readModelColumns } from '@ddd-ts-kit/knex';
import { ANALYTICS_SCHEMA } from './analytics.schema.js';

/** Sorted and compared by range as a read orders strings: by code point. */
const ORDERED_TEXT = 'text collate "C"';

export async function createAnalyticsTables(knex: Knex): Promise<void> {
  await knex.schema.createSchemaIfNotExists(ANALYTICS_SCHEMA);
  await createOutcomeTable(knex);
  await createOccupancyTable(knex);
}

function createOutcomeTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema(ANALYTICS_SCHEMA).createTable('outcomes', (table) => {
    table.specificType('id', ORDERED_TEXT).primary();
    table.text('practice_id').notNullable();
    table.text('calendar_id').notNullable();
    table.specificType('day', ORDERED_TEXT).notNullable();
    table.datetime('starts_at', { useTz: true, precision: 3 }).notNullable();
    table.datetime('ends_at', { useTz: true, precision: 3 }).notNullable();
    table.text('state').notNullable();
    table.datetime('changed_at', { useTz: true, precision: 3 }).notNullable();
    readModelColumns(table);
    table.index(['calendar_id', 'day']);
    table.index(['day', 'id']);
  });
}

function createOccupancyTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema(ANALYTICS_SCHEMA).createTable('occupancy', (table) => {
    table.specificType('id', ORDERED_TEXT).primary();
    table.text('practice_id').notNullable();
    table.specificType('calendar_id', ORDERED_TEXT).notNullable();
    table.specificType('day', ORDERED_TEXT).notNullable();
    table.integer('held_minutes').notNullable();
    table.integer('appointments_held').notNullable();
    table.integer('completed').notNullable();
    table.integer('no_shows').notNullable();
    table.integer('cancelled_by_patient').notNullable();
    table.integer('cancelled_by_practice').notNullable();
    readModelColumns(table);
    table.index(['practice_id', 'day', 'id']);
  });
}
