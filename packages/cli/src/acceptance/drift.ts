import type { AcceptanceLock, LockedScenario } from './acceptance-lock.js';
import type { Criterion } from './criteria-in.js';
import type { Scenario } from './scenario.js';

/** How the scenarios stand against the lock of their story. */
export interface Drift {
  /** Locked scenarios changed or gone while every criterion they prove stayed as locked: what a reason must explain. */
  readonly unexplained: readonly LockedScenario[];
  /** What the lock does not hold yet: a new scenario, one changed with its criterion, a new or changed criterion. */
  readonly toLock: readonly string[];
}

/** The scenarios of a story against its lock: a scenario changes with its criterion, or it drifts. */
export function driftOf(lock: AcceptanceLock, scenarios: readonly Scenario[], criteria: readonly Criterion[]): Drift {
  const current = new Map(criteria.map((criterion) => [criterion.id, criterion.fingerprint]));
  const written = scenarios.filter(({ state }) => state === 'pending' || state === 'active');

  const changedCriteria = Object.keys({ ...lock.criteria, ...Object.fromEntries(current) }).filter(
    (id) => lock.criteria[id] !== current.get(id),
  );

  const explained = (locked: LockedScenario): boolean => locked.criteria.some((id) => changedCriteria.includes(id));
  const unexplained: LockedScenario[] = [];
  const toLock: string[] = changedCriteria.map((id) => `criterion ${id} ${current.has(id) ? 'changed' : 'removed'}`);

  for (const locked of lock.scenarios) {
    const now = written.find((scenario) => scenario.title === locked.title);

    if (now?.fingerprint === locked.fingerprint) {
      continue;
    }

    if (explained(locked)) {
      toLock.push(`"${locked.title}" ${now === undefined ? 'removed' : 'changed'} with its criterion`);
    } else {
      unexplained.push(locked);
    }
  }

  const titles = new Set(lock.scenarios.map(({ title }) => title));

  return {
    unexplained,
    toLock: [...toLock, ...written.filter(({ title }) => !titles.has(title)).map(({ title }) => `"${title}" is new`)],
  };
}
