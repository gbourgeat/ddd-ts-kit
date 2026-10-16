import { NamedDomainEvent } from '@ddd-ts-kit/kernel';

/** The organisation took an invitation back before it was answered. */
export class InvitationRevoked extends NamedDomainEvent('{{context.kebab}}.invitation.revoked') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly organisationId: string;
    },
  ) {
    super();
  }
}
