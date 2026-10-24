import type { BUDGET_LEVELS } from './budget-levels';

/** The time a spec file of each level may take, in milliseconds: a floor on the speed of the loop, not a goal. */
export type Budget = Readonly<Record<(typeof BUDGET_LEVELS)[number], number>>;
