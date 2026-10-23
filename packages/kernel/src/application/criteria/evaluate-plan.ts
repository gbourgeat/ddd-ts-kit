import type { Page } from '../pagination/page';
import type { CriteriaPlan } from './criteria-plan';
import { pageOfPlan } from './page-of-plan';
import { selectRows } from './select-rows';

/** Runs a plan over rows held in memory, with the semantics every store translator matches. */
export function evaluatePlan<Row extends object>(plan: CriteriaPlan, rows: readonly Row[]): Page<Row> {
  const selected = selectRows(plan, rows);

  return pageOfPlan(plan, selected.rows, selected.total);
}
