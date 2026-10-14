import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class ConsignmentWeighed implements DomainEvent {
  static readonly eventName = 'shipping.consignment.weighed';

  readonly name = ConsignmentWeighed.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly grams: number,
  ) {}
}
