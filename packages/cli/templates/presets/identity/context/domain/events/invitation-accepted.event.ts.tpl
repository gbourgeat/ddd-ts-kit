import { NamedDomainEvent } from '@ddd-ts-kit/kernel';

/** The person an invitation was addressed to accepted it. */
export class InvitationAccepted extends NamedDomainEvent('{{context.kebab}}.invitation.accepted') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly organisationId: string;
      readonly accountId: string;
    },
  ) {
    super();
  }
}
