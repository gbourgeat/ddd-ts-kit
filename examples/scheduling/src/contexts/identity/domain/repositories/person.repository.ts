import { Repository } from '@ddd-ts-kit/kernel';
import type { Person } from '@/contexts/identity/domain/aggregates/person.aggregate';

/** The persons the platform knows; what an erasure forgets of them is declared in `person.personal-fields.ts`. */
export abstract class PersonRepository extends Repository<Person> {}
