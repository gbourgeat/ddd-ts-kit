import type { Knex } from 'knex';
import type { KnexContext } from '../../../../../src';
import { BILLING } from './billing-schema';
import type { InvoiceRow } from './invoice-row';

export function invoicesOf(context: KnexContext): Knex.QueryBuilder<InvoiceRow, InvoiceRow[]> {
  return context.executor()<InvoiceRow, InvoiceRow[]>('invoices').withSchema(BILLING);
}
