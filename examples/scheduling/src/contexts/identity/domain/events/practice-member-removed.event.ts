import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { RoleName } from '@/contexts/identity/domain/vocabularies/role-name.vocabulary';

export class PracticeMemberRemoved implements DomainEvent {
  static readonly eventName = 'identity.practice.member-removed';

  readonly name = PracticeMemberRemoved.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: { readonly personId: string; readonly role: RoleName },
  ) {}
}
