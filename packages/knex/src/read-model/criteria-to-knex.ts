import type { Knex } from 'knex';
import type { CriteriaPlan } from '@ddd-ts-kit/kernel';
import { columnOf } from './column-of.js';
import { predicateToKnex } from './predicate-to-knex.js';

/**
 * Adds a criteria plan to a query on the table of a read model: its filters and the scope of
 * the actor, the keyset of a cursor page, the total order and the window.
 * `criteriaToKnex(db('appointment_list'), planCriteria(definition, criteria), columns)`, then
 * `pageOfPlan(plan, rows)`. A field that may be null is ordered as the plan means it, on every
 * dialect: nulls last ascending, first descending.
 */
export function criteriaToKnex<Builder extends Knex.QueryBuilder>(
  builder: Builder,
  plan: CriteriaPlan,
  columns: Readonly<Record<string, string>>,
): Builder {
  predicateToKnex(builder, plan.filter, columns);
  predicateToKnex(builder, plan.seek, columns);

  for (const { field, direction } of plan.sort) {
    const column = columnOf(columns, field);

    if (plan.fields[field]?.nullable === true) {
      void builder.orderBy(column, direction, direction === 'asc' ? 'last' : 'first');
    } else {
      void builder.orderBy(column, direction);
    }
  }

  void builder.limit(plan.fetch);

  if (plan.offset > 0) {
    void builder.offset(plan.offset);
  }

  return builder;
}
