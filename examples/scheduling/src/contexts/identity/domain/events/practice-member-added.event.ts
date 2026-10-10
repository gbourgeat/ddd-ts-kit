import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { RoleName } from '#src/contexts/identity/domain/value-objects/role.vo.js';

export class PracticeMemberAdded implements DomainEvent {
  readonly name = 'identity.practice.member-added';

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
