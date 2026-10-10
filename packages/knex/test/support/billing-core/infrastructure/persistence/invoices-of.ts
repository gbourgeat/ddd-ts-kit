import type { Knex } from 'knex';
import type { KnexContext } from '../../../../../src/index.js';
import { BILLING } from './billing-schema.js';
import type { InvoiceRow } from './invoice-row.js';

export function invoicesOf(context: KnexContext): Knex.QueryBuilder<InvoiceRow, InvoiceRow[]> {
  return context.executor()<InvoiceRow, InvoiceRow[]>('invoices').withSchema(BILLING);
}
