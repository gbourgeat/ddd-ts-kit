import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { DelegationEndCause } from '@/contexts/identity/domain/vocabularies/delegation-end-cause.vocabulary';

export class DelegationRevoked implements DomainEvent {
  readonly name = 'identity.delegation.revoked';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly practiceId: string;
      readonly practitionerId: string;
      readonly assistantId: string;
      readonly cause: DelegationEndCause;
    },
  ) {}
}
