import { and, asc, desc, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { CriteriaPlan } from '@ddd-ts-kit/kernel';
import { columnOf } from './column-of.js';
import { predicateToDrizzle } from './predicate-to-drizzle.js';

/** A criteria plan as the parts of a drizzle query. */
export interface DrizzleCriteria {
  /** The filters, the scope of the actor and the keyset of a cursor page. */
  readonly where: SQL | undefined;
  /** The filters and the scope alone: what the total of an offset page counts. */
  readonly counted: SQL | undefined;
  readonly orderBy: SQL[];
  readonly limit: number;
  readonly offset: number;
}

/**
 * Turns a criteria plan into the parts of a query on the table of a read model:
 * `db.select().from(appointments).where(where).orderBy(...orderBy).limit(limit).offset(offset)`,
 * then `pageOfPlan(plan, rows)`. A field that may be null is ordered as the plan means it:
 * nulls last ascending, first descending.
 */
export function criteriaToDrizzle(plan: CriteriaPlan, columns: Readonly<Record<string, PgColumn>>): DrizzleCriteria {
  const counted = predicateToDrizzle(plan.filter, columns);

  return {
    where: and(counted, predicateToDrizzle(plan.seek, columns)),
    counted,
    orderBy: plan.sort.map(({ field, direction }) => {
      const column = columnOf(columns, field);

      if (plan.fields[field]?.nullable !== true) {
        return direction === 'asc' ? asc(column) : desc(column);
      }

      return direction === 'asc' ? sql`${column} asc nulls last` : sql`${column} desc nulls first`;
    }),
    limit: plan.fetch,
    offset: plan.offset,
  };
}
