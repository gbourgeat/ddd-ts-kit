import { CommandBus } from '@ddd-ts-kit/kernel';
import { defineContextModule } from '../../../src';
import { OrderPlaced } from '../ordering/published-language/order-placed';
import { IssueInvoice } from './application/commands/issue-invoice/issue-invoice.command';
import { IssueInvoiceHandler } from './application/commands/issue-invoice/issue-invoice.handler';
import { InvoiceOnOrderPlaced } from './application/integration/handlers/invoice-on-order-placed.integration-handler';
import { InvoiceLedger } from './application/ports/invoice-ledger.port';
import { InMemoryInvoiceLedger } from './infrastructure/persistence/in-memory-invoice-ledger';

/** The explicit module of a context that consumes the events of ordering. */
export const billingModule = defineContextModule({
  name: 'billing',
  register(builder) {
    builder.bind(InvoiceLedger).toClass(InMemoryInvoiceLedger);
    builder.command(IssueInvoice).handledBy(IssueInvoiceHandler, [InvoiceLedger]);

    builder
      .on(OrderPlaced, { consumer: 'billing.invoice-on-order-placed' })
      .handledBy(InvoiceOnOrderPlaced, [CommandBus]);
  },
});
