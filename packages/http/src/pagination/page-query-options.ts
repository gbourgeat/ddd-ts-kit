import type { PageLimits, PageRequest } from '@ddd-ts-kit/kernel';

export interface PageQueryOptions<Field extends string = never> extends Partial<PageLimits> {
  /** The closed list of fields a client may sort by. Without it, a `sort` parameter is refused. */
  readonly sortable?: readonly Field[];
  /** The variant of a query that names neither `offset` nor `cursor`. Default `offset`. */
  readonly kind?: PageRequest['kind'];
}
