import { BUDGET_LEVELS } from './budget-levels';
import { isDuration } from './is-duration';
import { isOneOf } from './is-one-of';
import { REFERENCE_BUDGET } from './reference-budget';
import { isRecord } from './values/is-record';

/** Something written under `budget` that is not read as written. */
export interface BudgetProblem {
  /** The keys of the config file that lead to the problem, outermost first. */
  readonly where: readonly string[];
  readonly message: string;
  readonly fix: string;
}

const SHAPE = `{ "<level>": <milliseconds> } with the levels ${BUDGET_LEVELS.join(', ')}`;

/** What the raw `budget` value of a config says that the parser replaces by the reference or ignores. */
export function budgetProblems(value: unknown): BudgetProblem[] {
  if (value === undefined) {
    return [];
  }

  if (!isRecord(value)) {
    return [
      {
        where: ['"budget"'],
        message: '"budget" is not an object: the budgets of the reference are used.',
        fix: `Write it as ${SHAPE}, or remove it.`,
      },
    ];
  }

  return Object.entries(value).flatMap(([level, duration]) => levelProblems(level, duration));
}

function levelProblems(level: string, duration: unknown): BudgetProblem[] {
  const where = ['"budget"', `"${level}"`];

  if (!isOneOf(BUDGET_LEVELS, level)) {
    return [
      {
        where,
        message: `"budget.${level}" is not a level held to a time budget: it is ignored.`,
        fix: `Use only: ${BUDGET_LEVELS.join(', ')}.`,
      },
    ];
  }

  if (isDuration(duration)) {
    return [];
  }

  const reference = REFERENCE_BUDGET[level];

  return [
    {
      where,
      message: `"budget.${level}" is ${JSON.stringify(duration)}: it is read as ${reference}.`,
      fix: `Set it to a whole number of milliseconds above zero, or remove it to keep ${reference}.`,
    },
  ];
}
