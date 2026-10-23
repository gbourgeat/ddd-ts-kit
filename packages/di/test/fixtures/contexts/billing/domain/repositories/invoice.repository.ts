import type { Invoice } from '../invoice';

export abstract class InvoiceRepository {
  abstract save(invoice: Invoice): Promise<void>;

  abstract findById(id: string): Promise<Invoice | undefined>;
}
