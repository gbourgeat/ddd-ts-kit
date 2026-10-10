import type { Knex } from 'knex';
import { INDEXABLE_LENGTH } from './indexable-length.js';
import { INSTANT } from './instant.js';

/**
 * Adds the four audit columns to a table being created, under the same names in every project:
 * `created_at`, `created_by`, `updated_at`, `updated_by`. Fill them with `auditRow`.
 */
export function auditColumns(table: Knex.CreateTableBuilder): void {
  table.datetime('created_at', INSTANT).notNullable();
  table.string('created_by', INDEXABLE_LENGTH).notNullable();
  table.datetime('updated_at', INSTANT).notNullable();
  table.string('updated_by', INDEXABLE_LENGTH).notNullable();
}
