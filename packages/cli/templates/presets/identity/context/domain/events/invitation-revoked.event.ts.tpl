import type { DomainEvent } from '@ddd-ts-kit/kernel';

/** The organisation took an invitation back before it was answered. */
export class InvitationRevoked implements DomainEvent {
  static readonly eventName = '{{context.kebab}}.invitation.revoked';

  readonly name = InvitationRevoked.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly organisationId: string;
    },
  ) {}
}
