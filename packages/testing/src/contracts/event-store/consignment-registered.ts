import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class ConsignmentRegistered implements DomainEvent {
  readonly name = 'shipping.consignment.registered';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}
