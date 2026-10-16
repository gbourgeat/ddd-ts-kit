import { NamedDomainEvent } from '@ddd-ts-kit/kernel';

/** A member left an organisation, or was removed from it. */
export class MemberRemoved extends NamedDomainEvent('{{context.kebab}}.member.removed') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly organisationId: string;
      readonly accountId: string;
      /** The delegation that lent the right to decide it, when the role of who decided did not grant it. */
      readonly delegationId?: string;
    },
  ) {
    super();
  }
}
