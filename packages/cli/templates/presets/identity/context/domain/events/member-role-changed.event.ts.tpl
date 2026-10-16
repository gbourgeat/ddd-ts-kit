import { NamedDomainEvent } from '@ddd-ts-kit/kernel';
import type { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

/** A member holds another role: what they may do in the organisation follows from it from now on. */
export class MemberRoleChanged extends NamedDomainEvent('{{context.kebab}}.member.role-changed') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly organisationId: string;
      readonly accountId: string;
      readonly from: MemberRole;
      readonly to: MemberRole;
      /** The delegation that lent the right to decide it, when the role of who decided did not grant it. */
      readonly delegationId?: string;
    },
  ) {
    super();
  }
}
