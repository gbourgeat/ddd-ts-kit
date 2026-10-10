import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { InvoiceIssued } from '../../domain/events/invoice-issued.event.js';
import { Mailer } from '../ports/mailer.port.js';

@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' }, [Mailer])
export class InvoiceIssuedEventHandler implements DomainEventHandler<InvoiceIssued> {
  constructor(private readonly mailer: Mailer) {}

  async handle(event: InvoiceIssued): Promise<void> {
    await this.mailer.send(event.customerId, `Invoice ${event.aggregateId}`);
  }
}
