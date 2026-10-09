import type { Clock, DomainEventDispatcher, IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import {
  CLOCK,
  CommandHandler,
  DOMAIN_EVENTS,
  EVENT_PUBLISHER,
  ID_GENERATOR,
} from '@ddd-ts-kit/kernel/declarations';
import { InvoiceIssued } from '../../../domain/events/invoice-issued.event.js';
import type { InvoiceRepository } from '../../../domain/repositories/invoice.repository.js';
import { CUSTOMERS, INVOICES, type CustomerDirectory } from '../../ports/billing.ports.js';
import { IssueInvoice } from './issue-invoice.command.js';

interface Announcing {
  readonly publisher: IntegrationEventPublisher;
  readonly domainEvents: DomainEventDispatcher;
}

@CommandHandler(IssueInvoice, [INVOICES, CUSTOMERS, EVENT_PUBLISHER, DOMAIN_EVENTS, ID_GENERATOR, CLOCK])
export class IssueInvoiceHandler implements CommandHandler<IssueInvoice> {
  static built = 0;
  private readonly announcing: Announcing;

  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly customers: CustomerDirectory,
    publisher: IntegrationEventPublisher,
    domainEvents: DomainEventDispatcher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {
    IssueInvoiceHandler.built += 1;
    this.announcing = { publisher, domainEvents };
  }

  async execute(command: IssueInvoice): Promise<string> {
    if (!(await this.customers.exists(command.customerId))) throw new RangeError(`Unknown customer ${command.customerId}`);
    const id = this.ids.next();
    const issuedAt = this.clock.now();
    await this.invoices.save({ id, customerId: command.customerId, issuedBy: command.actor.id, issuedAt });
    await this.announcing.domainEvents.dispatch([new InvoiceIssued(id, issuedAt, command.customerId)]);
    await this.announcing.publisher.publish([
      { id: this.ids.next(), type: 'billing.invoice.issued', version: 1, occurredAt: issuedAt.toISOString(), payload: { invoiceId: id } },
    ]);
    return id;
  }
}
