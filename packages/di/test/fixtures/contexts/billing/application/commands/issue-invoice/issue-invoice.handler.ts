import { Clock, DomainEventDispatcher, IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { InvoiceIssued } from '../../../domain/events/invoice-issued.event.js';
import { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';
import { CustomerDirectory } from '../../ports/customer-directory.port.js';
import { IssueInvoice } from './issue-invoice.command.js';

@CommandHandler(IssueInvoice, [InvoiceRepository, CustomerDirectory, DomainEventDispatcher, IdGenerator, Clock])
export class IssueInvoiceHandler implements CommandHandler<IssueInvoice> {
  static built = 0;

  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly customers: CustomerDirectory,
    private readonly domainEvents: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {
    IssueInvoiceHandler.built += 1;
  }

  async execute(command: IssueInvoice): Promise<string> {
    if (!(await this.customers.exists(command.customerId))) throw new RangeError(`Unknown customer ${command.customerId}`);

    const id = this.ids.next();
    const issuedAt = this.clock.now();

    await this.invoices.save({ id, customerId: command.customerId, issuedBy: command.actor.id, issuedAt });
    await this.domainEvents.dispatch([new InvoiceIssued(id, issuedAt, command.customerId)]);

    return id;
  }
}
