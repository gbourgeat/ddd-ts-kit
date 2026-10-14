import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class ConsignmentRegistered implements DomainEvent {
  static readonly eventName = 'shipping.consignment.registered';

  readonly name = ConsignmentRegistered.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}
