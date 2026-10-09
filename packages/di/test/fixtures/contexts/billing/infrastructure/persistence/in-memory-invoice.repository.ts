import { Repository } from '@ddd-ts-kit/kernel/declarations';
import type { Invoice, InvoiceRepository } from '../../domain/repositories/invoice.repository.js';
import { INVOICES } from '../../application/ports/billing.ports.js';

@Repository(INVOICES)
export class InMemoryInvoiceRepository implements InvoiceRepository {
  readonly invoices = new Map<string, Invoice>();

  async save(invoice: Invoice): Promise<void> {
    this.invoices.set(invoice.id, invoice);
  }

  async findById(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }
}
