import type { ListedRows } from '../read-model/listed-rows.js';
import { compareValues } from './compare-values.js';
import type { CriteriaPlan } from './criteria-plan.js';
import { holds } from './holds.js';

/** What the query of a plan answers over rows held in memory: the rows to fetch, in order, and the total. */
export function selectRows<Row extends object>(plan: CriteriaPlan, rows: readonly Row[]): Required<ListedRows<Row>> {
  if (plan.empty) {
    return { rows: [], total: 0 };
  }

  const kept = rows.filter((row) => holds(plan.filter, row, plan.fields));

  const ordered = kept
    .filter((row) => holds(plan.seek, row, plan.fields))
    .sort((left, right) => orderOf(plan, left, right));

  return { rows: ordered.slice(plan.offset, plan.offset + plan.fetch), total: kept.length };
}

function orderOf(plan: CriteriaPlan, left: object, right: object): number {
  for (const { field, direction } of plan.sort) {
    const order = nullsGreatest(plan, field, [Reflect.get(left, field) ?? null, Reflect.get(right, field) ?? null]);

    if (order !== 0) {
      return direction === 'asc' ? order : -order;
    }
  }

  return 0;
}

function nullsGreatest(plan: CriteriaPlan, field: string, [left, right]: readonly [unknown, unknown]): number {
  if (left === null || right === null) {
    return Number(left === null) - Number(right === null);
  }

  return compareValues(plan.fields[field]?.type ?? 'string', left, right);
}
