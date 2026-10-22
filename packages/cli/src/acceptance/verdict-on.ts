import type { Judged } from './drift';
import type { Verdict } from './verdict';

/**
 * The verdict on that change of that version: a refusal wins over a judgement that let it through,
 * so that a second opinion never erases the first refusal.
 */
export function verdictOn(change: Judged, verdicts: readonly Verdict[]): Verdict | undefined {
  const on = verdicts.filter(
    (verdict) => verdict.subject === change.subject && verdict.fingerprint === change.fingerprint,
  );

  return on.find((verdict) => verdict.verdict === 'refuse') ?? on[0];
}
