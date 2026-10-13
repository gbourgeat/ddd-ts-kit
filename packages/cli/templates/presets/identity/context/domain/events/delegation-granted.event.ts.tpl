import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';

/** A member lent some of their rights to another, for a period. */
export class DelegationGranted implements DomainEvent {
  static readonly eventName = '{{context.kebab}}.delegation.granted';

  readonly name = DelegationGranted.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly organisationId: string;
      readonly delegatorId: string;
      readonly delegateId: string;
      readonly rights: readonly MemberRight[];
      readonly startsAt: Date;
      readonly endsAt: Date;
    },
  ) {}
}
