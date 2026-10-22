import { domainEventRuns } from './domain-event-runs';
import { here } from './here';
import type { UnitOfWorkScope } from './unit-of-work-scope';

/**
 * Hands every event dispatched before the commit to the `after-commit` handlers. Never rejects:
 * the state is committed, so nothing here may fail the caller. A save made from there is
 * refused (`SaveAfterCommitError`), and a unit of work started from there is a new one.
 */
export async function dispatchAfterCommit({ kind, dispatched }: UnitOfWorkScope): Promise<void> {
  const scope: UnitOfWorkScope = { kind, stage: 'after-commit', queue: [], dispatched: [] };

  for (const run of domainEventRuns(dispatched.map((queued) => ({ ...queued, within: here })))) {
    await run.dispatch(scope, 'after-commit').catch(() => undefined);
  }
}
