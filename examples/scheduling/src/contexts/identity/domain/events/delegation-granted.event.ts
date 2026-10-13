import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class DelegationGranted implements DomainEvent {
  static readonly eventName = 'identity.delegation.granted';

  readonly name = DelegationGranted.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly practiceId: string;
      readonly practitionerId: string;
      readonly assistantId: string;
      readonly availabilityIncluded: boolean;
      readonly endsAt: Date | undefined;
    },
  ) {}
}
