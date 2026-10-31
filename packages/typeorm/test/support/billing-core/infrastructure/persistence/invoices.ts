import { EntitySchema } from 'typeorm';
import { auditColumns, schemaNameOf, tenantColumn } from '../../../../../src';
import type { InvoiceRow } from './invoice-row';

/** One schema per bounded context: `billing-core` owns `billing_core.invoices`. */
export const invoices = new EntitySchema<InvoiceRow>({
  name: 'Invoice',
  tableName: 'invoices',
  schema: schemaNameOf('billing-core'),
  columns: {
    id: { type: 'text', primary: true },
    amount: { type: 'int' },
    status: { type: 'text' },
    details: { type: 'jsonb', nullable: true },
    version: { type: 'int' },
    ...tenantColumn(),
    ...auditColumns(),
  },
  // The order of the list queries, tie-breaker included, so a page is read from the index.
  indices: [{ name: 'invoices_tenant_amount_idx', columns: ['tenantId', 'amount', 'id'] }],
});
