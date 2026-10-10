import { InMemoryRepository } from '@ddd-ts-kit/testing';
import { Waitlist } from '../../domain/aggregates/waitlist.aggregate.js';
import type { WaitlistRepository } from '../../domain/repositories/waitlist.repository.js';

export class FakeWaitlistRepository extends InMemoryRepository<Waitlist> implements WaitlistRepository {
  constructor() {
    // A copy by rehydration and not a snapshot: the state holds value objects, which a structured clone would turn into plain data.
    super({ clone: (stored: Waitlist) => Waitlist.rehydrate(stored.id, stored.toState()) });
  }
}
