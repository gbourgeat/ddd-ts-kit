import { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Invoice } from '../../../domain/invoice.js';
import { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';
import { CustomerDirectory } from '../../ports/customer-directory.port.js';
import { IssueInvoice } from './issue-invoice.command.js';

@CommandHandler(IssueInvoice, [InvoiceRepository, CustomerDirectory, IdGenerator, Clock])
export class IssueInvoiceHandler implements CommandHandler<IssueInvoice> {
  static built = 0;

  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly customers: CustomerDirectory,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {
    IssueInvoiceHandler.built += 1;
  }

  async execute(command: IssueInvoice): Promise<string> {
    if (!(await this.customers.exists(command.customerId))) {
      throw new RangeError(`Unknown customer ${command.customerId}`);
    }

    const { customerId, actor } = command;
    const invoice = Invoice.issue({ id: this.ids.next(), customerId, issuedBy: actor.id, issuedAt: this.clock.now() });

    await this.invoices.save(invoice);

    return invoice.id;
  }
}
