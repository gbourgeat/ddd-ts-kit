import type { AcceptanceLock } from './acceptance-lock.js';
import type { AcceptanceProblem } from './acceptance-problem.js';
import type { Criterion } from './criteria-in.js';
import { driftOf } from './drift.js';
import { lockFileOf } from './lock-file-of.js';
import type { Scenario } from './scenario.js';

/** A story's scenarios and criteria as read, with its lock when it has one. */
export interface LockedStory {
  readonly story: string;
  readonly lock: AcceptanceLock | undefined;
  readonly scenarios: readonly Scenario[];
  readonly criteria: readonly Criterion[];
}

/**
 * The acceptance of a story against its lock. Changing a locked scenario while the criteria it
 * proves stay as they were is a drift, whatever the gate: the test is made easier, or the
 * specification changed without being written. What only needs locking again counts from `written`.
 */
export function lockProblems({ story, lock, scenarios, criteria }: LockedStory): AcceptanceProblem[] {
  if (lock === undefined) {
    return scenarios.some(({ state }) => state === 'pending' || state === 'active') ? [notLocked(story)] : [];
  }

  const drift = driftOf(lock, scenarios, criteria);
  const at = lockFileOf(story);

  return [
    ...drift.unexplained.map((locked) => ({
      kind: 'drift' as const,
      at,
      message: `"${locked.title}" changed or disappeared since the lock, and no criterion it proves (${locked.criteria.join(', ') || 'none named'}) changed: restore it as locked (git), change its criterion in the specification of ${story} first, or lock again with --reason "<how the scenario failed its criterion>", which is kept for the owner to validate.`,
    })),
    ...(drift.toLock.length === 0
      ? []
      : [
          {
            kind: 'unlocked' as const,
            at,
            message: `Lock again (\`npx ddd-ts-kit acceptance ${story} --lock\`): ${drift.toLock.join('; ')}.`,
            from: 'written' as const,
          },
        ]),
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
