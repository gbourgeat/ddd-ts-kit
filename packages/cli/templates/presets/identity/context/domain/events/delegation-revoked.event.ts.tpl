import { NamedDomainEvent } from '@ddd-ts-kit/kernel';

/** A delegation ended before its period: revoked, or its delegator lost the standing it was granted with. */
export class DelegationRevoked extends NamedDomainEvent('{{context.kebab}}.delegation.revoked') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly organisationId: string;
      readonly delegatorId: string;
      readonly delegateId: string;
    },
  ) {
    super();
  }
}
