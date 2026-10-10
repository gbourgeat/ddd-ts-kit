import type { Page } from '../pagination/page.js';
import type { CriteriaPlan } from './criteria-plan.js';
import { pageOfPlan } from './page-of-plan.js';
import { selectRows } from './select-rows.js';

/** Runs a plan over rows held in memory, with the semantics every store translator matches. */
export function evaluatePlan<Row extends object>(plan: CriteriaPlan, rows: readonly Row[]): Page<Row> {
  const selected = selectRows(plan, rows);

  return pageOfPlan(plan, selected.rows, selected.total);
}
