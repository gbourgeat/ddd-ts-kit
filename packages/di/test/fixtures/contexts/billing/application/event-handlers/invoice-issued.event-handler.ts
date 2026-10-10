import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { InvoiceIssued } from '../../domain/events/invoice-issued.event.js';
import { MAILER, type Mailer } from '../ports/billing.ports.js';

@DomainEventHandler(InvoiceIssued, { name: 'billing.invoice.issued' }, [MAILER])
export class InvoiceIssuedEventHandler implements DomainEventHandler<InvoiceIssued> {
  constructor(private readonly mailer: Mailer) {}

  async handle(event: InvoiceIssued): Promise<void> {
    await this.mailer.send(event.customerId, `Invoice ${event.aggregateId}`);
  }
}
