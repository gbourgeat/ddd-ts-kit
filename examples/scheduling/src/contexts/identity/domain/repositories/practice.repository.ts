import { Repository } from '@ddd-ts-kit/kernel';
import type { Practice } from '@/contexts/identity/domain/aggregates/practice.aggregate';

export abstract class PracticeRepository extends Repository<Practice> {}
