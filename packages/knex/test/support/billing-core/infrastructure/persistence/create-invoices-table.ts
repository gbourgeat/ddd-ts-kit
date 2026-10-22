import type { Knex } from 'knex';
import { auditColumns, tenantColumn } from '../../../../../src';
import { BILLING } from './billing-schema';

/** What the migration of the context would contain. */
export async function createInvoicesTable(knex: Knex): Promise<void> {
  await knex.schema.createSchemaIfNotExists(BILLING);

  await knex.schema.withSchema(BILLING).createTable('invoices', (table) => {
    table.text('id').primary();
    table.integer('amount').notNullable();
    table.text('status').notNullable();
    table.integer('version').notNullable();
    tenantColumn(table);
    auditColumns(table);
    // The order of the list queries, tie-breaker included, so a page is read from the index.
    table.index(['tenant_id', 'amount', 'id'], 'invoices_tenant_amount_idx');
  });
}
