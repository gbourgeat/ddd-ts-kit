import type { InvoiceLedger } from '../../application/ports/invoice-ledger.port.js';

export class InMemoryInvoiceLedger implements InvoiceLedger {
  readonly invoicedOrders: string[] = [];

  async record(orderId: string): Promise<void> {
    this.invoicedOrders.push(orderId);
  }
}
