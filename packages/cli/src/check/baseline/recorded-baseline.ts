import type { Violation } from '../model/violation';
import type { Baseline } from './baseline';

/** The errors of a run, counted by file and by rule: what `check --baseline write` records. Warnings fail nothing and are left out. */
export function recordedBaseline(violations: readonly Violation[]): Baseline {
  const counts: Record<string, Record<string, { count: number }>> = {};

  for (const { file, ruleId } of violations.filter((violation) => violation.severity === 'error')) {
    const rules = (counts[file] ??= {});
    const entry = (rules[ruleId] ??= { count: 0 });

    entry.count += 1;
  }

  return counts;
}
