import { unitOfWorkScope } from './unit-of-work-scope.js';

/**
 * Runs `work` once the unit of work in progress has committed, after its `after-commit`
 * handlers, and never when it rolled back; outside of any unit of work, at once. For an effect
 * outside the database that must follow a commit, such as promoting a staged file. At most once:
 * a crash between the commit and the work loses it, so what it does must be repaired by a job
 * (the purge of staged files). A rejection after the commit is dropped: `work` reports its own.
 */
export async function afterCommit(work: () => Promise<void>): Promise<void> {
  const scope = unitOfWorkScope.getStore();
  const open = scope?.kind === 'unit-of-work' && (scope.stage === 'open' || scope.stage === 'before-commit');

  if (open && scope.committed !== undefined) {
    scope.committed.push(work);

    return;
  }

  await work();
}
