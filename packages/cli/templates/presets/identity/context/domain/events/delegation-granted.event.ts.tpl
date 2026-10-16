import { NamedDomainEvent } from '@ddd-ts-kit/kernel';
import type { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';

/** A member lent some of their rights to another, for a period. */
export class DelegationGranted extends NamedDomainEvent('{{context.kebab}}.delegation.granted') {
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
  ) {
    super();
  }
}
