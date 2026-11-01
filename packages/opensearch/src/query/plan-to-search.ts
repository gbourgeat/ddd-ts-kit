import type { CriteriaPlan } from '@ddd-ts-kit/kernel';
import type { DocumentMapper } from '../mapping/document.mapper';
import { RESERVED } from '../mapping/reserved-fields';
import { predicateToQuery } from './predicate-to-query';

type Query = Readonly<Record<string, unknown>>;

/**
 * The body of the `_search` of a plan. The filters, the scope of the actor and, for a cursor page,
 * the keyset of the plan (`plan.seek`, as the SQL stores page) are filters; the traces of deleted
 * rows are left out; `confined` adds the tenant condition. A field that may be null sorts its
 * nulls last ascending and first descending, as the plan means it. An offset page counts its total
 * exactly (`track_total_hits`), a cursor page counts nothing.
 */
export function planToSearch(plan: CriteriaPlan, fields: DocumentMapper<unknown>, confined: readonly Query[]): Query {
  const filter = [plan.filter, plan.seek].flatMap((predicate) =>
    predicate === undefined ? [] : [predicateToQuery(predicate, fields)],
  );

  return {
    query: {
      bool: { filter: [...confined, ...filter], must_not: [{ term: { [RESERVED.deleted]: true } }] },
    },
    sort: plan.sort.map(({ field, direction }) => ({
      [fields.pathOf(field)]: { order: direction, missing: direction === 'asc' ? '_last' : '_first' },
    })),
    from: plan.offset,
    size: plan.fetch,
    track_total_hits: plan.kind === 'offset',
  };
}
