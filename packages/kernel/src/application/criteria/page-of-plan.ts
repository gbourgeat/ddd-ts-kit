import type { CursorPosition } from '../pagination/cursor-position.js';
import { encodeCursor } from '../pagination/encode-cursor.js';
import { pageOf } from '../pagination/page-of.js';
import type { Page } from '../pagination/page.js';
import type { CriteriaPlan } from './criteria-plan.js';

/**
 * The page of a plan from the rows its query answered, in order. An offset page carries the
 * total when it was counted; a cursor page, fetched one row longer than asked, carries a
 * `nextCursor` when that extra row came.
 */
export function pageOfPlan<Row extends object>(plan: CriteriaPlan, rows: readonly Row[], total?: number): Page<Row> {
  if (plan.kind === 'offset') {
    return pageOf(rows.slice(0, plan.limit), total === undefined ? {} : { total });
  }

  const items = rows.slice(0, plan.limit);
  const last = items.at(-1);

  return pageOf(
    items,
    rows.length > plan.limit && last !== undefined ? { nextCursor: encodeCursor(positionOf(plan, last)) } : {},
  );
}

function positionOf(plan: CriteriaPlan, row: object): CursorPosition {
  return Object.fromEntries(plan.sort.map(({ field }) => [field, written(Reflect.get(row, field))]));
}

function written(value: unknown): CursorPosition[string] {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null;
}
