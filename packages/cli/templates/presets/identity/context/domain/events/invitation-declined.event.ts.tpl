import type { DomainEvent } from '@ddd-ts-kit/kernel';

/** The person an invitation was addressed to declined it. */
export class InvitationDeclined implements DomainEvent {
  static readonly eventName = '{{context.kebab}}.invitation.declined';

  readonly name = InvitationDeclined.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly organisationId: string;
    },
  ) {}
}
