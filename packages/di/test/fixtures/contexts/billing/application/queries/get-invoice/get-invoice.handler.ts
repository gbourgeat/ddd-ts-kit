import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import type { Invoice } from '../../../domain/invoice';
import { InvoiceRepository } from '../../../domain/repositories/invoice.repository';
import { GetInvoice } from './get-invoice.query';

@QueryHandler(GetInvoice, [InvoiceRepository])
export class GetInvoiceHandler implements QueryHandler<GetInvoice> {
  constructor(private readonly invoices: InvoiceRepository) {}

  async execute(query: GetInvoice): Promise<Invoice | undefined> {
    return this.invoices.findById(query.invoiceId);
  }
}
