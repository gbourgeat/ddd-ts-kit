import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class ConsignmentWeighed implements DomainEvent {
  readonly name = 'shipping.consignment.weighed';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly grams: number,
  ) {}
}
