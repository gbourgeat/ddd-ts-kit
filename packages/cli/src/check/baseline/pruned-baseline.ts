import type { Violation } from '../model/violation';
import type { Baseline } from './baseline';
import { recordedBaseline } from './recorded-baseline';

/** The baseline lowered to the errors a run still finds, never raised: an entry fixed away leaves it. */
export function prunedBaseline(baseline: Baseline, violations: readonly Violation[]): Baseline {
  const found = recordedBaseline(violations);

  return Object.fromEntries(
    Object.entries(baseline)
      .map(([file, rules]) => [file, lowered(rules, found[file] ?? {})] as const)
      .filter(([, rules]) => Object.keys(rules).length > 0),
  );
}

function lowered(rules: Baseline[string], found: Baseline[string]): Baseline[string] {
  return Object.fromEntries(
    Object.entries(rules)
      .map(([ruleId, { count }]) => [ruleId, { count: Math.min(count, found[ruleId]?.count ?? 0) }] as const)
      .filter(([, { count }]) => count > 0),
  );
}
