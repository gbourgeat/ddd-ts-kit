import { CommandBus } from '@ddd-ts-kit/kernel';
import { defineContextModule } from '../../../src/index.js';
import { OrderPlaced } from '../ordering/published-language/order-placed.js';
import { IssueInvoice } from './application/commands/issue-invoice/issue-invoice.command.js';
import { IssueInvoiceHandler } from './application/commands/issue-invoice/issue-invoice.handler.js';
import { InvoiceOnOrderPlaced } from './application/integration/handlers/invoice-on-order-placed.integration-handler.js';
import { InvoiceLedger } from './application/ports/invoice-ledger.port.js';
import { InMemoryInvoiceLedger } from './infrastructure/persistence/in-memory-invoice-ledger.js';

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
