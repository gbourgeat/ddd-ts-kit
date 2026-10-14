import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class CustomerForgotten implements DomainEvent {
  static readonly eventName = 'reporting.customer.forgotten';

  readonly name = CustomerForgotten.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}
