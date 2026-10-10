import { Repository } from '@ddd-ts-kit/kernel';
import type { Practice } from '@/contexts/identity/domain/aggregates/practice.aggregate.js';

export abstract class PracticeRepository extends Repository<Practice> {}
