import type { Violation } from '../model/violation';
import type { CheckResult } from './check-result';

/** Counts what is reported; the totals about suppressions and files come from the run it derives from. */
export function summarize(
  violations: Violation[],
  run?: Pick<CheckResult, 'suppressedCount' | 'suppressionCount' | 'fileCount'>,
): CheckResult {
  return {
    violations,
    errorCount: violations.filter((violation) => violation.severity === 'error').length,
    warningCount: violations.filter((violation) => violation.severity === 'warn').length,
    suppressedCount: run?.suppressedCount ?? 0,
    suppressionCount: run?.suppressionCount ?? 0,
    fileCount: run?.fileCount ?? 0,
  };
}
