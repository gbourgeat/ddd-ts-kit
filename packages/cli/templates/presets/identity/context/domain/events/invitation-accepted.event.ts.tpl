import type { DomainEvent } from '@ddd-ts-kit/kernel';

/** The person an invitation was addressed to accepted it. */
export class InvitationAccepted implements DomainEvent {
  static readonly eventName = '{{context.kebab}}.invitation.accepted';

  readonly name = InvitationAccepted.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly organisationId: string;
      readonly accountId: string;
    },
  ) {}
}
