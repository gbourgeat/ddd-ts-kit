import type { DomainEvent } from '@ddd-ts-kit/kernel';

/** A member left an organisation, or was removed from it. */
export class MemberRemoved implements DomainEvent {
  static readonly eventName = '{{context.kebab}}.member.removed';

  readonly name = MemberRemoved.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly organisationId: string;
      readonly accountId: string;
    },
  ) {}
}
