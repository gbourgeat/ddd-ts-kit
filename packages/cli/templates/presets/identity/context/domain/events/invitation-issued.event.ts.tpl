import { NamedDomainEvent } from '@ddd-ts-kit/kernel';
import type { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

/** An invitation was issued to an email address. */
export class InvitationIssued extends NamedDomainEvent('{{context.kebab}}.invitation.issued') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly organisationId: string;
      readonly email: string;
      readonly role: MemberRole;
      readonly expiresAt: Date;
      /** The delegation that lent the right to invite, when the role of the inviter did not grant it. */
      readonly delegationId?: string;
    },
  ) {
    super();
  }
}
