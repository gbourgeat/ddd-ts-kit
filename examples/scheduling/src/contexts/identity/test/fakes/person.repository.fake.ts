import { InMemoryRepository } from '@ddd-ts-kit/testing';
import { Person } from '@/contexts/identity/domain/aggregates/person.aggregate';
import type { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository';

export class FakePersonRepository extends InMemoryRepository<Person> implements PersonRepository {
  constructor() {
    // A copy by rehydration and not a snapshot: a snapshot goes through `structuredClone`, which turns the value objects of the state into plain objects. The state is immutable, so sharing its values between copies is safe.
    super({ clone: (stored: Person) => Person.rehydrate(stored.id, stored.toState()) });
  }

  async erase(personId: string): Promise<boolean> {
    return this.remove(personId);
  }
}
