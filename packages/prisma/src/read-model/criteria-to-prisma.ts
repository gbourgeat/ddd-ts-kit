import type { CriteriaPlan } from '@ddd-ts-kit/kernel';
import { predicateToPrisma } from './predicate-to-prisma';
import type { PrismaCriteria } from './prisma-criteria';

/**
 * Turns a criteria plan into the arguments of a `findMany` on the model of a read model:
 * `client.appointmentRow.findMany({ where, orderBy, take, skip })`, then `pageOfPlan(plan, rows)`.
 * A field that may be null is ordered as the plan means it: nulls last ascending, first
 * descending. `fields` renames a field of the read model whose model field differs.
 */
export function criteriaToPrisma(plan: CriteriaPlan, fields: Readonly<Record<string, string>> = {}): PrismaCriteria {
  const counted = predicateToPrisma(plan.filter, fields);
  const seek = predicateToPrisma(plan.seek, fields);

  return {
    where: plan.seek === undefined ? counted : { AND: [counted, seek] },
    counted,
    orderBy: plan.sort.map(({ field, direction }) => {
      const name = Object.hasOwn(fields, field) ? (fields[field] ?? field) : field;
      const nulls = direction === 'asc' ? 'last' : 'first';

      return { [name]: plan.fields[field]?.nullable === true ? { sort: direction, nulls } : direction };
    }),
    take: plan.fetch,
    skip: plan.offset,
  };
}
