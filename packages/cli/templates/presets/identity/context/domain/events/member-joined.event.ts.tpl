import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';

/** An account became a member of an organisation, in a role. */
export class MemberJoined implements DomainEvent {
  static readonly eventName = '{{context.kebab}}.member.joined';

  readonly name = MemberJoined.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly organisationId: string;
      readonly accountId: string;
      readonly role: MemberRole;
    },
  ) {}
}
