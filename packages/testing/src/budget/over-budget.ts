import type { BudgetLevel } from './reference-budget';

/** One spec file as a run timed it: its path from the project root, its level and the milliseconds it took. */
export interface TimedSpec {
  readonly file: string;
  readonly level: BudgetLevel;
  readonly duration: number;
}

/** What a run says of its budget: the slowest spec of each level that ran, and the specs over their budget, slowest first. */
export interface BudgetReading {
  readonly slowest: Partial<Readonly<Record<BudgetLevel, TimedSpec>>>;
  readonly over: readonly TimedSpec[];
}

export function overBudget(specs: readonly TimedSpec[], budget: Readonly<Record<BudgetLevel, number>>): BudgetReading {
  const slowest: Partial<Record<BudgetLevel, TimedSpec>> = {};

  for (const spec of specs) {
    const known = slowest[spec.level];

    if (known === undefined || spec.duration > known.duration) {
      slowest[spec.level] = spec;
    }
  }

  const over = specs.filter((spec) => spec.duration > budget[spec.level]).sort((a, b) => b.duration - a.duration);

  return { slowest, over };
}
