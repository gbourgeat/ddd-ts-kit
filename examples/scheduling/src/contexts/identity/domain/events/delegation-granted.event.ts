import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class DelegationGranted implements DomainEvent {
  readonly name = 'identity.delegation.granted';

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
