import { dataGenerator } from './current-data-generator';
import { replayHint } from './replay-hint';

/** What `reportSeedOnFailure` needs from the runner; `beforeEach` and `onTestFailed` of vitest fit. */
export interface FailureReportingRunner {
  beforeEach(setup: () => void): unknown;
  onTestFailed(report: () => void): unknown;
}

/**
 * Prints the seed under every failed test of the file, with the way to replay it:
 * `reportSeedOnFailure({ beforeEach, onTestFailed })`.
 */
export function reportSeedOnFailure(
  runner: FailureReportingRunner,
  log: (message: string) => void = console.error,
): void {
  runner.beforeEach(() => {
    runner.onTestFailed(() => log(replayHint(dataGenerator().seed)));
  });
}
