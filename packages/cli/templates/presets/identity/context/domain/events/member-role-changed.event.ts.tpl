import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

/** A member holds another role: what they may do in the organisation follows from it from now on. */
export class MemberRoleChanged implements DomainEvent {
  static readonly eventName = '{{context.kebab}}.member.role-changed';

  readonly name = MemberRoleChanged.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly organisationId: string;
      readonly accountId: string;
      readonly from: MemberRole;
      readonly to: MemberRole;
    },
  ) {}
}
