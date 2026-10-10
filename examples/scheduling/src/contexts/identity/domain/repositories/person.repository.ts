import { Repository } from '@ddd-ts-kit/kernel';
import type { Person } from '#src/contexts/identity/domain/aggregates/person.aggregate.js';

export abstract class PersonRepository extends Repository<Person> {}
