import { InMemoryRepository } from '@ddd-ts-kit/testing';
import { Delegation } from '../../domain/aggregates/delegation.aggregate.js';
import type { Desk } from '../../domain/value-objects/desk.vo.js';
import type { DelegationRepository } from '../../domain/repositories/delegation.repository.js';

export class FakeDelegationRepository extends InMemoryRepository<Delegation> implements DelegationRepository {
  constructor() {
    // A copy by rehydration and not a snapshot: a snapshot goes through `structuredClone`, which turns the value objects of the state into plain objects. The state is immutable, so sharing its values between copies is safe.
    super({ clone: (stored: Delegation) => Delegation.rehydrate(stored.id, stored.toState()) });
  }

  async findActiveBetween(desk: Desk, assistantId: string): Promise<Delegation | undefined> {
    return this.all().find((stored) => stored.isActive && stored.isOn(desk) && stored.assistantId === assistantId);
  }

  async findActiveOfMember(practiceId: string, personId: string): Promise<readonly Delegation[]> {
    return this.all().filter((stored) => stored.isActive && stored.desk.practiceId === practiceId && involves(stored, personId));
  }

  async findDueAt(instant: Date): Promise<readonly Delegation[]> {
    return this.all().filter((stored) => stored.isActive && endsBy(stored, instant));
  }
}

function involves(delegation: Delegation, personId: string): boolean {
  return delegation.desk.practitionerId === personId || delegation.assistantId === personId;
}

function endsBy(delegation: Delegation, instant: Date): boolean {
  const endsAt = delegation.toState().endsAt;

  return endsAt !== undefined && endsAt.getTime() <= instant.getTime();
}
