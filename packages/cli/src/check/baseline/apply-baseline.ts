import type { Violation } from '../model/violation';
import type { Baseline } from './baseline';
import { BASELINE_FILE } from './read-baseline';
import { recordedBaseline } from './recorded-baseline';

export interface BaselineJudgement {
  /** Whether an entry the run no longer reaches is an error: only when every rule ran on every file. */
  readonly stale: boolean;
}

/**
 * The findings a baseline leaves: the errors of a rule in a file stay quiet while they are no more
 * than the baseline records, and are all reported once they are more, as ESLint does with its bulk
 * suppressions. A count the run no longer reaches is an error of its own, so that the baseline
 * only shrinks: `check --baseline prune` lowers it.
 */
export function applyBaseline(
  violations: readonly Violation[],
  baseline: Baseline,
  judgement: BaselineJudgement,
): Violation[] {
  const found = recordedBaseline(violations);

  const quiet = (violation: Violation): boolean =>
    violation.severity === 'error' &&
    (found[violation.file]?.[violation.ruleId]?.count ?? 0) <=
      (baseline[violation.file]?.[violation.ruleId]?.count ?? 0);

  const kept = violations.filter((violation) => !quiet(violation));

  return judgement.stale ? [...kept, ...staleEntries(baseline, found)] : kept;
}

function staleEntries(baseline: Baseline, found: Baseline): Violation[] {
  return Object.entries(baseline).flatMap(([file, rules]) =>
    Object.entries(rules)
      .map(([ruleId, { count }]) => ({ ruleId, count, now: found[file]?.[ruleId]?.count ?? 0 }))
      .filter(({ count, now }) => now < count)
      .map(({ ruleId, count, now }) => ({
        ruleId,
        severity: 'error' as const,
        file,
        line: 1,
        message: `${BASELINE_FILE} records ${count} error${count === 1 ? '' : 's'} of ${ruleId} in this file, and the file has ${now}: the baseline only shrinks.`,
        fix: 'Run `ddd-ts-kit check --baseline prune` and commit the baseline it lowers.',
      })),
  );
}
