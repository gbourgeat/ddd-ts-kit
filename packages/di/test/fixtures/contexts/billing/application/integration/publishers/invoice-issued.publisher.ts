import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { InvoiceIssued } from '../../../domain/events/invoice-issued.event.js';

@DomainEventHandler(InvoiceIssued)
export class InvoiceIssuedPublisher implements DomainEventHandler<InvoiceIssued> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: InvoiceIssued): Promise<void> {
    await this.publisher.publish([
      {
        id: this.ids.next(),
        type: 'billing.invoice.issued',
        version: 1,
        occurredAt: event.occurredAt.toISOString(),
        payload: { invoiceId: event.aggregateId },
      },
    ]);
  }
}
