import type { InvoiceLedger } from '../../ports/invoice-ledger.port';
import type { IssueInvoice } from './issue-invoice.command';

export class IssueInvoiceHandler {
  constructor(private readonly ledger: InvoiceLedger) {}

  async execute(command: IssueInvoice): Promise<void> {
    await this.ledger.record(command.orderId);
  }
}
