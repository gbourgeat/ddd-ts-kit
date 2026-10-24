import { Repository } from '@ddd-ts-kit/kernel';
import type { Person } from '@/contexts/identity/domain/aggregates/person.aggregate';

export abstract class PersonRepository extends Repository<Person> {
  /**
   * The right to erasure: forgets the person, name and address included, and answers whether
   * there was one to forget. A membership, a delegation or an appointment names the person by
   * id alone and stays: the id says nothing of who the person was.
   */
  abstract erase(personId: string): Promise<boolean>;
}
