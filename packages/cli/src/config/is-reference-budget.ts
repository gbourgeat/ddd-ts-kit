import type { Budget } from './budget';
import { BUDGET_LEVELS } from './budget-levels';
import { REFERENCE_BUDGET } from './reference-budget';

/** True when no budget departs from the reference: the config file then has nothing to say about the time of the specs. */
export function isReferenceBudget(budget: Budget): boolean {
  return BUDGET_LEVELS.every((level) => budget[level] === REFERENCE_BUDGET[level]);
}
