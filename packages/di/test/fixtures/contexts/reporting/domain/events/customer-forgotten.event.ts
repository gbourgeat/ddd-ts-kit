import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class CustomerForgotten implements DomainEvent {
  readonly name = 'reporting.customer.forgotten';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}
