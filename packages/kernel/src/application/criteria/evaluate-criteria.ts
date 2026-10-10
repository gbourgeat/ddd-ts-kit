import type { Page } from '../pagination/page.js';
import type { CriteriaDefinition } from './criteria-definition.js';
import type { Criteria } from './criteria.js';
import { evaluatePlan } from './evaluate-plan.js';
import { planCriteria } from './plan-criteria.js';
import type { ScopedCriteria } from './scoped-criteria.js';

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
