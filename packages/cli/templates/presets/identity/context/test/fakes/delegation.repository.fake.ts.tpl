import { InMemoryRepository } from '@ddd-ts-kit/testing';
import { Delegation } from '{{alias.context}}/domain/aggregates/delegation.aggregate{{alias.ext}}';
import type { DelegationRepository } from '{{alias.context}}/domain/repositories/delegation.repository{{alias.ext}}';

export class FakeDelegationRepository extends InMemoryRepository<Delegation> implements DelegationRepository {
  constructor() {
    // A copy by rehydration and not a snapshot: a snapshot goes through `structuredClone`, which turns the value objects of the state into plain objects. The state is immutable, so sharing its values between copies is safe.
    super({ clone: (stored: Delegation) => Delegation.rehydrate(stored.id, stored.toState()) });
  }

  async findUnendedTo(organisationId: string, delegateId: string): Promise<readonly Delegation[]> {
    return this.unended(organisationId).filter((stored) => stored.delegateId === delegateId);
  }

  async findUnendedInvolving(organisationId: string, accountId: string): Promise<readonly Delegation[]> {
    return this.unended(organisationId).filter(
      (stored) => stored.delegatorId === accountId || stored.delegateId === accountId,
    );
  }

  private unended(organisationId: string): Delegation[] {
    return this.all().filter(
      (stored) => stored.organisationId === organisationId && stored.toState().endedAt === undefined,
    );
  }
}
