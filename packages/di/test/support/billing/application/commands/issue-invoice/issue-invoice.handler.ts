import type { InvoiceLedger } from '../../ports/invoice-ledger.port.js';
import type { IssueInvoice } from './issue-invoice.command.js';

export class IssueInvoiceHandler {
  constructor(private readonly ledger: InvoiceLedger) {}

  async execute(command: IssueInvoice): Promise<void> {
    await this.ledger.record(command.orderId);
  }
}
