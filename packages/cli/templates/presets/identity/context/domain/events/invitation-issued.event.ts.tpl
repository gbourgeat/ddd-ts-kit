import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

/** An invitation was issued to an email address. */
export class InvitationIssued implements DomainEvent {
  static readonly eventName = '{{context.kebab}}.invitation.issued';

  readonly name = InvitationIssued.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly organisationId: string;
      readonly email: string;
      readonly role: MemberRole;
      readonly expiresAt: Date;
    },
  ) {}
}
