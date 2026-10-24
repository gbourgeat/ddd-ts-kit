import path from 'node:path';
import { budgetLines } from './budget-lines';
import { budgetSettings } from './budget-settings';
import { levelOf } from './level-of';
import { overBudget, type TimedSpec } from './over-budget';

/** What the reporter reads of a test module Vitest ran: its file, and the time it took to collect and to run. */
interface TimedModule {
  readonly moduleId: string;
  diagnostic(): { readonly duration: number; readonly collectDuration: number };
}

/** What the reporter needs of Vitest once started: a logger. */
interface Started {
  readonly logger: { log(message: string): void };
}

/**
 * The reporter that holds each spec file to the time budget of its level, read from the `budget` key
 * of `ddd-ts-kit.config.json` (the reference when the key is absent): named in `reporters` of the
 * Vitest config as `@ddd-ts-kit/testing/budget/vitest`, or passed on the command line with
 * `--reporter`. It names the slowest spec of each level at the end of the run, and warns, failing the run once the config enforces the budget,
 * when a spec file took more than its budget, collection and tests together.
 */
export class VitestDurationBudgetReporter {
  private readonly root: string;

  /** Vitest hands a reporter its options: the root of the project is the working directory unless given. */
  constructor(options: { readonly root?: string } = {}) {
    this.root = options.root ?? process.cwd();
  }

  onInit(vitest: Started): void {
    this.log = (message) => vitest.logger.log(message);
  }

  onTestRunEnd(testModules: readonly TimedModule[]): void {
    const { budget, enforced } = budgetSettings(this.root);
    const reading = overBudget(this.timed(testModules), budget);
    const { lines, failure } = budgetLines(reading, budget, enforced);

    for (const line of lines) {
      this.log(line);
    }

    if (failure !== undefined) {
      throw new Error(failure);
    }
  }

  private log: (message: string) => void = (message) => console.log(message);

  private timed(testModules: readonly TimedModule[]): TimedSpec[] {
    return testModules.flatMap((module) => {
      const file = path.relative(this.root, module.moduleId).replaceAll('\\', '/');
      const level = levelOf(file);
      const { duration, collectDuration } = module.diagnostic();

      return level === undefined ? [] : [{ file, level, duration: Math.round(duration + collectDuration) }];
    });
  }
}
