import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { RoleName } from '@/contexts/identity/domain/vocabularies/role-name.vocabulary';

export class PracticeMemberAdded implements DomainEvent {
  static readonly eventName = 'identity.practice.member-added';

  readonly name = PracticeMemberAdded.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: {
      readonly personId: string;
      readonly role: RoleName;
      readonly displayName: string;
      readonly timeZone: string;
    },
  ) {}
}
