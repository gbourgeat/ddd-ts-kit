import type { AcceptanceLock, LockedScenario } from './acceptance-lock';
import type { Criterion } from './criteria-in';
import type { Scenario } from './scenario';

/** What a locked scenario or criterion became: its new fingerprint, or `removed`. */
const REMOVED = 'removed';

/**
 * A change since the lock that only a verdict of the acceptance-judge agent lets through: a
 * criterion changed or removed, or a scenario changed or removed while every criterion it proves
 * stayed as locked. `subject` is how a verdict names it.
 */
export interface Judged {
  /** `scenario "<title>"` or `criterion AC1`. */
  readonly subject: string;
  /** The fingerprint of what it is now, or `removed`: a verdict holds for that version only. */
  readonly fingerprint: string;
  /** The criteria it proves (a scenario) or is (a criterion). */
  readonly criteria: readonly string[];
}

/** How the scenarios stand against the lock of their story. */
export interface Drift {
  /** What needs a verdict of the acceptance-judge agent before the acceptance is locked again. */
  readonly toJudge: readonly Judged[];
  /** What only needs locking again: a new scenario or criterion, a scenario changed with its criterion. */
  readonly toLock: readonly string[];
}

/**
 * The scenarios and criteria of a story against its lock. A new scenario or criterion adds to the
 * acceptance and only needs locking; a changed or removed criterion, and a scenario changed or
 * removed while its criteria were not, need a verdict first: what makes a test easier to pass.
 */
export function driftOf(lock: AcceptanceLock, scenarios: readonly Scenario[], criteria: readonly Criterion[]): Drift {
  const current = new Map(criteria.map((criterion) => [criterion.id, criterion.fingerprint]));
  const written = scenarios.filter(({ state }) => state === 'pending' || state === 'active');
  const changed = Object.keys(lock.criteria).filter((id) => lock.criteria[id] !== current.get(id));
  const added = [...current.keys()].filter((id) => lock.criteria[id] === undefined);

  const toJudge: Judged[] = changed.map((id) => ({
    subject: `criterion ${id}`,
    fingerprint: current.get(id) ?? REMOVED,
    criteria: [id],
  }));

  const toLock = added.map((id) => `criterion ${id} is new`);

  for (const locked of lock.scenarios) {
    const now = written.find((scenario) => scenario.title === locked.title);

    if (now?.fingerprint === locked.fingerprint) {
      continue;
    }

    if (locked.criteria.some((id) => changed.includes(id))) {
      toLock.push(`"${locked.title}" ${now === undefined ? 'removed' : 'changed'} with its criterion`);
    } else {
      toJudge.push(scenarioChange(locked, now));
    }
  }

  const titles = new Set(lock.scenarios.map(({ title }) => title));

  return {
    toJudge,
    toLock: [...toLock, ...written.filter(({ title }) => !titles.has(title)).map(({ title }) => `"${title}" is new`)],
  };
}

function scenarioChange(locked: LockedScenario, now: Scenario | undefined): Judged {
  return {
    subject: `scenario "${locked.title}"`,
    fingerprint: now?.fingerprint ?? REMOVED,
    criteria: locked.criteria,
  };
}
