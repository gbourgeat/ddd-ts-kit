import { domainEventRuns } from './domain-event-runs.js';
import type { UnitOfWorkScope } from './unit-of-work-scope.js';

/**
 * Dispatches what waits in the scope, before the commit: the events queued so far in one go,
 * then those their handlers recorded meanwhile, until nothing is left. Recording order, no
 * recursion. The first handler that fails rejects, and what was still waiting is dropped.
 */
export async function dispatchBeforeCommit(scope: UnitOfWorkScope): Promise<void> {
  scope.stage = 'before-commit';

  for (let round = scope.queue.splice(0); round.length > 0; round = scope.queue.splice(0)) {
    for (const run of domainEventRuns(round)) await run.dispatch(scope, 'before-commit');

    scope.dispatched.push(...round);
  }
}
