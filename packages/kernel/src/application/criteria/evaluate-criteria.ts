import type { Page } from '../pagination/page';
import type { CriteriaDefinition } from './criteria-definition';
import type { Criteria } from './criteria';
import { evaluatePlan } from './evaluate-plan';
import { planCriteria } from './plan-criteria';
import type { ScopedCriteria } from './scoped-criteria';

/**
 * A criteria run over rows held in memory: what a fake of a read port answers with, and the
 * reference semantics of criteria. Throws `InvalidCriteriaError` on a criteria the definition
 * refuses, as a store translator does.
 */
export function evaluateCriteria<Row extends object>(
  definition: CriteriaDefinition<Row>,
  rows: readonly Row[],
  criteria: Criteria<Row> | ScopedCriteria<Row>,
): Page<Row> {
  return evaluatePlan(planCriteria(definition, criteria), rows);
}
