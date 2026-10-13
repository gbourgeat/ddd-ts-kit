import { InMemoryRepository } from '@ddd-ts-kit/testing';
import { Invitation } from '{{alias.context}}/domain/aggregates/invitation.aggregate{{alias.ext}}';
import type { InvitationRepository } from '{{alias.context}}/domain/repositories/invitation.repository{{alias.ext}}';

export class FakeInvitationRepository extends InMemoryRepository<Invitation> implements InvitationRepository {
  constructor() {
    // A copy by rehydration and not a snapshot: a snapshot goes through `structuredClone`, which turns the value objects of the state into plain objects. The state is immutable, so sharing its values between copies is safe.
    super({ clone: (stored: Invitation) => Invitation.rehydrate(stored.id, stored.toState()) });
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | undefined> {
    return this.all().find((stored) => stored.toState().tokenHash === tokenHash);
  }
}
