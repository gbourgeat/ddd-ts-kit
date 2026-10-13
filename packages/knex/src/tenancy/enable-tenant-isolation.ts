import type { Knex } from 'knex';
import { tenantIsolationStatements } from './tenant-isolation-statements.js';
import type { TenantTableTarget } from './tenant-table-target.js';

/**
 * Row-level security on a table of tenant data, from the migration that creates it:
 * `await enableTenantIsolation(knex, { schema: 'billing', table: 'invoices' })`. PostgreSQL only.
 */
export async function enableTenantIsolation(knex: Knex, target: TenantTableTarget): Promise<void> {
  for (const statement of tenantIsolationStatements(target)) {
    await knex.raw(statement);
  }
}
