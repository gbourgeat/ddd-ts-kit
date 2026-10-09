import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class InvoiceIssued implements DomainEvent {
  readonly name = 'billing.invoice.issued';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly customerId: string,
  ) {}
}
