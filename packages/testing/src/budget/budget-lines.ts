import type { BudgetReading, TimedSpec } from './over-budget';
import type { BudgetLevel } from './reference-budget';

/** What a run prints of its budget: one line per level that ran, and the failure to raise when a spec is over. */
export interface BudgetLines {
  readonly lines: readonly string[];
  readonly failure: string | undefined;
}

const LEVELS: readonly BudgetLevel[] = ['unit', 'integration'];

export function budgetLines(reading: BudgetReading, budget: Readonly<Record<BudgetLevel, number>>): BudgetLines {
  const lines = LEVELS.flatMap((level) => {
    const slowest = reading.slowest[level];

    return slowest === undefined
      ? []
      : [`${capitalised(level)} specs: the slowest took ${timed(slowest)}, budget ${budget[level]} ms.`];
  });

  if (reading.over.length === 0) {
    return { lines, failure: undefined };
  }

  const listed = reading.over.map(
    (spec) => `${spec.file} (${spec.duration} ms, ${spec.level} budget ${budget[spec.level]} ms)`,
  );

  const failure = `${reading.over.length} spec file${reading.over.length === 1 ? '' : 's'} over the time budget: ${listed.join(', ')}. A slow spec hides a world rebuilt per test, I/O behind a fake, or a wait; a budget is raised only by a recorded deviation ("what": "budget.<level>").`;

  return { lines, failure };
}

function timed(spec: TimedSpec): string {
  return `${spec.duration} ms (${spec.file})`;
}

function capitalised(level: string): string {
  return `${level.charAt(0).toUpperCase()}${level.slice(1)}`;
}
