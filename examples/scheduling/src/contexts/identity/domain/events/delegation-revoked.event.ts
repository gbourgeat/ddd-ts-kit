import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class DelegationRevoked implements DomainEvent {
  readonly name = 'identity.delegation.revoked';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly practiceId: string;
      readonly practitionerId: string;
      readonly assistantId: string;
      readonly cause: 'revoked' | 'expired' | 'member-removed';
    },
  ) {}
}
