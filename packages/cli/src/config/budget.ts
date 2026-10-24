import type { BUDGET_LEVELS } from './budget-levels';

/**
 * The time a spec file of each level may take, in milliseconds, a floor on the speed of the loop,
 * not a goal; and whether a spec over its budget fails the run (`enforce`) or is a warning, the
 * default, since a duration depends on the load of the machine as much as on the spec.
 */
export type Budget = Readonly<Record<(typeof BUDGET_LEVELS)[number], number>> & { readonly enforce: boolean };
