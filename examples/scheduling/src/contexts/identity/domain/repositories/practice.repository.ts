import { Repository } from '@ddd-ts-kit/kernel';
import type { Practice } from '../aggregates/practice.aggregate.js';

export abstract class PracticeRepository extends Repository<Practice> {}
