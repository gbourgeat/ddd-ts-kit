import type { Budget } from './budget';
import type { BUDGET_LEVELS } from './budget-levels';
import { isDuration } from './is-duration';
import { REFERENCE_BUDGET } from './reference-budget';
import { isRecord } from './values/is-record';

/** Tolerant like the rest of the config: a budget that is not a duration is read as the reference, and `check` says so. */
export function parseBudget(value: unknown): Budget {
  const raw = isRecord(value) ? value : {};

  return {
    unit: budgetOf(raw, 'unit'),
    integration: budgetOf(raw, 'integration'),
  };
}

function budgetOf(raw: Record<string, unknown>, level: (typeof BUDGET_LEVELS)[number]): number {
  const written = raw[level];

  return isDuration(written) ? written : REFERENCE_BUDGET[level];
}
