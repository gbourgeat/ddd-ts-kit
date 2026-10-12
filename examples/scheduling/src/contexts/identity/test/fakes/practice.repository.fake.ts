import { InMemoryRepository } from '@ddd-ts-kit/testing';
import { Practice } from '@/contexts/identity/domain/aggregates/practice.aggregate';
import type { PracticeRepository } from '@/contexts/identity/domain/repositories/practice.repository';

export class FakePracticeRepository extends InMemoryRepository<Practice> implements PracticeRepository {
  constructor() {
    // A copy by rehydration and not a snapshot: a snapshot goes through `structuredClone`, which turns the value objects of the state into plain objects. The state is immutable, so sharing its values between copies is safe.
    super({ clone: (stored: Practice) => Practice.rehydrate(stored.id, stored.toState()) });
  }
}
