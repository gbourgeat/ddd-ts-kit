import path from 'node:path';
import { budgetLines } from './budget-lines';
import { budgetSettings } from './budget-settings';
import { levelOf } from './level-of';
import { overBudget, type TimedSpec } from './over-budget';

/** What the reporter reads of the results Jest aggregates: each test file with the instants its run started and ended. */
interface AggregatedResults {
  readonly testResults: readonly {
    readonly testFilePath: string;
    readonly perfStats: { readonly start: number; readonly end: number };
  }[];
}

/**
 * The reporter that holds each spec file to the time budget of its level, read from the `budget` key
 * of `ddd-ts-kit.config.json` (the reference when the key is absent): named in `reporters` of the
 * Jest config as `@ddd-ts-kit/testing/budget/jest`. It names the slowest spec of each level at the
 * end of the run, and fails the run when a spec file took more than its budget.
 */
export class JestDurationBudgetReporter {
  private failure: Error | undefined;
  private readonly root: string;

  /** Jest hands a reporter the global config, then its options: the root of the project is the working directory unless given. */
  constructor(_globalConfig?: unknown, options: { readonly root?: string } = {}) {
    this.root = options.root ?? process.cwd();
  }

  onRunComplete(_contexts: unknown, results: AggregatedResults): void {
    const { budget } = budgetSettings(this.root);
    const reading = overBudget(this.timed(results), budget);
    const { lines, failure } = budgetLines(reading, budget);

    for (const line of lines) {
      console.log(line);
    }

    this.failure = failure === undefined ? undefined : new Error(failure);
  }

  /** What Jest asks a reporter at the end: an error here fails the run. */
  getLastError(): Error | undefined {
    return this.failure;
  }

  private timed(results: AggregatedResults): TimedSpec[] {
    return results.testResults.flatMap(({ testFilePath, perfStats }) => {
      const file = path.relative(this.root, testFilePath).replaceAll('\\', '/');
      const level = levelOf(file);

      return level === undefined ? [] : [{ file, level, duration: Math.round(perfStats.end - perfStats.start) }];
    });
  }
}
