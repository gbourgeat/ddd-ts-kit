import { InMemoryRepository } from '@ddd-ts-kit/testing';
import { Waitlist } from '@/contexts/scheduling/domain/waitlist/aggregates/waitlist.aggregate';
import type { WaitlistRepository } from '@/contexts/scheduling/domain/waitlist/repositories/waitlist.repository';

export class FakeWaitlistRepository extends InMemoryRepository<Waitlist> implements WaitlistRepository {
  constructor() {
    // A copy by rehydration and not a snapshot: the state holds value objects, which a structured clone would turn into plain data.
    super({ clone: (stored: Waitlist) => Waitlist.rehydrate(stored.id, stored.toState()) });
  }
}
