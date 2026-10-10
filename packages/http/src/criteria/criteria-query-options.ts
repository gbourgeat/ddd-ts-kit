import type { PageRequest } from '@ddd-ts-kit/kernel';

export interface CriteriaQueryOptions {
  /** The variant of a query that names neither `offset` nor `cursor`. Default `offset`. */
  readonly kind?: PageRequest['kind'];
}
