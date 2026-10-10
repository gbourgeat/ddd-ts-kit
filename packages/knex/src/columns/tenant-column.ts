import type { Knex } from 'knex';
import { INDEXABLE_LENGTH } from './indexable-length.js';

/** Adds the tenant column, `tenant_id`. Fill it and filter on it with `tenantRow`. */
export function tenantColumn(table: Knex.CreateTableBuilder): void {
  table.string('tenant_id', INDEXABLE_LENGTH).notNullable();
}
