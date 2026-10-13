import { unitOfWorkScope } from './unit-of-work-scope.js';

/**
 * Runs `work` once the unit of work in progress has committed, after its `after-commit`
 * handlers, and never when it rolled back; outside of any unit of work, at once. At most once:
 * a crash between the commit and the work loses it, and a rejection after the commit is dropped
 * (`work` reports its own). So only for work whose loss wastes and never loses what a committed
 * row relies on, such as deleting a file no row references any more. An effect a row relies on
 * goes through `atCommit`.
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
