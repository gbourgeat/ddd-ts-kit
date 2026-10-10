import { Repository } from '@ddd-ts-kit/kernel';
import type { Person } from '../aggregates/person.aggregate.js';

export abstract class PersonRepository extends Repository<Person> {}
