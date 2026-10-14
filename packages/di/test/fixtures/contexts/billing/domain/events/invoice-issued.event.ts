import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class InvoiceIssued implements DomainEvent {
  static readonly eventName = 'billing.invoice.issued';

  readonly name = InvoiceIssued.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly customerId: string,
  ) {}
}
