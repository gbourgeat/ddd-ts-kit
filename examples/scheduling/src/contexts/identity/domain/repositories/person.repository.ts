import { Repository } from '@ddd-ts-kit/kernel';
import type { Person } from '@/contexts/identity/domain/aggregates/person.aggregate';

export abstract class PersonRepository extends Repository<Person> {}
