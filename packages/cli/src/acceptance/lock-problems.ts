import type { AcceptanceLock } from './acceptance-lock.js';
import type { AcceptanceProblem } from './acceptance-problem.js';
import type { Criterion } from './criteria-in.js';
import { driftOf, type Judged } from './drift.js';
import { lockFileOf } from './lock-file-of.js';
import { regressionDriftOf } from './regression-drift-of.js';
import type { RegressionSpec } from './regression-spec.js';
import type { Scenario } from './scenario.js';
import type { Verdict } from './verdict.js';
import { verdictOn } from './verdict-on.js';

/** A story's scenarios and criteria as read, with its lock when it has one and the verdicts on its changes. */
export interface LockedStory {
  readonly story: string;
  readonly lock: AcceptanceLock | undefined;
  readonly scenarios: readonly Scenario[];
  readonly criteria: readonly Criterion[];
  /** The regression specs of a fix; none for a story. */
  readonly regression?: readonly RegressionSpec[] | undefined;
  readonly verdicts: readonly Verdict[];
}

/**
 * The acceptance of a story against its lock. A criterion changed, or a scenario changed while its
 * criteria were not, is a drift whatever the gate until the acceptance-judge agent let it through:
 * the test made easier, or the specification changed without being judged. What only needs
 * locking again counts from `written`.
 */
export function lockProblems(locked: LockedStory): AcceptanceProblem[] {
  const { story, lock, scenarios, criteria, verdicts } = locked;
  const regression = locked.regression ?? [];

  if (lock === undefined) {
    const written = [...scenarios, ...regression.flatMap((spec) => spec.tests)];

    return written.some(({ state }) => state === 'pending' || state === 'active') ? [notLocked(story)] : [];
  }

  const drifts = [driftOf(lock, scenarios, criteria), regressionDriftOf(lock.regression, regression)];
  const drift = { toJudge: drifts.flatMap((each) => each.toJudge), toLock: drifts.flatMap((each) => each.toLock) };
  const at = lockFileOf(story);

  const amended = drift.toJudge
    .filter((change) => verdictOn(change, verdicts)?.verdict === 'amend')
    .map(({ subject }) => `${subject} amended by its verdict`);

  const toLock = [...drift.toLock, ...amended];

  return [
    ...drift.toJudge.flatMap((change) => driftProblems(story, change, verdictOn(change, verdicts))),
    ...(toLock.length === 0
      ? []
      : [
          {
            kind: 'unlocked' as const,
            at,
            message: `Lock again (\`npx ddd-ts-kit acceptance ${story} --lock\`): ${toLock.join('; ')}.`,
            from: 'written' as const,
          },
        ]),
  ];
}

function driftProblems(story: string, change: Judged, verdict: Verdict | undefined): AcceptanceProblem[] {
  if (verdict?.verdict === 'amend') {
    return [];
  }

  const at = lockFileOf(story);

  const refused =
    verdict === undefined
      ? 'no verdict lets it through'
      : `the acceptance-judge refused it (${verdict.file}: ${verdict.reason})`;

  return [
    {
      kind: 'drift',
      at,
      message: `The ${change.subject} changed since the lock, and ${refused}: restore it as locked (git); or, when it truly failed its criterion or the statement changed, have the acceptance-judge agent judge "${change.subject}" at fingerprint ${change.fingerprint}.`,
    },
  ];
}

function notLocked(story: string): AcceptanceProblem {
  return {
    kind: 'unlocked',
    at: lockFileOf(story),
    message: `The acceptance of ${story} is not locked: once its scenarios are written, \`npx ddd-ts-kit acceptance ${story} --lock\`, committed with them.`,
    from: 'written',
  };
}
