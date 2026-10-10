import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import type { Invoice } from '../../../domain/invoice.js';
import { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';
import { GetInvoice } from './get-invoice.query.js';

@QueryHandler(GetInvoice, [InvoiceRepository])
export class GetInvoiceHandler implements QueryHandler<GetInvoice> {
  constructor(private readonly invoices: InvoiceRepository) {}

  async execute(query: GetInvoice): Promise<Invoice | undefined> {
    return this.invoices.findById(query.invoiceId);
  }
}
