import type { Knex } from 'knex';
import { INDEXABLE_LENGTH } from '../columns/indexable-length.js';
import { INSTANT } from '../columns/instant.js';

/**
 * Adds to a read model table the columns a projection orders its events by, under the same
 * names in every project: `last_event_id`, `last_event_at`, `last_event_version` and `deleted`,
 * the trace a removed row leaves so that a late event does not bring it back.
 */
export function readModelColumns(table: Knex.CreateTableBuilder): void {
  table.string('last_event_id', INDEXABLE_LENGTH).notNullable();
  table.datetime('last_event_at', INSTANT).notNullable();
  table.bigInteger('last_event_version').nullable();
  table.boolean('deleted').notNullable().defaultTo(false);
}
