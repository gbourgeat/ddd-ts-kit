import { index, integer, text } from 'drizzle-orm/pg-core';
import { auditColumns, contextSchema, tenantColumn } from '../../../../../src/postgres.js';

/** One schema per bounded context: `billing-core` owns `billing_core.invoices`. */
const billing = contextSchema('billing-core');

export const invoices = billing.table(
  'invoices',
  {
    id: text('id').primaryKey(),
    amount: integer('amount').notNull(),
    status: text('status').$type<'draft' | 'issued'>().notNull(),
    version: integer('version').notNull(),
    ...tenantColumn(),
    ...auditColumns(),
  },
  // The order of the list queries, tie-breaker included, so a page is read from the index.
  (table) => [index('invoices_tenant_amount_idx').on(table.tenantId, table.amount, table.id)],
);
