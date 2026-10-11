import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { RoleName } from '@/contexts/identity/domain/value-objects/role.vo';

export class PracticeMemberRemoved implements DomainEvent {
  readonly name = 'identity.practice.member-removed';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly facts: { readonly personId: string; readonly role: RoleName },
  ) {}
}
