import type { Knex } from 'knex';
import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import { ownTenantTable, tenantSchemaTable, tenantTable, type KnexContext } from '../../../src/index.js';
import { BILLING } from '../billing-core/infrastructure/persistence/billing-schema.js';
import type { InvoiceRow } from '../billing-core/infrastructure/persistence/invoice-row.js';

/** How a repository reaches its table under one strategy: to read, and to write. */
export interface InvoiceTables {
  read(context: KnexContext, scope: ExecutionScope): Knex.QueryBuilder<InvoiceRow, InvoiceRow[]>;
  write(context: KnexContext, scope: ExecutionScope): Knex.QueryBuilder<InvoiceRow, InvoiceRow[]>;
}

const INVOICES = { table: 'invoices', schema: BILLING };

/** Shared tables: one table, every statement confined by its tenant column. */
export const SHARED_TABLES: InvoiceTables = {
  read: (context, scope) => tenantTable<InvoiceRow>(context, scope, INVOICES),
  write: (context, scope) => ownTenantTable<InvoiceRow>(context, scope, INVOICES),
};

/** Schema per tenant: the table of the tenant's own schema. */
export const SCHEMA_PER_TENANT: InvoiceTables = {
  read: (context, scope) => tenantSchemaTable<InvoiceRow>(context, scope, INVOICES),
  write: (context, scope) => tenantSchemaTable<InvoiceRow>(context, scope, INVOICES),
};

/** Database per tenant: the table as it is, the unit of work routing to the tenant's database. */
export const DATABASE_PER_TENANT: InvoiceTables = {
  read: (context) => context.executor()<InvoiceRow, InvoiceRow[]>('invoices').withSchema(BILLING),
  write: (context) => context.executor()<InvoiceRow, InvoiceRow[]>('invoices').withSchema(BILLING),
};
